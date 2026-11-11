// Timing: per-line durations → scene start/duration, quantised to whole frames.
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const TIMING = {
  lead: 0.5, // silence before the first line of a scene (covers the crossfade)
  firstLead: 0.35,
  gap: 0.28, // pause between two lines
  tail: 0.4, // hold after the last line
  xfade: 0.4, // crossfade between scenes
  titleMax: 3.6, // hook title card on the first scene
  endTag: 2.8, // "ติดตามตอนต่อไป" card
  fadeOut: 0.5,
};

const CHARS_PER_SEC = 14;
const MIN_LINE_SEC = 1.6;

/** Letters that take time to say: drop whitespace and punctuation, keep Thai marks. */
export function speechLength(text) {
  return String(text ?? '').replace(/[\s\p{P}\p{S}]/gu, '').length;
}

/** Estimated speaking time (seconds) of a Thai line when there is no real audio. */
export function estimateDuration(text) {
  const t = String(text ?? '').trim();
  const pauses = (t.match(/\s+|[!?…,.]+/g) || []).length;
  const sec = speechLength(t) / CHARS_PER_SEC + pauses * 0.16;
  return Math.round(Math.max(MIN_LINE_SEC, sec) * 100) / 100;
}

const toFrames = (sec) => Math.max(1, Math.round(sec * FPS));

/**
 * Lay the storyboard out on a timeline. Uses line.durationSec when present (measured audio),
 * otherwise an estimate. Mutates sb (line.durationSec, scene.startSec, scene.durationSec).
 * @returns {{fps:number,totalFrames:number,totalSec:number,scenes:Array}}
 */
export function buildTimeline(sb) {
  const scenes = [];
  let frame = 0;
  const last = sb.scenes.length - 1;
  sb.scenes.forEach((scene, i) => {
    let t = i === 0 ? TIMING.firstLead : TIMING.lead;
    const lines = scene.lines.map((line, j) => {
      const dur = line.durationSec > 0 ? line.durationSec : estimateDuration(line.text);
      line.durationSec = Math.round(dur * 1000) / 1000;
      if (j > 0) t += TIMING.gap;
      const entry = { line, start: t, dur };
      t += dur;
      return entry;
    });
    t += TIMING.tail;
    const speechEnd = t;
    const extras = {};
    if (i === last) {
      const moral = String(sb.moral ?? '').trim();
      if (moral) {
        const d = Math.min(6.5, Math.max(3, estimateDuration(moral) + 1));
        extras.moral = { start: t, dur: d };
        t += d;
      }
      if (sb.series && (sb.series.nextHook || sb.series.episode)) {
        extras.endTag = { start: t, dur: TIMING.endTag };
        t += TIMING.endTag;
      }
      if (extras.moral || extras.endTag) t += 0.2;
    }
    const frames = toFrames(t);
    const entry = {
      scene,
      index: i,
      startFrame: frame,
      frames,
      start: frame / FPS,
      dur: frames / FPS,
      speechEnd,
      lines,
      ...extras,
    };
    scene.startSec = Math.round(entry.start * 1000) / 1000;
    scene.durationSec = Math.round(entry.dur * 1000) / 1000;
    scenes.push(entry);
    frame += frames;
  });
  return { fps: FPS, totalFrames: frame, totalSec: frame / FPS, scenes };
}
