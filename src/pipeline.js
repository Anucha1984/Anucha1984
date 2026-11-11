// One command → one video. Orchestrates engine (Claude) → art → voice → render.
// Owned by the integrator. See docs/CONTRACT.md.
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveOptions } from './shared/presets.js';
import { slugify, validateStoryboard } from './shared/schema.js';
import { mockArt, mockStoryboard } from './shared/mock.js';

// Overall progress budget per stage: [start, end]
const BUDGET = { storyboard: [0, 0.15], art: [0.15, 0.6], voice: [0.6, 0.75], render: [0.75, 1] };

function staged(onProgress, stage) {
  const [a, b] = BUDGET[stage];
  return (ev = {}) =>
    onProgress?.({ stage, message: '', ...ev, progress: a + (b - a) * Math.max(0, Math.min(1, ev.progress ?? 0)) });
}

export async function saveStoryboard(sb, projectDir) {
  await fs.writeFile(path.join(projectDir, 'storyboard.json'), JSON.stringify(sb, null, 2));
}

export async function loadStoryboard(projectDir) {
  return JSON.parse(await fs.readFile(path.join(projectDir, 'storyboard.json'), 'utf8'));
}

/**
 * Create a video from a one-line idea.
 * @param {object} input  see resolveOptions() in shared/presets.js
 * @param {(ev: import('./shared/schema.js').ProgressEvent) => void} [onProgress]
 * @returns {Promise<{projectDir:string, storyboard:import('./shared/schema.js').Storyboard}>}
 */
export async function createVideo(input, onProgress) {
  const opts = resolveOptions(input);
  if (!opts.prompt) throw new Error('กรุณาใส่ชื่อเรื่องหรือไอเดีย (prompt)');
  const id = slugify(input.id || opts.prompt);
  const projectDir = path.resolve(opts.outDir, id);
  await fs.mkdir(projectDir, { recursive: true });

  try {
    // 1) Storyboard
    const pStory = staged(onProgress, 'storyboard');
    pStory({ progress: 0, message: 'Claude กำลังเขียนบทและสตอรี่บอร์ด…' });
    let sb;
    if (opts.mock) sb = mockStoryboard(opts);
    else {
      const { generateStoryboard } = await import('./engine/index.js');
      sb = await generateStoryboard(opts, { onProgress: pStory });
    }
    sb.id = id;
    sb.genre = opts.genre;
    sb.style = opts.style;
    sb.createdAt = new Date().toISOString();
    validateStoryboard(sb);
    await saveStoryboard(sb, projectDir);
    pStory({ progress: 1, message: `ได้บทแล้ว: ${sb.title} (${sb.scenes.length} ฉาก)`, detail: { storyboard: sb } });

    // 2) Art
    const pArt = staged(onProgress, 'art');
    pArt({ progress: 0, message: 'กำลังวาดภาพแต่ละฉาก…' });
    if (opts.mock) {
      await mockArt(sb, projectDir, (s, i) =>
        pArt({ progress: (i + 1) / sb.scenes.length, message: `วาดฉาก ${i + 1}/${sb.scenes.length}`, detail: { sceneId: s.id, art: s.art } }),
      );
    } else {
      const { generateArt } = await import('./engine/index.js');
      await generateArt(sb, projectDir, { onProgress: pArt, model: opts.model });
    }
    await saveStoryboard(sb, projectDir);

    // 3+4) Voice + render (renderer reports stage 'voice' then 'render' itself)
    await renderProject(projectDir, opts, onProgress, sb);
    onProgress?.({ stage: 'done', progress: 1, message: 'เสร็จแล้ว! วิดีโอพร้อมดู', detail: { projectId: id, output: sb.output } });
    return { projectDir, storyboard: sb };
  } catch (err) {
    onProgress?.({ stage: 'error', progress: 0, message: err.message || String(err), detail: { projectId: id } });
    throw err;
  }
}

/** (Re-)render an existing project dir, e.g. after the user edited lines in the studio. */
export async function renderProject(projectDir, input = {}, onProgress, sb) {
  const opts = resolveOptions({ prompt: 'x', ...input });
  sb ??= await loadStoryboard(projectDir);
  const { renderVideo } = await import('./render/index.js');
  const pVoice = staged(onProgress, 'voice');
  const pRender = staged(onProgress, 'render');
  sb.output = await renderVideo(sb, projectDir, {
    tts: opts.tts,
    music: opts.music,
    onProgress: (ev) => (ev.stage === 'voice' ? pVoice(ev) : pRender(ev)),
  });
  await saveStoryboard(sb, projectDir);
  return sb;
}
