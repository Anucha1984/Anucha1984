// NiThan Studio server — dependency-free Node http server.
//   npm run studio            → http://127.0.0.1:4173
//   env: PORT, HOST, NITHAN_OUT (output dir, default ./output), NITHAN_NO_AUTOSTART=1
// See docs/CONTRACT.md. JSON API under /api, project files under /media, web app at /.
import http from 'node:http';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMERA_MOVES, DEFAULTS, GENRES, LENGTHS, STYLES, VOICE_ROLES } from '../shared/presets.js';
import { mockSvg } from '../shared/mock.js';
import { createVideo, renderProject } from '../pipeline.js';
import { JobQueue } from './jobs.js';
import { HttpError, ID_RE, ProjectStore, SCENE_RE, applyEdits, guessLength, safeRel } from './projects.js';
import { isSafeSegment, resolveInside, sendFile } from './files.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB_DIR = path.join(ROOT, 'web');
const FONT_FAMILIES = ['kanit', 'sarabun', 'charm', 'chakra-petch', 'mitr'];
const FONT_FILE_RE = /^[a-z0-9-]{1,80}\.woff2?$/;
const MEDIA_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mp3', '.m4a', '.wav', '.srt', '.vtt']);
const JOB_RE = /^j[a-f0-9]{12}$/;
const TTS_OPTIONS = ['auto', 'edge', 'openai', 'elevenlabs', 'none'];
const MAX_BODY = 512 * 1024;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const APP_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
// Scene art is model-generated SVG: never let it run script or reach the network when opened directly.
const SVG_CSP = "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

function json(res, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || ''))
      return reject(new HttpError(415, 'ต้องส่งข้อมูลเป็น application/json'));
    if (Number(req.headers['content-length']) > MAX_BODY) return reject(new HttpError(413, 'ข้อมูลใหญ่เกินไป'));
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;
      size += c.length;
      if (size > MAX_BODY) {
        failed = true;
        reject(new HttpError(413, 'ข้อมูลใหญ่เกินไป'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) return resolve({});
      try {
        const v = JSON.parse(text);
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
        resolve(v);
      } catch {
        reject(new HttpError(400, 'JSON ไม่ถูกต้อง'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'อ่านข้อมูลไม่สำเร็จ')));
  });
}

const cleanText = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, max);

/** Validate the body of POST /api/jobs into a pipeline input. */
function parseJobInput(body) {
  const prompt = typeof body.prompt === 'string' ? cleanText(body.prompt, 500) : '';
  if (!prompt) throw new HttpError(400, 'กรุณาพิมพ์ชื่อเรื่องหรือไอเดียก่อน');
  const pick = (key, table) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') return undefined;
    if (typeof body[key] !== 'string' || !Object.hasOwn(table, body[key])) throw new HttpError(400, `ค่า ${key} ไม่ถูกต้อง`);
    return body[key];
  };
  const genre = pick('genre', GENRES) ?? DEFAULTS.genre;
  const style = pick('style', STYLES) ?? GENRES[genre].defaultStyle;
  const length = pick('length', LENGTHS) ?? DEFAULTS.length;
  let tts = DEFAULTS.tts;
  if (body.tts === false) tts = 'none';
  else if (typeof body.tts === 'string') {
    if (!TTS_OPTIONS.includes(body.tts)) throw new HttpError(400, 'ค่า tts ไม่ถูกต้อง');
    tts = body.tts;
  }
  return {
    prompt,
    genre,
    style,
    length,
    tts,
    music: body.music === undefined ? DEFAULTS.music : Boolean(body.music),
    mock: Boolean(body.mock),
    series: parseSeries(body.series),
  };
}

function parseSeries(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const title = cleanText(s.title, 200);
  if (!title) return null;
  return {
    title,
    episode: Math.max(1, Math.min(999, Math.floor(Number(s.episode)) || 1)),
    summary: cleanText(s.summary, 2000),
    nextHook: cleanText(s.nextHook, 500),
    characters: (Array.isArray(s.characters) ? s.characters : [])
      .filter((c) => c && typeof c === 'object')
      .slice(0, 20)
      .map((c) => ({ id: cleanText(c.id, 60), name: cleanText(c.name, 120), voice: cleanText(c.voice, 30), visual: cleanText(c.visual, 600) })),
  };
}

function publicPresets() {
  const strip = (table, drop) =>
    Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([f]) => !drop.includes(f)))]));
  return {
    genres: strip(GENRES, ['writing']),
    styles: strip(STYLES, ['art', 'photo']),
    lengths: LENGTHS,
    defaults: DEFAULTS,
    cameraMoves: CAMERA_MOVES,
    voiceRoles: VOICE_ROLES,
    ttsOptions: TTS_OPTIONS,
  };
}

/** Build the request handler + its state (job queue, project store). */
export function createApp({ outDir } = {}) {
  const out = path.resolve(outDir || process.env.NITHAN_OUT || 'output');
  const store = new ProjectStore(out);
  const queue = new JobQueue();
  const fakeRender = process.env.NITHAN_FAKE_RENDER === '1'; // dev only: skip the video stage

  const ensureIdle = (id) => {
    if (queue.activeFor(id)) throw new HttpError(409, 'โปรเจกต์นี้กำลังถูกประมวลผลอยู่ รอให้เสร็จก่อนนะ');
  };
  const ensureRoom = () => {
    if (queue.isFull) throw new HttpError(429, 'คิวเต็มแล้ว รอให้งานก่อนหน้าเสร็จก่อนนะ');
  };

  function startCreateJob(input, kind = 'create') {
    ensureRoom();
    const ascii = input.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
    const idSeed = `${ascii || 'reel'}-${crypto.randomBytes(2).toString('hex')}`;
    const meta = { prompt: input.prompt, length: input.length, tts: input.tts, music: input.music, mock: input.mock };
    const job = queue.add({ kind, title: input.prompt, input }, async (emit) => {
      let metaWritten = false;
      const onProgress = (ev) => {
        const pid = ev?.detail?.storyboard?.id;
        if (pid && !metaWritten) {
          metaWritten = true;
          store.writeMeta(pid, { ...meta, needsRender: true }).catch(() => {});
        }
        emit(ev);
      };
      const { storyboard } = fakeRender
        ? await fakeCreate({ ...input, outDir: out, id: idSeed }, onProgress)
        : await createVideo({ ...input, outDir: out, id: idSeed }, onProgress);
      await store.writeMeta(storyboard.id, { ...meta, needsRender: false });
      return { projectId: storyboard.id, output: storyboard.output };
    });
    return job;
  }

  // Dev switch (NITHAN_FAKE_RENDER=1): run the real pipeline but swallow a failing video stage.
  async function fakeCreate(input, onProgress) {
    let sb = null;
    try {
      return await createVideo(input, (ev) => {
        if (ev?.detail?.storyboard) sb = ev.detail.storyboard;
        onProgress(ev);
      });
    } catch (err) {
      if (!sb?.scenes?.every((s) => s.art)) throw err;
      for (const [stage, p, message] of [['voice', 0.7, '(จำลอง) ข้ามการพากย์เสียง'], ['render', 0.9, '(จำลอง) ข้ามการตัดต่อ']]) {
        onProgress({ stage, progress: p, message });
        await new Promise((r) => setTimeout(r, 400));
      }
      return { storyboard: sb };
    }
  }

  function startRenderJob(id, sb, opts) {
    ensureRoom();
    ensureIdle(id);
    const dir = store.dir(id);
    return queue.add({ kind: 'render', title: sb.title, projectId: id, input: opts }, async (emit) => {
      emit({ stage: 'voice', progress: 0.6, message: 'กำลังเตรียมพากย์และตัดต่อใหม่…' });
      const done = await renderProject(dir, opts, emit);
      await store.writeMeta(id, { needsRender: false, tts: opts.tts, music: opts.music });
      return { projectId: id, output: done.output };
    });
  }

  function startRedrawJob(id, sb, sceneId, opts) {
    ensureRoom();
    ensureIdle(id);
    const dir = store.dir(id);
    const index = sb.scenes.findIndex((s) => s.id === sceneId);
    return queue.add({ kind: 'redraw', title: sb.title, projectId: id, input: { ...opts, sceneId } }, async (emit) => {
      emit({ stage: 'art', progress: 0.15, message: `กำลังวาดฉากที่ ${index + 1} ใหม่…` });
      const fresh = await store.load(id);
      const scene = fresh.scenes[index];
      if (!scene) throw new Error('ไม่พบฉากนี้แล้ว');
      if (opts.mock) {
        scene.art = `scenes/${scene.id}.svg`;
        await fsp.mkdir(path.join(dir, 'scenes'), { recursive: true });
        await fsp.writeFile(path.join(dir, scene.art), mockSvg(fresh, index + 1 + Math.floor(Math.random() * 7)));
        await new Promise((r) => setTimeout(r, 300));
      } else {
        const { generateArt } = await import('../engine/index.js');
        await generateArt(fresh, dir, {
          only: [sceneId],
          onProgress: (ev = {}) => emit({ stage: 'art', message: ev.message, detail: ev.detail, progress: 0.15 + 0.45 * Math.max(0, Math.min(1, ev.progress ?? 0)) }),
        });
      }
      await store.save(id, fresh);
      await store.writeMeta(id, { needsRender: true });
      emit({ stage: 'art', progress: 0.6, message: `วาดฉากที่ ${index + 1} ใหม่แล้ว`, detail: { sceneId, art: fresh.scenes[index].art } });
      if (fakeRender) return { projectId: id };
      const done = await renderProject(dir, opts, emit);
      await store.writeMeta(id, { needsRender: false });
      return { projectId: id, output: done.output };
    });
  }

  async function renderOpts(id, body) {
    const meta = await store.readMeta(id);
    let tts = TTS_OPTIONS.includes(meta.tts) ? meta.tts : DEFAULTS.tts;
    if (body.tts === false) tts = 'none';
    else if (TTS_OPTIONS.includes(body.tts)) tts = body.tts;
    const music = body.music === undefined ? (meta.music ?? DEFAULTS.music) : Boolean(body.music);
    return { tts, music: Boolean(music), mock: body.mock === undefined ? Boolean(meta.mock) : Boolean(body.mock) };
  }

  // ───────────────────────── routes ─────────────────────────
  async function api(req, res, segs) {
    const method = req.method;
    const [, resource, id, sub, subId, action] = segs;

    if (resource === 'presets' && segs.length === 2 && method === 'GET') return json(res, 200, publicPresets());

    if (resource === 'jobs') {
      if (segs.length === 2 && method === 'GET') return json(res, 200, { jobs: queue.list() });
      if (segs.length === 2 && method === 'POST') {
        const job = startCreateJob(parseJobInput(await readJson(req)));
        return json(res, 202, { jobId: job.id });
      }
      if (!JOB_RE.test(id || '')) throw new HttpError(400, 'รหัสงานไม่ถูกต้อง');
      const job = queue.get(id);
      if (!job) throw new HttpError(404, 'ไม่พบงานนี้ (อาจเสร็จไปนานแล้วหรือเซิร์ฟเวอร์เพิ่งเริ่มใหม่)');
      if (segs.length === 3 && method === 'GET') return json(res, 200, queue.snapshot(job));
      if (segs.length === 4 && sub === 'events' && method === 'GET') return sse(req, res, job);
      throw new HttpError(404, 'ไม่พบปลายทางนี้');
    }

    if (resource === 'projects') {
      if (segs.length === 2 && method === 'GET') return json(res, 200, { projects: await store.list() });
      if (!ID_RE.test(id || '')) throw new HttpError(400, 'รหัสโปรเจกต์ไม่ถูกต้อง');

      if (segs.length === 3) {
        if (method === 'GET') {
          const sb = await store.load(id);
          return json(res, 200, { ...sb, _studio: { ...(await store.info(id, sb)), activeJob: queue.activeFor(id)?.id ?? null } });
        }
        if (method === 'PUT') {
          ensureIdle(id);
          const body = await readJson(req);
          const { storyboard, changed } = applyEdits(await store.load(id), body);
          if (changed) {
            await store.save(id, storyboard);
            await store.writeMeta(id, { needsRender: true });
          }
          return json(res, 200, { ...storyboard, _studio: { ...(await store.info(id, storyboard)), activeJob: null, changed } });
        }
        if (method === 'DELETE') {
          ensureIdle(id);
          await store.remove(id);
          return json(res, 200, { ok: true });
        }
      }

      if (method === 'POST' && segs.length === 4 && sub === 'render') {
        const body = await readJson(req);
        const sb = await store.load(id);
        const job = startRenderJob(id, sb, await renderOpts(id, body));
        return json(res, 202, { jobId: job.id });
      }
      if (method === 'POST' && segs.length === 4 && sub === 'next-episode') {
        const body = await readJson(req);
        const sb = await store.load(id);
        const meta = await store.readMeta(id);
        const opts = await renderOpts(id, body);
        const series = parseSeries({
          title: sb.series?.title || sb.title,
          episode: sb.series?.episode,
          summary: sb.series?.summary || sb.logline,
          nextHook: sb.series?.nextHook,
          characters: sb.series?.characters || sb.characters,
        });
        const input = parseJobInput({
          prompt: typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt : series.title,
          genre: sb.genre,
          style: sb.style,
          length: guessLength(sb, meta),
          tts: opts.tts,
          music: opts.music,
          mock: opts.mock,
          series,
        });
        input.refsDir = path.join(store.dir(id), 'characters'); // keep the same faces across episodes
        const job = startCreateJob(input, 'episode');
        return json(res, 202, { jobId: job.id });
      }
      if (method === 'POST' && segs.length === 6 && sub === 'scenes' && action === 'redraw') {
        if (!SCENE_RE.test(subId || '')) throw new HttpError(400, 'รหัสฉากไม่ถูกต้อง');
        const body = await readJson(req);
        const sb = await store.load(id);
        if (!sb.scenes?.some((s) => s.id === subId)) throw new HttpError(404, 'ไม่พบฉากนี้');
        const job = startRedrawJob(id, sb, subId, await renderOpts(id, body));
        return json(res, 202, { jobId: job.id });
      }
    }
    throw new HttpError(404, 'ไม่พบปลายทางนี้');
  }

  function sse(req, res, job) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    let beat = null;
    const end = () => {
      clearInterval(beat);
      res.end();
    };
    const unsubscribe = queue.subscribe(job, (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`), end);
    beat = setInterval(() => res.write(': ping\n\n'), 15000);
    beat.unref?.();
    if (res.writableEnded) clearInterval(beat);
    req.on('close', () => {
      clearInterval(beat);
      unsubscribe();
    });
  }

  async function media(req, res, segs, query) {
    const [, id, ...rest] = segs;
    if (!ID_RE.test(id || '')) throw new HttpError(400, 'รหัสโปรเจกต์ไม่ถูกต้อง');
    const ext = path.extname(rest[rest.length - 1] || '').toLowerCase();
    if (!rest.length || rest.length > 4 || !MEDIA_EXT.has(ext)) throw new HttpError(404, 'ไม่พบไฟล์');
    const found = await resolveInside(store.dir(id), rest);
    if (!found) throw new HttpError(404, 'ไม่พบไฟล์');
    const headers = {};
    if (ext === '.svg') headers['Content-Security-Policy'] = SVG_CSP;
    if (query.has('download')) {
      const name = `${id}-${rest[rest.length - 1]}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      headers['Content-Disposition'] = `attachment; filename="${name}"`;
    }
    sendFile(req, res, found, headers);
  }

  async function fonts(req, res, segs) {
    const [, family, file] = segs;
    if (segs.length !== 3 || !FONT_FAMILIES.includes(family) || !FONT_FILE_RE.test(file)) throw new HttpError(404, 'ไม่พบฟอนต์');
    const found = await resolveInside(path.join(ROOT, 'node_modules', '@fontsource', family, 'files'), [file]);
    if (!found) throw new HttpError(404, 'ไม่พบฟอนต์');
    sendFile(req, res, found, { 'Cache-Control': 'public, max-age=31536000, immutable' });
  }

  async function staticWeb(req, res, segs) {
    const found = await resolveInside(WEB_DIR, segs.length ? segs : ['index.html']);
    if (!found) throw new HttpError(404, 'ไม่พบหน้านี้');
    sendFile(req, res, found, { 'Content-Security-Policy': APP_CSP, 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
  }

  async function handle(req, res) {
    const url = String(req.url || '/');
    const q = url.indexOf('?');
    const rawPath = q === -1 ? url : url.slice(0, q);
    const query = new URLSearchParams(q === -1 ? '' : url.slice(q + 1));
    if (!rawPath.startsWith('/') || rawPath.length > 1024) throw new HttpError(400, 'คำขอไม่ถูกต้อง');

    let segs;
    try {
      segs = rawPath.split('/').slice(1).map((s) => decodeURIComponent(s));
    } catch {
      throw new HttpError(400, 'คำขอไม่ถูกต้อง');
    }
    if (segs.length && segs[segs.length - 1] === '') segs.pop(); // trailing slash
    if (!segs.every(isSafeSegment)) throw new HttpError(400, 'เส้นทางไม่ถูกต้อง');

    const safe = req.method === 'GET' || req.method === 'HEAD';
    if (!safe) {
      // Same-origin only: a foreign web page must not be able to drive the studio.
      const origin = req.headers.origin;
      if (origin) {
        let originHost = null;
        try {
          originHost = new URL(origin).host;
        } catch {
          /* malformed */
        }
        if (originHost !== req.headers.host) throw new HttpError(403, 'ไม่อนุญาตคำขอข้ามเว็บไซต์');
      }
    }

    if (segs[0] === 'api') {
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) throw new HttpError(405, 'ไม่รองรับวิธีนี้');
      return api(req, res, segs);
    }
    if (!safe) throw new HttpError(405, 'ไม่รองรับวิธีนี้');
    if (segs[0] === 'media') return media(req, res, segs, query);
    if (segs[0] === 'fonts') return fonts(req, res, segs);
    return staticWeb(req, res, segs);
  }

  function handler(req, res) {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('[studio]', err);
      if (res.headersSent) return res.destroy();
      json(res, status, { error: status === 500 ? 'เซิร์ฟเวอร์ขัดข้อง: ' + String(err?.message || err).slice(0, 200) : err.message });
    });
  }

  return { handler, queue, store, outDir: out };
}

/**
 * Start the studio server.
 * @param {{port?:number, host?:string, outDir?:string, quiet?:boolean}} [opts]
 * @returns {Promise<{server:http.Server, port:number, host:string, url:string, outDir:string, close:()=>Promise<void>}>}
 */
export async function startServer(opts = {}) {
  const host = opts.host || process.env.HOST || '127.0.0.1';
  const port = opts.port ?? (process.env.PORT !== undefined && process.env.PORT !== '' ? Number(process.env.PORT) : 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT ไม่ถูกต้อง: ${process.env.PORT}`);
  if (autoStarted && opts.port === undefined && !opts.outDir) return autoStarted; // `nithan studio` importing an already auto-started module

  const app = createApp({ outDir: opts.outDir });
  await fsp.mkdir(app.outDir, { recursive: true });
  const loopbackOnly = LOOPBACK.has(host);
  const server = http.createServer((req, res) => {
    // DNS-rebinding guard: when bound to loopback, only answer to loopback Host headers.
    if (loopbackOnly) {
      const hostname = String(req.headers.host || '').replace(/:\d+$/, '');
      if (!LOOPBACK.has(hostname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('forbidden host');
      }
    }
    app.handler(req, res);
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 20_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const actual = server.address().port;
  const url = `http://${host.includes(':') ? `[${host}]` : host === '0.0.0.0' ? 'localhost' : host}:${actual}`;
  if (!opts.quiet) {
    console.log(`\n  นิทานสตูดิโอ (NiThan Studio) พร้อมแล้ว  →  ${url}`);
    console.log(`  โฟลเดอร์ผลงาน: ${app.outDir}`);
    if (!loopbackOnly) console.log('  หมายเหตุ: เปิดให้เครื่องอื่นในเครือข่ายเข้าถึงได้ (HOST) ใช้เฉพาะในเครือข่ายที่ไว้ใจ');
    console.log('  กด Ctrl+C เพื่อปิด\n');
  }
  return {
    server,
    port: actual,
    host,
    url,
    outDir: app.outDir,
    queue: app.queue,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

// Auto-start when run directly (`npm run studio`) or imported by `nithan studio`.
let autoStarted = null;
if (!process.env.NITHAN_NO_AUTOSTART) {
  autoStarted = startServer().catch((err) => {
    autoStarted = null;
    if (err?.code === 'EADDRINUSE') console.error(`พอร์ตนี้ถูกใช้อยู่แล้ว ลองกำหนดพอร์ตอื่น เช่น PORT=4174 npm run studio`);
    else console.error('เปิดสตูดิโอไม่สำเร็จ:', err?.message || err);
    process.exitCode = 1;
    return null;
  });
}
