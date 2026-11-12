// Raster scene art from an image model (photoreal / cinematic looks that SVG cannot do).
// Claude still writes the script and the per-scene art direction; the image model paints it.
//
//   NITHAN_IMAGE = auto | claude | cloudflare | gemini | openai     (CLI: --image)
//   auto → cloudflare (free daily quota, FLUX.2) if CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN,
//          else gemini if GEMINI_API_KEY, else openai if OPENAI_API_KEY, else claude (SVG)
//
// Face lock: one reference portrait per character is generated first (characters/<id>.png) and passed
// as a reference image to every scene that character appears in.
import fs from 'node:fs/promises';
import path from 'node:path';
import { STYLES } from '../shared/presets.js';

export const IMAGE_PROVIDERS = ['auto', 'claude', 'cloudflare', 'gemini', 'openai'];
const LABEL = { cloudflare: 'FLUX.2 (Cloudflare)', gemini: 'Gemini', openai: 'OpenAI' };
const cfReady = (env) => Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);

const geminiKey = (env) => env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';

/** Resolve which provider draws the art. Returns 'claude' (SVG) | 'gemini' | 'openai'. Throws a Thai error when impossible. */
export function pickImageProvider(requested, styleId, env = process.env) {
  const want = IMAGE_PROVIDERS.includes(requested) ? requested : env.NITHAN_IMAGE || 'auto';
  const style = STYLES[styleId];
  if (want === 'cloudflare') {
    if (!cfReady(env)) throw new Error('เลือก --image cloudflare แต่ยังไม่ได้ตั้งค่า CLOUDFLARE_ACCOUNT_ID และ CLOUDFLARE_API_TOKEN');
    return 'cloudflare';
  }
  if (want === 'gemini') {
    if (!geminiKey(env)) throw new Error('เลือก --image gemini แต่ยังไม่ได้ตั้งค่า GEMINI_API_KEY');
    return 'gemini';
  }
  if (want === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('เลือก --image openai แต่ยังไม่ได้ตั้งค่า OPENAI_API_KEY');
    return 'openai';
  }
  if (want === 'auto') {
    if (cfReady(env)) return 'cloudflare';
    if (geminiKey(env)) return 'gemini';
    if (env.OPENAI_API_KEY) return 'openai';
  }
  if (style?.needsImageModel) {
    throw new Error(
      `ลายเส้น "${style.name}" เป็นภาพสมจริง ต้องใช้โมเดลสร้างภาพ กรุณาตั้งค่า CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (ฟรี), GEMINI_API_KEY หรือ OPENAI_API_KEY ก่อน ` +
        '(Claude วาดได้เฉพาะภาพเวกเตอร์แนวการ์ตูน)',
    );
  }
  return 'claude';
}

/** Characters that appear in a scene (by id or Thai name in the art direction, or as a speaker). */
export function sceneCast(sb, scene) {
  const text = `${scene.visual} ${scene.lines?.map((l) => l.speaker).join(' ') ?? ''}`.toLowerCase();
  const word = (id) => new RegExp(`(^|[^a-z0-9])${id.toLowerCase().replace(/[^a-z0-9-]/g, '')}([^a-z0-9]|$)`).test(text);
  return (sb.characters || []).filter((c) => word(c.id) || scene.visual.includes(c.name));
}

const stylePrompt = (sb) => {
  const style = STYLES[sb.style] || Object.values(STYLES)[0];
  return style.photo || style.art;
};

/** Prompt for a character's reference portrait (the face every later shot must match). */
export function buildPortraitPrompt(sb, character) {
  return [
    `Character reference portrait for a Thai story video. One person only, front-facing, head and upper body, neutral calm expression, eyes to camera, even soft light, plain dark background.`,
    `STYLE: ${stylePrompt(sb)}`,
    `CHARACTER: ${character.visual}`,
    `Thai setting and features unless described otherwise. NO text, letters, logos, watermarks or borders.`,
  ].join('\n');
}

/**
 * One self-contained English prompt for a scene.
 * @param {{id:string}[]} [refs] characters whose reference portraits are attached, in attachment order
 */
export function buildImagePrompt(sb, scene, refs = []) {
  const cast = sceneCast(sb, scene);
  const sheets = (cast.length ? cast : sb.characters || []).slice(0, 4).map((c) => `- ${c.id}: ${c.visual}`);
  const lock = refs.length
    ? `REFERENCE IMAGES: ${refs.map((c, i) => `image ${i} is the character "${c.id}"`).join('; ')}. ` +
      `Reproduce each referenced person's exact face, facial structure, skin tone, hairstyle and outfit — same identity in every shot; only pose, expression, camera angle and lighting change. Do not copy the reference's plain background or framing.`
    : '';
  return [
    `Vertical 9:16 illustration for a Thai short-form story video. One single full-frame image.`,
    `STYLE: ${stylePrompt(sb)}`,
    `SCENE: ${scene.visual}`,
    `MOOD: ${scene.mood}.`,
    lock,
    sheets.length ? `CHARACTERS (keep each one's face, age, hair and clothing exactly as described, identical in every image of this series):\n${sheets.join('\n')}` : '',
    `SETTING: Thailand unless the scene says otherwise; Thai faces, clothing, architecture and props.`,
    `COMPOSITION: tall portrait framing, main subject in the upper two thirds, the lowest quarter of the frame calm and dark enough for subtitles.`,
    `STRICTLY NO text, letters, captions, speech bubbles, logos, watermarks, borders or split panels. No gore.`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ───────────────────────────── providers ─────────────────────────────

async function send(url, init, timeoutMs = 300000) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw Object.assign(new Error(`เชื่อมต่อบริการสร้างภาพไม่ได้ (${err.cause?.code || err.name})`), { code: 'network' });
  }
  const type = res.headers.get('content-type') || '';
  if (res.ok && type.startsWith('image/')) return { binary: Buffer.from(await res.arrayBuffer()), type };
  const raw = await res.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  if (!res.ok) {
    const msg = json?.error?.message || json?.errors?.[0]?.message || raw.slice(0, 200);
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : 'http';
    throw Object.assign(new Error(`บริการสร้างภาพตอบกลับ ${res.status}: ${msg}`), { code, status: res.status });
  }
  return { json };
}

const postJson = (url, headers, body) => send(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

function postForm(url, headers, fields, files) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  for (const f of files) form.append(f.field, new Blob([f.data], { type: f.type || 'image/png' }), f.name || 'ref.png');
  return send(url, { method: 'POST', headers, body: form });
}

/** @param {{w:number,h:number}} size  @param {{data:Buffer}[]} refs */
export function cloudflareRequest(prompt, { size, refs = [], seed } = {}, env = process.env) {
  const model = env.NITHAN_CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-9b';
  return {
    url: `${env.CLOUDFLARE_BASE_URL || 'https://api.cloudflare.com/client/v4'}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    fields: { prompt, width: size.w, height: size.h, ...(seed ? { seed } : {}) },
    files: refs.slice(0, 4).map((r, i) => ({ field: `input_image_${i}`, data: r.data, name: `ref${i}.png` })),
  };
}

export function geminiRequest(prompt, { refs = [], portrait = false } = {}, env = process.env) {
  const model = env.NITHAN_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  return {
    url: `${env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`,
    headers: { 'x-goog-api-key': geminiKey(env) },
    body: {
      contents: [{ parts: [...refs.map((r) => ({ inlineData: { mimeType: 'image/png', data: r.data.toString('base64') } })), { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: portrait ? '1:1' : '9:16' } },
    },
  };
}

export function openaiRequest(prompt, { refs = [], portrait = false } = {}, env = process.env) {
  const base = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const fields = { model: env.NITHAN_OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size: portrait ? '1024x1024' : '1024x1536', quality: env.NITHAN_OPENAI_IMAGE_QUALITY || 'medium', n: 1 };
  return {
    url: refs.length ? `${base}/images/edits` : `${base}/images/generations`,
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    fields,
    files: refs.map((r, i) => ({ field: 'image[]', data: r.data, name: `ref${i}.png` })),
  };
}

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const sniff = (buf) => (buf[0] === 0xff && buf[1] === 0xd8 ? '.jpg' : buf.slice(0, 4).toString('latin1') === 'RIFF' ? '.webp' : '.png');
const multiple = (n, m = 16) => Math.max(m, Math.round(n / m) * m);

/** Scene size for providers that take pixels (WxH via NITHAN_IMAGE_SIZE, default 864x1536). */
export function sceneSize(env = process.env) {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(env.NITHAN_IMAGE_SIZE || '');
  return m ? { w: multiple(+m[1]), h: multiple(+m[2]) } : { w: 864, h: 1536 };
}

/**
 * @param {'cloudflare'|'gemini'|'openai'} provider
 * @param {{refs?:{data:Buffer}[], portrait?:boolean, seed?:number}} [opts]
 * @returns {Promise<{data:Buffer, ext:string}>}
 */
export async function generateImage(provider, prompt, opts = {}, env = process.env) {
  if (provider === 'cloudflare') {
    const size = opts.portrait ? { w: 512, h: 512 } : sceneSize(env);
    const r = cloudflareRequest(prompt, { ...opts, size }, env);
    const out = await postForm(r.url, r.headers, r.fields, r.files);
    if (out.binary) return { data: out.binary, ext: EXT[out.type.split(';')[0]] || sniff(out.binary) };
    const b64 = out.json?.result?.image || out.json?.image;
    if (!b64) throw new Error('Cloudflare ไม่ได้ส่งภาพกลับมา' + (out.json?.errors?.[0]?.message ? ` (${out.json.errors[0].message})` : ''));
    const data = Buffer.from(b64, 'base64');
    return { data, ext: sniff(data) };
  }
  if (provider === 'gemini') {
    const r = geminiRequest(prompt, opts, env);
    const { json } = await postJson(r.url, r.headers, r.body);
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = part?.inlineData || part?.inline_data;
    if (!inline) throw new Error('Gemini ไม่ได้ส่งภาพกลับมา (' + (json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'ไม่ทราบสาเหตุ') + ')');
    return { data: Buffer.from(inline.data, 'base64'), ext: EXT[inline.mimeType || inline.mime_type] || '.png' };
  }
  if (provider === 'openai') {
    const r = openaiRequest(prompt, opts, env);
    const { json } = r.files.length ? await postForm(r.url, r.headers, r.fields, r.files) : await postJson(r.url, r.headers, r.fields);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI ไม่ได้ส่งภาพกลับมา');
    return { data: Buffer.from(b64, 'base64'), ext: '.png' };
  }
  throw new Error(`ไม่รู้จักผู้ให้บริการภาพ ${provider}`);
}

// ───────────────────────────── orchestration ─────────────────────────────

async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.code === 'auth' || err.code === 'network') break; // retrying cannot help
    }
  }
  throw lastErr;
}

const seedOf = (text) => [...String(text)].reduce((h, ch) => (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0, 7) % 2147483647 || 1;

/**
 * Make sure every character has a reference portrait at characters/<id>.<ext> (sets character.ref).
 * Portraits found in `refsDir` (the previous episode's characters/ folder) are reused so faces persist across a series.
 */
export async function ensureCharacterRefs(sb, projectDir, provider, { generate = generateImage, refsDir, onProgress, redo = false } = {}) {
  const dir = path.join(projectDir, 'characters');
  await fs.mkdir(dir, { recursive: true });
  const find = async (folder, id) => (await fs.readdir(folder).catch(() => [])).find((f) => f.startsWith(id + '.'));
  const chars = sb.characters || [];
  let n = 0;
  for (const c of chars) {
    let file = redo ? null : await find(dir, c.id);
    if (!file && refsDir && !redo) {
      const prev = await find(refsDir, c.id);
      if (prev) {
        await fs.copyFile(path.join(refsDir, prev), path.join(dir, prev));
        file = prev;
      }
    }
    if (!file) {
      onProgress?.({ progress: n / chars.length, message: `ออกแบบหน้าตาตัวละคร “${c.name}” เพื่อล็อกให้เหมือนกันทุกฉาก…` });
      const img = await withRetry(() => generate(provider, buildPortraitPrompt(sb, c), { portrait: true, seed: seedOf(sb.id + c.id) }));
      file = c.id + img.ext;
      await fs.writeFile(path.join(dir, file), img.data);
    }
    c.ref = `characters/${file}`;
    n++;
  }
  return sb;
}

/**
 * Paint scenes with an image model. Same contract as generateArt(): writes scenes/sNN.<ext>, sets scene.art.
 * Character portraits are generated first and attached to every scene they appear in (face lock).
 * One retry per image; auth/network errors abort the whole run (retrying every scene would only waste time).
 */
export async function generateRasterArt(sb, projectDir, provider, { onProgress, only, concurrency = 3, generate = generateImage, refsDir, lockFaces = process.env.NITHAN_FACE_LOCK !== '0' } = {}) {
  const dir = path.join(projectDir, 'scenes');
  await fs.mkdir(dir, { recursive: true });
  const jobs = sb.scenes.map((scene, index) => ({ scene, index })).filter((j) => !Array.isArray(only) || !only.length || only.includes(j.scene.id));
  const total = jobs.length;
  if (!total) return sb;

  const SHARE = lockFaces && sb.characters?.length ? 0.2 : 0; // progress share of the portrait step
  if (SHARE) await ensureCharacterRefs(sb, projectDir, provider, { generate, refsDir, onProgress: (ev) => onProgress?.({ ...ev, progress: ev.progress * SHARE }) });
  const refData = new Map();
  for (const c of SHARE ? sb.characters : []) refData.set(c.id, await fs.readFile(path.join(projectDir, c.ref)));

  onProgress?.({ progress: SHARE, message: `${LABEL[provider] || provider} กำลังสร้างภาพสมจริง ${total} ฉาก${SHARE ? ' (ล็อกหน้าตัวละคร)' : ''}…` });
  const seed = seedOf(sb.id || sb.title);
  let next = 0;
  let done = 0;
  let fatal = null;
  const worker = async () => {
    while (next < jobs.length && !fatal) {
      const { scene, index } = jobs[next++];
      const cast = SHARE ? sceneCast(sb, scene).slice(0, 4) : [];
      const refs = cast.map((c) => ({ id: c.id, data: refData.get(c.id) }));
      let img;
      try {
        img = await withRetry(() => generate(provider, buildImagePrompt(sb, scene, refs), { refs, seed: seed + index }));
      } catch (err) {
        fatal = err;
        return;
      }
      // a redraw may replace art that had another extension
      for (const f of await fs.readdir(dir)) if (f.startsWith(scene.id + '.')) await fs.rm(path.join(dir, f));
      const rel = `scenes/${scene.id}${img.ext}`;
      await fs.writeFile(path.join(projectDir, rel), img.data);
      scene.art = rel;
      done++;
      onProgress?.({ progress: SHARE + (1 - SHARE) * (done / total), message: `สร้างภาพฉาก ${index + 1} เสร็จแล้ว (${done}/${total})`, detail: { sceneId: scene.id, art: rel } });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker));
  if (fatal) throw fatal;
  return sb;
}
