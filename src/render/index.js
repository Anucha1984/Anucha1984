// NiThan Studio renderer (team B): storyboard + scene art → vertical Thai-dubbed, Thai-captioned mp4.
// See docs/CONTRACT.md. Pipeline: voice (TTS) → timeline → Chromium (art raster + text overlays) → ffmpeg.
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GENRES } from '../shared/presets.js';
import { launchBrowser, rasterizeScenes } from './browser.js';
import { buildSrt } from './captions.js';
import { concatAndMux, RASTER, renderAudio, renderSceneClip } from './compose.js';
import { resolveFont } from './fonts.js';
import { planOverlays, renderOverlays, renderPoster } from './overlays.js';
import { buildTimeline } from './timeline.js';
import { synthesizeVoices } from './tts/index.js';
import { ensureFfmpeg, pool, RenderError } from './util.js';

export { RenderError } from './util.js';
export { estimateDuration, buildTimeline } from './timeline.js';
export { chunkCaption, buildSrt } from './captions.js';
export { providerOrder } from './tts/index.js';
export { resolveVoice } from './tts/voices.js';

/**
 * Render a project to video.mp4 / poster.jpg / subtitles.srt inside projectDir.
 * Also fills line.audio / line.durationSec and scene.startSec / scene.durationSec on sb.
 *
 * @param {import('../shared/schema.js').Storyboard} sb
 * @param {string} projectDir
 * @param {{tts?:'auto'|'edge'|'openai'|'elevenlabs'|'none', music?:boolean, onProgress?:(ev:{stage:'voice'|'render',progress:number,message:string})=>void}} [options]
 * @returns {Promise<{videoPath:string,posterPath:string,srtPath:string,durationSec:number,voiced:boolean}>}
 */
export async function renderVideo(sb, projectDir, { tts = 'auto', music = true, onProgress } = {}) {
  if (!sb?.scenes?.length) throw new RenderError('สตอรี่บอร์ดยังไม่มีฉากให้เรนเดอร์');
  projectDir = path.resolve(projectDir);
  const emit = (stage, progress, message) => {
    try {
      onProgress?.({ stage, progress: Math.max(0, Math.min(1, progress)), message });
    } catch {
      /* a broken listener must not break the render */
    }
  };
  await ensureFfmpeg();
  await fsp.mkdir(projectDir, { recursive: true });
  const tmpDir = path.join(projectDir, '.render-tmp');
  await fsp.rm(tmpDir, { recursive: true, force: true });
  await fsp.mkdir(tmpDir, { recursive: true });

  const genre = GENRES[sb.genre] ?? GENRES.folktale;
  const font = resolveFont(genre.captionFont);
  let browser = null;
  // Chromium starts (and rasterises the art) while the voices are being synthesised.
  let rasterDone = 0;
  const rasterTask = (async () => {
    browser = await launchBrowser();
    return rasterizeScenes(browser, sb, projectDir, { ...RASTER, font, onScene: () => rasterDone++ });
  })();
  rasterTask.catch(() => {}); // handled below; avoid an unhandled rejection while voices are running

  try {
    // ── voice ────────────────────────────────────────────────────────────────
    emit('voice', 0, 'กำลังเตรียมเสียงพากย์…');
    const voice = await synthesizeVoices(sb, projectDir, { tts, onProgress: (ev) => emit('voice', ev.progress * 0.98, ev.message) });
    emit('voice', 1, voice.voiced ? 'เสียงพากย์พร้อมแล้ว' : 'ไม่มีเสียงพากย์ — ใช้คำบรรยายกับดนตรีประกอบแทน');

    // ── timeline + pictures ─────────────────────────────────────────────────
    const timeline = buildTimeline(sb);
    emit('render', 0.02, 'กำลังแปลงภาพประกอบแต่ละฉาก…');
    const frames = await rasterTask;
    emit('render', 0.12, 'กำลังวาดคำบรรยายภาษาไทย…');
    const plan = planOverlays(sb, timeline);
    const [items] = await Promise.all([renderOverlays(browser, plan, projectDir), renderPoster(browser, sb, plan, projectDir, frames[0])]);
    await browser.close();
    browser = null;
    await fsp.writeFile(path.join(projectDir, 'subtitles.srt'), buildSrt(plan.cues));

    // ── ffmpeg: audio track + one clip per scene, in parallel ───────────────
    const n = timeline.scenes.length;
    const voices = [];
    for (const sc of timeline.scenes) {
      for (const l of sc.lines) if (l.line.audio) voices.push({ path: path.join(projectDir, l.line.audio), start: sc.start + l.start });
    }
    const audioPath = path.join(tmpDir, 'audio.m4a');
    let clipsDone = 0;
    const tick = () => emit('render', 0.2 + 0.72 * (clipsDone / n), `ตัดต่อฉาก ${clipsDone}/${n}`);
    tick();
    const audioTask = renderAudio({ voices, music, genre: genre.id, duration: timeline.totalSec, out: audioPath });
    audioTask.catch(() => {});
    const abs = (rel) => path.join(projectDir, rel);
    const jobs = Math.max(1, Math.min(4, Math.floor(os.availableParallelism?.() ?? os.cpus().length)));
    const clips = await pool(timeline.scenes, jobs, async (sc) => {
      const prev = sc.index > 0 ? timeline.scenes[sc.index - 1] : null;
      const out = path.join(tmpDir, `${sc.scene.id}.mp4`);
      await renderSceneClip({
        frame: abs(frames[sc.index]),
        camera: sc.scene.camera,
        frames: sc.frames,
        prev: prev && { frame: abs(frames[prev.index]), camera: prev.scene.camera, frames: prev.frames },
        hasNext: sc.index < n - 1,
        overlays: items.filter((it) => it.sceneIndex === sc.index).map((it) => ({ ...it, path: abs(it.file) })),
        fadeOut: sc.index === n - 1,
        out,
      });
      clipsDone++;
      tick();
      return out;
    });
    await audioTask;

    emit('render', 0.94, 'กำลังรวมทุกฉากเป็นวิดีโอ…');
    await concatAndMux({ clips, audio: audioPath, duration: timeline.totalSec, tmpDir, out: path.join(projectDir, 'video.mp4') });
    emit('render', 1, 'เรนเดอร์วิดีโอเสร็จแล้ว');

    return {
      videoPath: 'video.mp4',
      posterPath: 'poster.jpg',
      srtPath: 'subtitles.srt',
      durationSec: Math.round(timeline.totalSec * 100) / 100,
      voiced: voice.voiced,
    };
  } catch (err) {
    if (err instanceof RenderError) throw err;
    throw new RenderError(`เรนเดอร์วิดีโอไม่สำเร็จ: ${err.message}`, err);
  } finally {
    await rasterTask.catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
