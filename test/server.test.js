// Studio server tests (team C). Run: node --test test/
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

process.env.NITHAN_NO_AUTOSTART = '1';
process.env.NITHAN_HOME = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-home-test-'));
for (const k of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'NITHAN_IMAGE']) delete process.env[k];
const { startServer } = await import('../src/server/index.js');

let srv;
let outDir;
const J = { 'Content-Type': 'application/json' };

before(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-studio-test-'));
  srv = await startServer({ port: 0, outDir, quiet: true });
});
after(async () => {
  await srv.queue.idle();
  await srv.close();
  await fs.rm(outDir, { recursive: true, force: true });
});

/** Raw request so the path is sent verbatim (fetch would normalise ../). */
function raw(method, rawPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: srv.port, method, path: rawPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Read SSE events until `until(ev)` is true or the stream ends. */
async function readEvents(jobId, until) {
  const res = await fetch(`${srv.url}/api/jobs/${jobId}/events`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const events = [];
  const dec = new TextDecoder();
  let buf = '';
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
        if (!data) continue;
        const ev = JSON.parse(data);
        events.push(ev);
        if (until(ev)) return events;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return events;
}

async function mockProject(prompt = 'ปลาบู่ทอง') {
  const res = await fetch(`${srv.url}/api/jobs`, { method: 'POST', headers: J, body: JSON.stringify({ prompt, genre: 'folktale', mock: true, tts: 'none' }) });
  assert.equal(res.status, 202);
  const { jobId } = await res.json();
  assert.match(jobId, /^j[a-f0-9]{12}$/);
  // The render stage may fail (renderer absent / no Chromium in CI): either terminal event is fine here.
  const events = await readEvents(jobId, (ev) => ev.stage === 'done' || ev.stage === 'error');
  const sb = events.find((e) => e.detail?.storyboard)?.detail.storyboard;
  return { jobId, events, sb };
}

test('GET /api/presets exposes genres/styles/lengths without the long prompts', async () => {
  const res = await fetch(`${srv.url}/api/presets`);
  assert.equal(res.status, 200);
  const p = await res.json();
  assert.deepEqual(Object.keys(p.genres).sort(), ['cdrama', 'folktale', 'ghost']);
  assert.ok(p.styles.pixar.swatch.length >= 4);
  assert.ok(p.lengths.short.scenes > 0);
  assert.equal(p.defaults.genre, 'folktale');
  for (const g of Object.values(p.genres)) assert.equal(g.writing, undefined);
  for (const s of Object.values(p.styles)) assert.equal(s.art, undefined);
  assert.ok(p.genres.folktale.examples.includes('ปลาบู่ทอง'));
  assert.equal(p.image.provider, 'claude');
  assert.equal(p.image.realistic, false);
  for (const s of Object.values(p.styles)) assert.equal(s.photo, undefined);
});

test('settings API saves keys to the config file, masks them and flips the image provider', async () => {
  let res = await fetch(`${srv.url}/api/settings`);
  assert.equal(res.status, 200);
  let d = await res.json();
  assert.equal(d.settings.CLOUDFLARE_API_TOKEN.set, false);
  res = await fetch(`${srv.url}/api/settings`, { method: 'PUT', headers: J, body: JSON.stringify({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok-0123456789' }) });
  assert.equal(res.status, 200);
  d = await res.json();
  assert.equal(d.settings.CLOUDFLARE_API_TOKEN.value, 'tok-…6789');
  assert.equal(d.image.provider, 'cloudflare');
  assert.equal((await (await fetch(`${srv.url}/api/presets`)).json()).image.realistic, true);
  const file = JSON.parse(await fs.readFile(path.join(process.env.NITHAN_HOME, 'config.json'), 'utf8'));
  assert.equal(file.CLOUDFLARE_API_TOKEN, 'tok-0123456789');
  res = await fetch(`${srv.url}/api/settings`, { method: 'PUT', headers: J, body: JSON.stringify({ NOPE: 'x' }) });
  assert.equal(res.status, 400);
  res = await fetch(`${srv.url}/api/settings`, { method: 'PUT', headers: J, body: JSON.stringify({ CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: '' }) });
  assert.equal((await res.json()).image.provider, 'claude');
});

test('static app, fonts and security headers', async () => {
  const page = await fetch(`${srv.url}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await page.text(), /นิทานสตูดิโอ/);
  const font = await fetch(`${srv.url}/fonts/kanit/kanit-thai-600-normal.woff2`);
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  assert.equal((await fetch(`${srv.url}/fonts/evil/x.woff2`)).status, 404);
  assert.equal((await raw('GET', '/fonts/kanit/..%2f..%2fpackage.json')).status, 400);
  assert.equal((await raw('GET', '/', { Host: 'evil.example' })).status, 403);
});

test('id validation on jobs and projects', async () => {
  assert.equal((await fetch(`${srv.url}/api/jobs/not-a-job`)).status, 400);
  assert.equal((await fetch(`${srv.url}/api/jobs/j000000000000`)).status, 404);
  assert.equal((await fetch(`${srv.url}/api/projects/Bad_ID!`)).status, 400);
  assert.equal((await fetch(`${srv.url}/api/projects/does-not-exist`)).status, 404);
  assert.equal((await raw('DELETE', '/api/projects/..')).status, 400);
  assert.equal((await raw('GET', '/api/projects/%2e%2e')).status, 400);
  assert.equal((await fetch(`${srv.url}/api/projects/does-not-exist/scenes/zz/redraw`, { method: 'POST', headers: J, body: '{}' })).status, 400);
});

test('POST /api/jobs validates input and refuses cross-site / non-JSON requests', async () => {
  const post = (body, headers = J) => fetch(`${srv.url}/api/jobs`, { method: 'POST', headers, body });
  assert.equal((await post(JSON.stringify({ prompt: '   ' }))).status, 400);
  assert.equal((await post(JSON.stringify({ prompt: 'x', genre: 'nope' }))).status, 400);
  assert.equal((await post(JSON.stringify({ prompt: 'x', style: '__proto__' }))).status, 400);
  assert.equal((await post('{bad json')).status, 400);
  assert.equal((await post(JSON.stringify({ prompt: 'x', mock: true }), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(JSON.stringify({ prompt: 'x', mock: true }), { ...J, Origin: 'http://evil.example' })).status, 403);
  assert.equal((await post(JSON.stringify({ prompt: 'ก'.repeat(600 * 1024) }))).status, 413);
});

test('mock job streams events up to the storyboard and art stages; project is listed and served', async () => {
  const { jobId, events, sb } = await mockProject();
  assert.ok(sb, 'storyboard event received');
  assert.equal(sb.title, 'ปลาบู่ทอง');
  assert.match(sb.id, /^[a-z0-9][a-z0-9-]*$/);
  const stages = events.map((e) => e.stage);
  assert.ok(stages.includes('storyboard'));
  const art = events.filter((e) => e.stage === 'art' && e.detail?.sceneId);
  assert.equal(art.length, sb.scenes.length);
  assert.equal(art[0].detail.art, 'scenes/s01.svg');
  for (const e of events) assert.ok(e.progress >= 0 && e.progress <= 1);

  // snapshot + replay for a late subscriber (page reload)
  const snap = await (await fetch(`${srv.url}/api/jobs/${jobId}`)).json();
  assert.ok(['done', 'error'].includes(snap.status));
  assert.equal(snap.projectId, sb.id);
  const replay = await readEvents(jobId, () => false);
  assert.ok(replay.some((e) => e.detail?.storyboard));
  assert.ok(['done', 'error'].includes(replay.at(-1).stage));

  const { projects } = await (await fetch(`${srv.url}/api/projects`)).json();
  const item = projects.find((p) => p.id === sb.id);
  assert.ok(item);
  assert.equal(item.genre, 'folktale');
  assert.ok(item.poster.startsWith(`/media/${sb.id}/`));

  // media: SVG is sandboxed, Range works, traversal is rejected
  const svg = await fetch(`${srv.url}/media/${sb.id}/scenes/s01.svg`);
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(svg.headers.get('content-security-policy'), /sandbox/);
  assert.match(svg.headers.get('content-security-policy'), /script-src 'none'/);
  const part = await fetch(`${srv.url}/media/${sb.id}/scenes/s01.svg`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(part.status, 206);
  assert.match(part.headers.get('content-range'), /^bytes 0-9\/\d+$/);
  assert.equal((await part.arrayBuffer()).byteLength, 10);
  assert.equal((await fetch(`${srv.url}/media/${sb.id}/scenes/s01.svg`, { headers: { Range: 'bytes=999999999-' } })).status, 416);

  for (const p of [
    `/media/${sb.id}/../../package.json`,
    `/media/${sb.id}/..%2f..%2fpackage.json`,
    `/media/${sb.id}/%2e%2e/%2e%2e/package.json`,
    `/media/${sb.id}/scenes/..%5c..%5cstoryboard.json`,
    `/media/../${sb.id}/scenes/s01.svg`,
    `/media/${sb.id}/scenes/%00.svg`,
  ]) {
    const r = await raw('GET', p);
    assert.ok([400, 404].includes(r.status), `${p} → ${r.status}`);
    assert.ok(!r.body.toString().includes('"name"'), 'no file content leaked');
  }
  // only media types are served from a project dir (storyboard.json / studio.json are API-only)
  assert.equal((await fetch(`${srv.url}/media/${sb.id}/storyboard.json`)).status, 404);
  // symlink escape
  await fs.symlink(path.resolve('package.json'), path.join(outDir, sb.id, 'leak.srt'));
  assert.equal((await fetch(`${srv.url}/media/${sb.id}/leak.srt`)).status, 404);
});

test('PUT /api/projects/:id only edits whitelisted fields and validates', async () => {
  const { sb } = await mockProject('นิทานทดสอบ');
  const url = `${srv.url}/api/projects/${sb.id}`;
  const put = (body) => fetch(url, { method: 'PUT', headers: J, body: JSON.stringify(body) });
  const current = await (await fetch(url)).json();
  assert.equal(current._studio.mock, true);

  const ok = await put({
    title: 'ชื่อใหม่',
    genre: 'ghost', // not editable → ignored
    id: 'hacked',
    scenes: [{ id: 's02', camera: 'static', visual: 'A new visual', lines: [{ speaker: 'hero', text: 'บรรทัดที่แก้แล้ว' }], art: '../../etc/passwd' }],
  });
  assert.equal(ok.status, 200);
  const saved = await (await fetch(url)).json();
  assert.equal(saved.title, 'ชื่อใหม่');
  assert.equal(saved.genre, 'folktale');
  assert.equal(saved.id, sb.id);
  assert.equal(saved.scenes[1].camera, 'static');
  assert.equal(saved.scenes[1].visual, 'A new visual');
  assert.deepEqual(saved.scenes[1].lines, [{ speaker: 'hero', text: 'บรรทัดที่แก้แล้ว' }]);
  assert.equal(saved.scenes[1].art, 'scenes/s02.svg');
  assert.equal(saved.scenes.length, current.scenes.length);
  assert.equal(saved._studio.needsRender, true);

  assert.equal((await put({ title: '' })).status, 400);
  assert.equal((await put({ title: 42 })).status, 400);
  assert.equal((await put({ scenes: [{ id: 's99', visual: 'x' }] })).status, 400);
  assert.equal((await put({ scenes: [{ id: 's01', camera: 'spin' }] })).status, 400);
  assert.equal((await put({ scenes: [{ id: 's01', lines: [] }] })).status, 400);
  assert.equal((await put({ scenes: [{ id: 's01', lines: [{ speaker: 'narrator', text: '  ' }] }] })).status, 400);
  assert.equal((await put({ scenes: [{ id: 's01', lines: [{ speaker: 'nobody', text: 'สวัสดี' }] }] })).status, 400);
  assert.equal((await fetch(url, { method: 'PUT', headers: J, body: '[1,2]' })).status, 400);
  const after = await (await fetch(url)).json();
  assert.equal(after.title, 'ชื่อใหม่', 'rejected edits change nothing');

  const del = await fetch(url, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.equal((await fetch(url)).status, 404);
});
