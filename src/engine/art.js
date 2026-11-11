// Scene art: one Claude call per scene → a standalone SVG illustration (viewBox 0 0 1080 1920).
// All scenes share a "style bible" (style, palette, character model sheets) so the video looks like one work.
import fs from 'node:fs/promises';
import path from 'node:path';
import { STYLES } from '../shared/presets.js';
import { mockSvg } from '../shared/mock.js';
import { complete } from './llm.js';

export const ART_WIDTH = 1080;
export const ART_HEIGHT = 1920;
const MAX_SVG_BYTES = 120 * 1024; // hard reject above this (prompt asks for ≤ ~25 KB)

const SYSTEM = `You are a master illustrator who draws finished, publication-quality illustrations directly as hand-written SVG code. You think like a painter and a comic artist — composition, silhouette, lighting, anatomy, facial expression — and then execute precisely with bezier paths, gradients, clip paths, patterns and filters.

You reply with exactly one complete SVG document and nothing else: no explanation, no markdown fences. The reply starts with <svg and ends with </svg>.`;

// Extra, technique-level direction per style: how to get this look in SVG.
const STYLE_TECHNIQUE = {
  pixar:
    'Every form is a soft 3D volume: give each major shape (head, cheeks, nose, torso, limbs, props) its own radial/linear gradient from lit side to shadow side, ' +
    'plus a warm rim-light stroke/shape on the edge facing the light and a soft contact shadow under it. No black outlines at all. ' +
    'Heads are large (about 1/3 of body height) with big glossy eyes: white sclera, large coloured iris with gradient, dark pupil, two white highlights, soft upper-lid shadow, expressive brows. ' +
    'Rounded noses, soft cheeks with a blush gradient, simple chunky hands with distinct fingers. Background is painted and blurred with feGaussianBlur (stdDeviation 6–14) for depth of field; ' +
    'add light bloom, bokeh circles and a gentle vignette. Colours saturated and warm, like a still from a modern 3D animated family film.',
  'comic-us':
    'Bold black contour lines of varying weight (stroke-width 5–12, round joins) around every form, spot-black shadow shapes, flat saturated colours with one hard cel-shadow shape per form, ' +
    'Ben-Day dots via <pattern> on skin shadows and sky, dramatic foreshortening and low/high angles, speed or impact lines radiating from the focal point.',
  china:
    'Elegant elongated figures (8 heads tall), fine tapering ink lines (stroke-width 2–4), almond eyes with glossy highlights, long flowing hair drawn as layered ribbon shapes, ' +
    'layered robes or sharp tailored suits with fold lines; backgrounds as soft ink-wash gradients with mist bands, distant mountains, lattice windows, lanterns; vermilion and gold accents.',
  korea:
    'Clean thin outlines (stroke-width 2–3) in a dark tint of the local colour, soft pastel cel shading with one gradient shadow layer, tall fashionable figures, detailed sparkling eyes, ' +
    'glossy hair with a highlight band, bloom glow behind the subject, bokeh and small sparkles, airy modern setting.',
  thai:
    'Thai temple-mural manner: flat frontal/three-quarter figures with graceful curved fingers and poses from classical dance, faces in fine dark-red line with elongated eyes and arched brows, ' +
    'gold outlines (stroke #C9A227-like) on ornaments, chada crowns, sabai and patterned pha-nung drawn with small repeated motifs (<pattern>), kranok flame curls on clouds, water and foliage, ' +
    'flat layered space (no vanishing-point perspective), earthy red / indigo / deep green ground with gold accents.',
  'thai-retro':
    'Old Thai one-baht horror comic cover manner: draw with heavy black brush-ink outlines of uneven weight (stroke-width 5–14, round caps/joins, slightly wobbly hand-drawn curves) and solid black shadow shapes; ' +
    'faces are realistic-pulp with exaggerated terror: wide bulging eyes with small pupils, raised brows, open mouths with teeth, sweat drops, deep hatched cheek shadows. ' +
    'Colour is cheap offset print: flat fills only from a tiny palette (blood red, mustard yellow, teal/green-blue, black, off-white paper) laid slightly off-register from the linework (colour shapes shifted 4–8 px from outlines). ' +
    'Add cross-hatching (groups of short parallel strokes) in shadows, a halftone dot <pattern> overlay on mid-tones and sky, lurid under-lighting or a sickly moon glow, and a yellowed newsprint tint with subtle grain (feTurbulence, low opacity) over everything. ' +
    'Ghosts are pale with hollow black eye sockets, long lank black hair, and an eerie green or red glow.',
  anime:
    'Crisp cel shading with two shadow tones per form, thin dark outlines (stroke-width 2–4), large detailed eyes with multi-stop iris gradients and sharp highlights, spiky/flowing hair in chunky locks with highlight shapes, ' +
    'painted sky backgrounds with layered cumulus clouds and light shafts, strong rim light and a lens-flare accent.',
};

function characterSheets(sb, scene) {
  const chars = sb.characters || [];
  if (!chars.length) return '(no recurring characters)';
  const text = `${scene.visual} ${(scene.lines || []).map((l) => l.speaker).join(' ')}`.toLowerCase();
  return chars
    .map((c) => {
      const inScene = text.includes('`' + c.id.toLowerCase() + '`') || new RegExp(`(^|[^a-z0-9-])${c.id.toLowerCase().replace(/[^a-z0-9-]/g, '')}([^a-z0-9-]|$)`).test(text);
      return `- \`${c.id}\` (${c.name})${inScene ? ' — APPEARS IN THIS SCENE' : ''}: ${c.visual}`;
    })
    .join('\n');
}

/** Build {system, prompt} for one scene's SVG. Pure; exported for tests. */
export function buildArtPrompt(sb, scene, index = 0) {
  const style = STYLES[sb.style] || Object.values(STYLES)[0];
  const total = sb.scenes?.length || 1;
  const pal = (sb.palette || style.swatch).join(', ');
  const prefix = scene.id || `s${String(index + 1).padStart(2, '0')}`;
  const prompt = `Draw scene ${index + 1} of ${total} for the illustrated vertical video "${sb.title}" (${sb.logline || ''}).

# STYLE BIBLE (identical for every scene of this video — follow it exactly so all scenes look like one work)
Art style — ${style.subtitle} (${style.id}): ${style.art}
How to achieve it in SVG: ${STYLE_TECHNIQUE[style.id] || ''}
Shared palette (dark, main, secondary, accent, light): ${pal}. Build the image mostly from these hues plus their tints and shades; skin tones and small neutrals may go outside it.
Character model sheets (a character must look the same in every scene: same face, hair, outfit and colours as written):
${characterSheets(sb, scene)}

# THIS SCENE
Art direction: ${scene.visual}
Mood: ${scene.mood || 'neutral'}
What is being said over this image (context only — do NOT render any of it as text): ${(scene.lines || []).map((l) => l.text).join(' / ') || '-'}

# CANVAS AND COMPOSITION
- Root element exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">. Tall 9:16 phone frame; paint edge to edge (first element is a full-canvas background), no borders, frames or panels — the camera will slowly zoom/pan over the image.
- One striking focal subject, drawn LARGE: the main character/creature should span roughly 45–70% of the frame height (for a close-up the face alone fills the upper-middle of the frame). Faces and the focal point sit between y≈250 and y≈1350.
- The bottom quarter (y > 1440) is covered by captions: continue the picture there with calm, darker, low-detail content (ground, floor, water, mist, shadow, a figure's lower body) — never faces, hands or key props.
- Build real depth in ordered groups: background (sky/walls/far scenery) → midground (architecture, trees, furniture) → characters → foreground elements that overlap the frame edge (branches, door frame, grass, smoke) → lighting and atmosphere overlays (light shafts, glow, fog, vignette, texture).

# CRAFT REQUIREMENTS
- This must read as a finished illustration by a professional, not a diagram or icon. Characters are properly drawn people/creatures: correct proportions for the style, a clear gesture/pose with bent limbs and weight, clothing with folds and shading, hands with fingers, hair as shaped masses with strands/highlights.
- Faces carry the emotion: eyes with sclera, iris, pupil and highlight; eyelids and eyebrows angled for the expression; nose; mouth shaped for the emotion; shadow under the jaw. Never blank or dot-and-line faces, never stick figures, never bare geometric blobs.
- Draw organic forms with <path> bezier curves (C/S/Q); use circles/rects only where things really are round or square.
- Heads and bodies have natural, organic contours (rounded skull, tapered jaw, neck narrower than the head, sloping shoulders) — never boxy, rectangular or mask-like heads. Keep any grain/paper texture overlay subtle (opacity ≤ 0.15) so it never muddies the drawing.
- One clear light source with a consistent direction: gradients for form, cast shadows on the ground and across figures, a rim light or glow separating the subject from the background, and a vignette to focus the eye.
- Add 2–4 specific, recognisable props/setting details from the art direction so the place and era are unmistakable.
- Absolutely NO text of any kind: no <text>, letters, numbers, signs, captions, speech bubbles, signatures or watermark.

# TECHNICAL LIMITS
- Self-contained static SVG only: no <image>, <foreignObject>, <script>, <style> with @import, external href/url, fonts, or animation. <use> may only reference ids in this file.
- Every id must start with "${prefix}-" (e.g. id="${prefix}-sky"), and be referenced as url(#${prefix}-sky).
- Budget: aim for 14–24 KB of SVG (hard limit 28 KB). Spend it on the focal character and the lighting; keep coordinates to integers, reuse gradients, use <pattern>/<use> for repeated details. At most 3 filter effects (they are slow to render); never apply a filter to the whole image except one light grain/texture overlay.
- Well-formed XML: every element closed, attributes quoted.

Plan the composition silently, then output only the SVG.`;
  return { system: SYSTEM, prompt };
}

// ───────────────────────────── sanitiser ─────────────────────────────

const FORBIDDEN_BLOCKS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'text', 'title', 'desc', 'metadata', 'a'];
const FORBIDDEN_VOID = ['image', 'feImage', 'animate', 'animateTransform', 'animateMotion', 'set', 'link', 'meta'];

/** Check tags are balanced. Returns null when OK, else a short problem description. */
export function checkWellFormed(svg) {
  const stack = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g;
  let m;
  let count = 0;
  while ((m = re.exec(svg))) {
    if (!m[2]) continue;
    const [, close, name, , selfClose] = m;
    if (close) {
      const top = stack.pop();
      if (top !== name) return `mismatched </${name}> (expected </${top ?? 'nothing'}>)`;
    } else if (!selfClose) stack.push(name);
    count++;
  }
  if (stack.length) return `unclosed <${stack[stack.length - 1]}>`;
  if (count < 8) return 'too few elements to be an illustration';
  return null;
}

/**
 * Turn an LLM reply into a safe standalone SVG.
 * @returns {{ok:boolean, svg:string, problems:string[]}}  ok=false → do not use `svg`
 */
export function sanitizeSvg(reply) {
  const problems = [];
  const text = String(reply ?? '');
  const start = text.search(/<svg[\s>]/i);
  const end = text.toLowerCase().lastIndexOf('</svg>');
  if (start < 0) return { ok: false, svg: '', problems: ['no <svg> element in the reply'] };
  if (end < start) return { ok: false, svg: '', problems: ['the SVG is truncated: no closing </svg>'] };
  let svg = text.slice(start, end + 6);

  // comments, processing instructions, doctype
  svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  // dangerous / unwanted elements (with content), then their self-closing or stray forms
  for (const tag of FORBIDDEN_BLOCKS) {
    svg = svg.replace(new RegExp(`<${tag}(?=[\\s>/])[^>]*?(?<!/)>[\\s\\S]*?</${tag}\\s*>`, 'gi'), '');
    svg = svg.replace(new RegExp(`</?${tag}(?=[\\s>/])[^>]*>`, 'gi'), '');
  }
  for (const tag of FORBIDDEN_VOID) {
    svg = svg.replace(new RegExp(`<${tag}(?=[\\s>/])[^>]*?(?<!/)>[\\s\\S]*?</${tag}\\s*>`, 'gi'), '');
    svg = svg.replace(new RegExp(`</?${tag}(?=[\\s>/])[^>]*>`, 'gi'), '');
  }
  // event handlers
  svg = svg.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // href / xlink:href / src: keep only same-document fragment references
  svg = svg.replace(/\s+((?:xlink:)?href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (all, name, a, b) => {
    const v = (a ?? b ?? '').trim();
    return v.startsWith('#') ? ` ${name.toLowerCase() === 'src' ? 'href' : name}="${v}"` : '';
  });
  // url(...) may only point to local ids; javascript:/data: anywhere is dropped
  svg = svg.replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none');
  svg = svg.replace(/(?:javascript|vbscript|data)\s*:/gi, '');
  // <style>: drop @import / @font-face
  svg = svg.replace(/@import[^;]*;?/gi, '').replace(/@font-face\s*\{[^}]*\}/gi, '');

  // normalise the root tag: xmlns + fixed size/viewBox
  const rootMatch = svg.match(/^<svg\b((?:"[^"]*"|'[^']*'|[^'">])*)>/i);
  if (!rootMatch) return { ok: false, svg: '', problems: ['malformed <svg> root tag'] };
  let attrs = rootMatch[1].replace(/\/\s*$/, '');
  const needsXlink = /xlink:href/i.test(svg);
  attrs = attrs.replace(/\s+(?:xmlns(?::xlink)?|width|height|viewBox|preserveAspectRatio|x|y)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  const root =
    `<svg xmlns="http://www.w3.org/2000/svg"${needsXlink ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''}` +
    ` viewBox="0 0 ${ART_WIDTH} ${ART_HEIGHT}" width="${ART_WIDTH}" height="${ART_HEIGHT}" preserveAspectRatio="xMidYMid slice"${attrs.trimEnd()}>`;
  svg = root + svg.slice(rootMatch[0].length);

  const wf = checkWellFormed(svg);
  if (wf) problems.push(wf);
  if (!/<(path|rect|circle|ellipse|polygon|polyline|line|use)\b/i.test(svg)) problems.push('no drawable shapes');
  const bytes = Buffer.byteLength(svg);
  if (bytes > MAX_SVG_BYTES) problems.push(`too large (${Math.round(bytes / 1024)} KB)`);
  return { ok: problems.length === 0, svg, problems };
}

// ───────────────────────────── generation ─────────────────────────────

const debug = (...a) => process.env.NITHAN_DEBUG && console.error('[nithan:art]', ...a);

async function drawScene(sb, scene, index, { model, llm, effort }) {
  const { system, prompt } = buildArtPrompt(sb, scene, index);
  let feedback = '';
  let lastProblem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const t0 = Date.now();
      const reply = await llm({ system, prompt: prompt + feedback, model, maxTokens: 24000, ...(effort ? { effort } : {}) });
      const res = sanitizeSvg(reply);
      debug(scene.id, `attempt ${attempt + 1}: ${((Date.now() - t0) / 1000).toFixed(0)}s, ${(reply.length / 1024).toFixed(1)} KB`, res.ok ? 'ok' : res.problems.join('; '));
      if (res.ok) return { svg: res.svg, fallback: false };
      lastProblem = res.problems.join('; ');
    } catch (err) {
      lastProblem = err.message || String(err);
      debug(scene.id, `attempt ${attempt + 1} failed:`, lastProblem);
      if (err.code === 'no-backend' || err.code === 'auth') throw err; // retrying cannot help
    }
    feedback = `\n\nNOTE: your previous attempt was rejected (${lastProblem}). Output one complete, well-formed SVG under 24 KB, ending with </svg>; simplify the background detail if needed.`;
  }
  return { svg: mockSvg(sb, index), fallback: true, problem: lastProblem };
}

/**
 * Draw every scene (or only the ids in `only`) as SVG into <projectDir>/scenes/sNN.svg and set scene.art.
 * Never throws because of a single scene: after one retry it falls back to a simple placeholder SVG.
 * @param {import('../shared/schema.js').Storyboard} sb
 * @param {string} projectDir
 * @param {{onProgress?:Function, model?:string, concurrency?:number, only?:string[], effort?:string, llm?:Function}} [opts]
 */
export async function generateArt(sb, projectDir, { onProgress, model, concurrency = 4, only, effort = process.env.NITHAN_ART_EFFORT || 'medium', llm = complete } = {}) {
  const dir = path.join(projectDir, 'scenes');
  await fs.mkdir(dir, { recursive: true });
  sb.scenes.forEach((s, i) => (s.id ||= `s${String(i + 1).padStart(2, '0')}`));
  const jobs = sb.scenes.map((scene, index) => ({ scene, index })).filter((j) => !Array.isArray(only) || !only.length || only.includes(j.scene.id));
  const total = jobs.length;
  if (!total) return sb;
  onProgress?.({ progress: 0, message: `Claude กำลังวาดภาพ ${total} ฉาก (ครั้งละ ${Math.min(concurrency, total)} ฉาก)…` });

  let done = 0;
  let next = 0;
  let fatal = null;
  const fallbacks = [];
  const worker = async () => {
    while (next < jobs.length && !fatal) {
      const { scene, index } = jobs[next++];
      let result;
      try {
        result = await drawScene(sb, scene, index, { model, llm, effort });
      } catch (err) {
        fatal = err; // no backend / bad key: stop everything, the caller must know
        return;
      }
      const rel = `scenes/${scene.id}.svg`;
      await fs.writeFile(path.join(projectDir, rel), result.svg);
      // a redraw may replace art that had another extension
      scene.art = rel;
      done++;
      if (result.fallback) fallbacks.push(scene.id);
      onProgress?.({
        progress: done / total,
        message: result.fallback ? `ฉาก ${index + 1} วาดไม่สำเร็จ ใช้ภาพสำรองแทน (${done}/${total})` : `วาดฉาก ${index + 1} เสร็จแล้ว (${done}/${total})`,
        detail: { sceneId: scene.id, art: rel, fallback: result.fallback || undefined },
      });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker));
  if (fatal) throw fatal;
  if (fallbacks.length === total && total > 1) {
    throw new Error('Claude วาดภาพไม่สำเร็จเลยสักฉาก กรุณาตรวจสอบการเชื่อมต่อ Claude แล้วลองใหม่');
  }
  return sb;
}
