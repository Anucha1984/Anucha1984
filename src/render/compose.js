// ffmpeg composition: per-scene clips (Ken Burns + crossfade-in + overlays) → concat (stream copy) + audio mix.
import fsp from 'node:fs/promises';
import path from 'node:path';
import { FPS, HEIGHT, TIMING, WIDTH } from './timeline.js';
import { musicGraph } from './music.js';
import { ffmpeg, num } from './util.js';

/** Art is rasterised this much larger than the output so zooms never upsample. */
export const RASTER_SCALE = 1.25;
export const RASTER = { width: Math.round(WIDTH * RASTER_SCALE), height: Math.round(HEIGHT * RASTER_SCALE) };

const X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), '-video_track_timescale', '15360'];

// Ken Burns: zoom (z) and view centre (cx, cy as fractions of the frame), start → end.
const Z = 1.16;
const M = (1 - 1 / 1.14) / 2; // max centre offset at zoom 1.14
const MOVES = {
  'zoom-in': { z: [1.0, Z], cx: [0.5, 0.5], cy: [0.5, 0.48] },
  'zoom-out': { z: [Z, 1.0], cx: [0.5, 0.5], cy: [0.48, 0.5] },
  'pan-left': { z: [1.14, 1.14], cx: [0.5 + M, 0.5 - M], cy: [0.5, 0.5] },
  'pan-right': { z: [1.14, 1.14], cx: [0.5 - M, 0.5 + M], cy: [0.5, 0.5] },
  'pan-up': { z: [1.14, 1.14], cx: [0.5, 0.5], cy: [0.5 + M, 0.5 - M] },
  'pan-down': { z: [1.14, 1.14], cx: [0.5, 0.5], cy: [0.5 - M, 0.5 + M] },
  static: { z: [1.0, 1.03], cx: [0.5, 0.5], cy: [0.5, 0.5] },
};

/**
 * Sub-pixel accurate camera move as a `perspective` filter (evaluated per frame, bilinear sampling),
 * which avoids the integer-rounding jitter of zoompan. Progress p = (frame + offset) / total.
 */
export function cameraFilter(camera, totalFrames, offsetFrames = 0) {
  const mv = MOVES[camera] ?? MOVES['zoom-in'];
  const p = `((on+${offsetFrames})/${Math.max(1, totalFrames)})`;
  const lerp = ([a, b]) => (a === b ? num(a, 5) : `(${num(a, 5)}+${num(b - a, 5)}*${p})`);
  const z = lerp(mv.z);
  const cx = lerp(mv.cx);
  const cy = lerp(mv.cy);
  const l = `W*(${cx}-0.5/${z})`;
  const r = `W*(${cx}+0.5/${z})`;
  const t = `H*(${cy}-0.5/${z})`;
  const b = `H*(${cy}+0.5/${z})`;
  return `perspective=x0='${l}':y0='${t}':x1='${r}':y1='${t}':x2='${l}':y2='${b}':x3='${r}':y3='${b}':sense=source:interpolation=linear:eval=frame`;
}

/**
 * Build the ffmpeg arguments for one scene clip.
 * @param {object} o
 * @param {string} o.frame       absolute path of this scene's rasterised art
 * @param {string} o.camera
 * @param {number} o.frames      clip length in frames
 * @param {{frame:string,camera:string,frames:number}|null} o.prev  previous scene (crossfaded in, its motion continuing)
 * @param {boolean} o.hasNext    true when a following scene will crossfade out of this one
 * @param {Array<{path:string,x:number,y:number,start:number,end:number,fade?:boolean,fadeIn?:number}>} o.overlays
 * @param {boolean} o.fadeOut    fade to black at the end (last scene)
 */
export function sceneClipArgs({ frame, camera, frames, prev, hasNext, overlays = [], fadeOut = false, out }) {
  const xf = Math.round(TIMING.xfade * FPS);
  const dur = frames / FPS;
  const inputs = ['-framerate', String(FPS), '-i', frame];
  const graph = [];
  const still = (idx, n, cam, total, off, label) =>
    `[${idx}:v]format=yuv420p,loop=loop=-1:size=1,trim=end_frame=${n},${cameraFilter(cam, total, off)},` +
    `scale=${WIDTH}:${HEIGHT}:flags=bicubic,setsar=1,setpts=N/(${FPS}*TB)[${label}]`;
  // this scene keeps moving through the next clip's crossfade → total motion length includes it
  graph.push(still(0, frames, camera, frames + (hasNext ? xf : 0), 0, 'cur'));
  let base = 'cur';
  let nIn = 1;
  if (prev) {
    inputs.push('-framerate', String(FPS), '-i', prev.frame);
    graph.push(still(nIn, xf, prev.camera, prev.frames + xf, prev.frames, 'prev'));
    graph.push(`[prev][cur]xfade=transition=fade:duration=${num(TIMING.xfade)}:offset=0[xf]`);
    base = 'xf';
    nIn++;
  }
  overlays.forEach((ov, k) => {
    inputs.push('-framerate', String(FPS), '-i', ov.path);
    const a = Math.max(0, ov.start);
    const b = Math.min(dur, ov.end);
    let src = `${nIn}:v`;
    if (ov.fade) {
      const fi = ov.fadeIn ?? 0.3;
      const fo = 0.35;
      const chain = [`format=rgba`, `loop=loop=-1:size=1`, `trim=end_frame=${frames}`, `setpts=N/(${FPS}*TB)`];
      if (fi > 0) chain.push(`fade=t=in:st=${num(a)}:d=${num(fi)}:alpha=1`);
      // no fade-out when the card runs to the very end of the video (the global fade handles it)
      if (b < dur - 0.05) chain.push(`fade=t=out:st=${num(b - fo)}:d=${num(fo)}:alpha=1`);
      graph.push(`[${nIn}:v]${chain.join(',')}[f${k}]`);
      src = `f${k}`;
    }
    graph.push(`[${base}][${src}]overlay=x=${ov.x}:y=${ov.y}:eof_action=repeat:enable='between(t,${num(a)},${num(b)})'[o${k}]`);
    base = `o${k}`;
    nIn++;
  });
  const tail = [];
  if (fadeOut) tail.push(`fade=t=out:st=${num(Math.max(0, dur - TIMING.fadeOut))}:d=${num(TIMING.fadeOut)}`);
  tail.push('format=yuv420p');
  graph.push(`[${base}]${tail.join(',')}[v]`);
  return [...inputs, '-filter_complex', graph.join(';'), '-map', '[v]', '-frames:v', String(frames), ...X264, '-an', out];
}

export async function renderSceneClip(opts) {
  await ffmpeg(sceneClipArgs(opts));
  return opts.out;
}

/**
 * Build the ffmpeg arguments for the full-length audio track.
 * @param {object} o
 * @param {{path:string,start:number}[]} o.voices  voice files positioned on the timeline (absolute seconds)
 * @param {boolean} o.music
 * @param {string} o.genre
 * @param {number} o.duration
 */
export function audioArgs({ voices = [], music = true, genre, duration, out }) {
  const inputs = [];
  const graph = [];
  const d = num(duration, 3);
  const fmt = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
  let voice = null;
  if (voices.length) {
    voices.forEach((v, i) => {
      inputs.push('-i', v.path);
      graph.push(`[${i}:a]${fmt},adelay=${Math.round(v.start * 1000)}:all=1[v${i}]`);
    });
    const mixed = voices.length > 1 ? `${voices.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voices.length}:normalize=0:dropout_transition=0,` : '[v0]';
    // gentle levelling so different TTS voices sit at a similar loudness
    graph.push(`${mixed}dynaudnorm=f=250:g=15:p=0.9:m=8,apad,atrim=0:${d}${music ? ',asplit=2[voice][duck]' : '[voice]'}`);
    voice = 'voice';
  }
  let final;
  if (music) {
    graph.push(musicGraph(genre, duration, 'bed'));
    const fades = `afade=t=in:st=0:d=1.2,afade=t=out:st=${num(Math.max(0, duration - 1.6), 3)}:d=1.6`;
    if (voice) {
      // bed sits well below the voice and ducks further whenever someone speaks
      graph.push(`[bed]${fmt},atrim=0:${d},volume=0.2,${fades}[bedv]`);
      graph.push(`[bedv][duck]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=700:makeup=1[ducked]`);
      graph.push(`[voice][ducked]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95[a]`);
    } else {
      // silent mode: the bed is the only audio, so it may be louder
      graph.push(`[bed]${fmt},atrim=0:${d},volume=0.6,${fades},alimiter=limit=0.9[a]`);
    }
    final = 'a';
  } else if (voice) {
    graph.push(`[voice]alimiter=limit=0.95[a]`);
    final = 'a';
  } else {
    // keep an (empty) audio stream so every player and platform accepts the file
    graph.push(`anullsrc=r=44100:cl=stereo,atrim=0:${d}[a]`);
    final = 'a';
  }
  return [...inputs, '-filter_complex', graph.join(';'), '-map', `[${final}]`, '-t', d, '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', out];
}

export async function renderAudio(opts) {
  await ffmpeg(audioArgs(opts));
  return opts.out;
}

/** Concatenate the scene clips (no re-encode) and mux the audio track. */
export async function concatAndMux({ clips, audio, duration, tmpDir, out }) {
  const list = path.join(tmpDir, 'clips.txt');
  await fsp.writeFile(list, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  await ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', list,
    '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c', 'copy', '-t', num(duration, 3),
    '-movflags', '+faststart',
    out,
  ]);
  return out;
}
