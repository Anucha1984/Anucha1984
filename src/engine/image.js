// Raster scene art from an image model (photoreal / cinematic looks that SVG cannot do).
// Claude still writes the script and the per-scene art direction; the image model paints it.
//
//   NITHAN_IMAGE = auto | claude | gemini | openai     (CLI: --image)
//   auto → gemini if GEMINI_API_KEY (or GOOGLE_API_KEY), else openai if OPENAI_API_KEY, else claude (SVG)
import fs from 'node:fs/promises';
import path from 'node:path';
import { STYLES } from '../shared/presets.js';

export const IMAGE_PROVIDERS = ['auto', 'claude', 'gemini', 'openai'];

const geminiKey = (env) => env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';

/** Resolve which provider draws the art. Returns 'claude' (SVG) | 'gemini' | 'openai'. Throws a Thai error when impossible. */
export function pickImageProvider(requested, styleId, env = process.env) {
  const want = IMAGE_PROVIDERS.includes(requested) ? requested : env.NITHAN_IMAGE || 'auto';
  const style = STYLES[styleId];
  if (want === 'gemini') {
    if (!geminiKey(env)) throw new Error('เลือก --image gemini แต่ยังไม่ได้ตั้งค่า GEMINI_API_KEY');
    return 'gemini';
  }
  if (want === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('เลือก --image openai แต่ยังไม่ได้ตั้งค่า OPENAI_API_KEY');
    return 'openai';
  }
  if (want === 'auto') {
    if (geminiKey(env)) return 'gemini';
    if (env.OPENAI_API_KEY) return 'openai';
  }
  if (style?.needsImageModel) {
    throw new Error(
      `ลายเส้น "${style.name}" เป็นภาพสมจริง ต้องใช้โมเดลสร้างภาพ กรุณาตั้งค่า GEMINI_API_KEY หรือ OPENAI_API_KEY ก่อน ` +
        '(Claude วาดได้เฉพาะภาพเวกเตอร์แนวการ์ตูน)',
    );
  }
  return 'claude';
}

/** One self-contained English prompt for an image model. */
export function buildImagePrompt(sb, scene) {
  const style = STYLES[sb.style] || Object.values(STYLES)[0];
  const text = `${scene.visual} ${scene.lines?.map((l) => l.speaker).join(' ') ?? ''}`.toLowerCase();
  const cast = (sb.characters || []).filter((c) => text.includes(c.id.toLowerCase()) || scene.visual.includes(c.name));
  const sheets = (cast.length ? cast : sb.characters || []).slice(0, 4).map((c) => `- ${c.id}: ${c.visual}`);
  return [
    `Vertical 9:16 illustration for a Thai short-form story video. One single full-frame image.`,
    `STYLE: ${style.photo || style.art}`,
    `SCENE: ${scene.visual}`,
    `MOOD: ${scene.mood}.`,
    sheets.length ? `CHARACTERS (keep each one's face, age, hair and clothing exactly as described, identical in every image of this series):\n${sheets.join('\n')}` : '',
    `SETTING: Thailand unless the scene says otherwise; Thai faces, clothing, architecture and props.`,
    `COMPOSITION: tall portrait framing, main subject in the upper two thirds, the lowest quarter of the frame calm and dark enough for subtitles.`,
    `STRICTLY NO text, letters, captions, speech bubbles, logos, watermarks, borders or split panels. No gore.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function postJson(url, headers, body, timeoutMs = 180000) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw Object.assign(new Error(`เชื่อมต่อบริการสร้างภาพไม่ได้ (${err.cause?.code || err.name})`), { code: 'network' });
  }
  const raw = await res.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  if (!res.ok) {
    const msg = json?.error?.message || raw.slice(0, 200);
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : 'http';
    throw Object.assign(new Error(`บริการสร้างภาพตอบกลับ ${res.status}: ${msg}`), { code, status: res.status });
  }
  return json;
}

export function geminiRequest(prompt, env = process.env) {
  const model = env.NITHAN_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  return {
    url: `${env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`,
    headers: { 'x-goog-api-key': geminiKey(env) },
    body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } } },
  };
}

export function openaiRequest(prompt, env = process.env) {
  return {
    url: `${env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/images/generations`,
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: { model: env.NITHAN_OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size: '1024x1536', quality: env.NITHAN_OPENAI_IMAGE_QUALITY || 'medium', n: 1 },
  };
}

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

/** @returns {Promise<{data:Buffer, ext:string}>} */
export async function generateImage(provider, prompt, env = process.env) {
  if (provider === 'gemini') {
    const r = geminiRequest(prompt, env);
    const json = await postJson(r.url, r.headers, r.body);
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = part?.inlineData || part?.inline_data;
    if (!inline) throw new Error('Gemini ไม่ได้ส่งภาพกลับมา (' + (json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'ไม่ทราบสาเหตุ') + ')');
    return { data: Buffer.from(inline.data, 'base64'), ext: EXT[inline.mimeType || inline.mime_type] || '.png' };
  }
  if (provider === 'openai') {
    const r = openaiRequest(prompt, env);
    const json = await postJson(r.url, r.headers, r.body, 300000);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI ไม่ได้ส่งภาพกลับมา');
    return { data: Buffer.from(b64, 'base64'), ext: '.png' };
  }
  throw new Error(`ไม่รู้จักผู้ให้บริการภาพ ${provider}`);
}

/**
 * Paint scenes with an image model. Same contract as generateArt(): writes scenes/sNN.<ext>, sets scene.art.
 * One retry per scene; auth/network errors abort the whole run (retrying every scene would only waste time).
 */
export async function generateRasterArt(sb, projectDir, provider, { onProgress, only, concurrency = 3, generate = generateImage } = {}) {
  const dir = path.join(projectDir, 'scenes');
  await fs.mkdir(dir, { recursive: true });
  const jobs = sb.scenes.map((scene, index) => ({ scene, index })).filter((j) => !Array.isArray(only) || !only.length || only.includes(j.scene.id));
  const total = jobs.length;
  if (!total) return sb;
  const label = provider === 'gemini' ? 'Gemini' : 'OpenAI';
  onProgress?.({ progress: 0, message: `${label} กำลังสร้างภาพสมจริง ${total} ฉาก…` });
  let next = 0;
  let done = 0;
  let fatal = null;
  const worker = async () => {
    while (next < jobs.length && !fatal) {
      const { scene, index } = jobs[next++];
      const prompt = buildImagePrompt(sb, scene);
      let img = null;
      let lastErr = null;
      for (let attempt = 0; attempt < 2 && !img; attempt++) {
        try {
          img = await generate(provider, prompt);
        } catch (err) {
          lastErr = err;
          if (err.code === 'auth' || err.code === 'network') break;
        }
      }
      if (!img) {
        fatal = lastErr;
        return;
      }
      // a redraw may replace art that had another extension
      for (const f of await fs.readdir(dir)) if (f.startsWith(scene.id + '.')) await fs.rm(path.join(dir, f));
      const rel = `scenes/${scene.id}${img.ext}`;
      await fs.writeFile(path.join(projectDir, rel), img.data);
      scene.art = rel;
      done++;
      onProgress?.({ progress: done / total, message: `สร้างภาพฉาก ${index + 1} เสร็จแล้ว (${done}/${total})`, detail: { sceneId: scene.id, art: rel } });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker));
  if (fatal) throw fatal;
  return sb;
}
