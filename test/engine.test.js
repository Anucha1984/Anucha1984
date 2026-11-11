// Engine unit tests — never call Claude.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCliArgs, completeJson, extractJson, parseCliOutput, pickBackend } from '../src/engine/llm.js';
import { buildStoryboardPrompt, cleanThai, generateStoryboard, normalizeStoryboard } from '../src/engine/storyboard.js';
import { buildArtPrompt, checkWellFormed, generateArt, sanitizeSvg } from '../src/engine/art.js';
import { continueInput, helpText, parseArgs } from '../src/engine/args.js';
import { GENRES, STYLES, resolveOptions } from '../src/shared/presets.js';
import { mockStoryboard } from '../src/shared/mock.js';

// ── JSON extraction / repair ──
test('extractJson: plain, fenced, and with chatter around', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('นี่คือผลลัพธ์:\n```json\n{"a":"ปลาบู่ทอง"}\n```\nขอบคุณ'), { a: 'ปลาบู่ทอง' });
  assert.deepEqual(extractJson('Sure! {"a":{"b":[1,2]}} hope it helps'), { a: { b: [1, 2] } });
});

test('extractJson: repairs trailing commas, raw newlines and truncation', () => {
  assert.deepEqual(extractJson('{"a":[1,2,],"b":"x",}'), { a: [1, 2], b: 'x' });
  assert.deepEqual(extractJson('{"a":"บรรทัดหนึ่ง\nบรรทัดสอง"}'), { a: 'บรรทัดหนึ่ง\nบรรทัดสอง' });
  assert.deepEqual(extractJson('{"title":"ผี","scenes":[{"h":"หนึ่ง"},{"h":"สอ'), { title: 'ผี', scenes: [{ h: 'หนึ่ง' }, { h: 'สอ' }] });
  assert.deepEqual(extractJson('{"t":"มี } ในข้อความ { ได้"}'), { t: 'มี } ในข้อความ { ได้' });
  assert.throws(() => extractJson('no json here'), SyntaxError);
});

test('completeJson: retries once with the error fed back, then gives up in Thai', async () => {
  const prompts = [];
  const replies = ['not json at all', '{"ok":true}'];
  const out = await completeJson({ prompt: 'P' }, { llm: async (o) => (prompts.push(o.prompt), replies.shift()) });
  assert.deepEqual(out, { ok: true });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /previous reply could not be used/);

  let calls = 0;
  await assert.rejects(
    completeJson({ prompt: 'P' }, { llm: async () => (calls++, '{"x":1}'), validate: () => { throw new Error('bad shape'); } }),
    /ไม่ตรงรูปแบบ.*bad shape/s,
  );
  assert.equal(calls, 2);
});

test('llm: backend selection and CLI plumbing', () => {
  assert.equal(pickBackend({ ANTHROPIC_API_KEY: 'k' }), 'api');
  assert.equal(pickBackend({}), 'cli');
  assert.equal(pickBackend({ ANTHROPIC_API_KEY: 'k', NITHAN_LLM: 'cli' }), 'cli');
  const args = buildCliArgs({ system: 'SYS', model: 'claude-opus-5-5', effort: 'low' });
  assert.deepEqual(args.slice(0, 3), ['-p', '--output-format', 'json']);
  assert.equal(args[args.indexOf('--system-prompt') + 1], 'SYS');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5-5');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(parseCliOutput('{"type":"result","subtype":"success","is_error":false,"result":"สวัสดี"}'), 'สวัสดี');
  assert.throws(() => parseCliOutput('{"type":"result","is_error":true,"result":"Credit balance is too low"}'), /Credit balance/);
  assert.throws(() => parseCliOutput(''), /ไม่ได้ส่งผลลัพธ์/);
});

// ── storyboard prompt + normalisation ──
test('buildStoryboardPrompt carries genre, style, scene count and idea', () => {
  const { system, prompt } = buildStoryboardPrompt(resolveOptions({ prompt: 'ผีกระสือริมคลอง', genre: 'ghost', style: 'thai-retro', scenes: 5 }));
  assert.ok(system.length > 50);
  assert.ok(prompt.includes('ผีกระสือริมคลอง'));
  assert.ok(prompt.includes(GENRES.ghost.writing));
  assert.ok(prompt.includes(STYLES['thai-retro'].art));
  assert.match(prompt, /Exactly 5 scenes/);
  assert.match(prompt, /episode 1/i);
  assert.match(prompt, /"moral"/);
  assert.doesNotMatch(buildStoryboardPrompt(resolveOptions({ prompt: 'x', genre: 'cdrama' })).prompt, /"moral"/);
});

test('buildStoryboardPrompt continues a series', () => {
  const series = { title: 'วินผีตีสอง', episode: 2, summary: 'ชาติหายตัวไป', nextHook: 'เสื้อวินกลับมา', characters: [{ id: 'chat', name: 'ชาติ', voice: 'male', visual: 'orange vest' }] };
  const { prompt } = buildStoryboardPrompt(resolveOptions({ prompt: 'วินผีตีสอง', genre: 'ghost', series }));
  assert.match(prompt, /EPISODE 3/);
  for (const s of ['วินผีตีสอง', 'ชาติหายตัวไป', 'เสื้อวินกลับมา', 'orange vest', '"episode": 3']) assert.ok(prompt.includes(s), s);
});

test('normalizeStoryboard repairs ids, palette, emojis and series', () => {
  const opts = resolveOptions({ prompt: 'ปลาบู่ทอง', genre: 'folktale', style: 'pixar', scenes: 3, series: { title: 'ปลาบู่ทอง', episode: 1 } });
  const raw = {
    title: 'ปลาบู่ทอง 🐟', logline: 'เรื่องย่อ', hook: 'ก'.repeat(60), palette: ['#112233', 'red', '#abc'],
    characters: [{ id: 'Ueay Girl', name: 'เอื้อย', voice: 'narrator', visual: 'girl' }, { id: 'อ้าย', name: 'อ้าย', voice: 'female', visual: 'x' }],
    scenes: [1, 2, 3].map((i) => ({ heading: 'ฉาก', visual: 'shot of `Ueay Girl`', mood: 'warm', camera: 'spin', lines: [{ speaker: i === 1 ? 'Ueay Girl' : 'เอื้อย', text: 'สวัสดี 😀\nจ้ะ' }, { speaker: 'nobody', text: '' }] })),
  };
  const sb = normalizeStoryboard(raw, opts);
  assert.equal(sb.title, 'ปลาบู่ทอง');
  assert.equal([...sb.hook].length, 40);
  assert.equal(sb.palette.length, 5);
  assert.ok(sb.palette.every((c) => /^#[0-9a-f]{3,6}$/i.test(c)));
  assert.deepEqual(sb.characters.map((c) => c.id), ['ueay-girl', 'c2']);
  assert.equal(sb.characters[0].voice, 'female');
  assert.equal(sb.scenes[0].lines.length, 1);
  assert.equal(sb.scenes[0].lines[0].speaker, 'ueay-girl');
  assert.equal(sb.scenes[1].lines[0].speaker, 'ueay-girl'); // matched by Thai name
  assert.equal(sb.scenes[0].lines[0].text, 'สวัสดี จ้ะ');
  assert.equal(sb.scenes[2].id, 's03');
  assert.equal(sb.genre, 'folktale');
  assert.equal(sb.series.episode, 2);
  assert.throws(() => normalizeStoryboard({ ...raw, scenes: [raw.scenes[0]] }, opts), /expected exactly 3 scenes/);
  assert.equal(cleanThai('**ตีสอง** 👻  แล้ว'), 'ตีสอง แล้ว');
});

test('generateStoryboard: feeds validation errors back and returns a valid storyboard', async () => {
  const opts = resolveOptions({ prompt: 'ทดสอบ', genre: 'ghost', scenes: 3 });
  const good = mockStoryboard(opts);
  const prompts = [];
  const replies = [JSON.stringify({ ...good, scenes: [] }), '```json\n' + JSON.stringify(good) + '\n```'];
  const events = [];
  const sb = await generateStoryboard(opts, { llm: async (o) => (prompts.push(o.prompt), replies.shift()), onProgress: (e) => events.push(e) });
  assert.equal(sb.scenes.length, 3);
  assert.match(prompts[1], /expected exactly 3 scenes but got 0/);
  assert.ok(events.length >= 2 && events.every((e) => typeof e.message === 'string' && e.progress >= 0 && e.progress <= 1));
});

// ── SVG sanitiser + art prompt ──
const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="s01-g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="100" height="100" fill="url(#s01-g)"/><g><path d="M0 0 C10 10 20 20 30 30Z"/><circle cx="5" cy="5" r="2"/><ellipse cx="1" cy="1" rx="1" ry="2"/></g></svg>';

test('sanitizeSvg: extracts, forces size, keeps local refs', () => {
  const r = sanitizeSvg('Here you go:\n```svg\n<?xml version="1.0"?>\n' + GOOD + '\n```\nEnjoy');
  assert.ok(r.ok, r.problems.join());
  assert.ok(r.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920"'));
  assert.ok(r.svg.endsWith('</svg>'));
  assert.ok(r.svg.includes('url(#s01-g)'));
  assert.equal((r.svg.match(/viewBox=/g) || []).length, 1);
});

test('sanitizeSvg: strips scripts, handlers, external refs, text and foreignObject', () => {
  const dirty = GOOD.replace('<g>', '<g onclick="alert(1)" onLoad=\'x()\'><script>alert(1)</script><text x="1" y="2">ผี</text><foreignObject><div>hi</div></foreignObject>' +
    '<image href="https://evil.example/a.png" width="5" height="5"/><use href="#s01-g"/><use xlink:href="http://evil.example/x.svg#a"/><a href="javascript:alert(1)"><rect width="1" height="1" fill="url(https://evil.example/p.svg#x)"/></a>');
  const r = sanitizeSvg(dirty);
  assert.ok(r.ok, r.problems.join());
  for (const bad of ['<script', 'onclick', 'onLoad', 'alert', '<text', 'foreignObject', '<image', 'evil.example', 'javascript', '<a ']) assert.ok(!r.svg.includes(bad), bad);
  assert.ok(r.svg.includes('<use href="#s01-g"/>'));
});

test('sanitizeSvg: rejects missing, truncated and unbalanced SVG', () => {
  assert.equal(sanitizeSvg('ขออภัย วาดไม่ได้').ok, false);
  assert.equal(sanitizeSvg(GOOD.slice(0, -10)).ok, false);
  assert.equal(sanitizeSvg(GOOD.replace('</g>', '')).ok, false);
  assert.equal(checkWellFormed(GOOD), null);
  assert.match(checkWellFormed('<svg><g><path d=""/></svg>'), /mismatched/);
  assert.equal(checkWellFormed('<svg><path d="M0 0" data-x="a>b"/><g></g><g></g><g></g><g></g><g></g><g></g></svg>'), null);
});

test('buildArtPrompt carries the shared style bible', () => {
  const sb = mockStoryboard(resolveOptions({ prompt: 'ผี', genre: 'ghost', style: 'thai-retro', scenes: 3 }));
  sb.scenes[1].visual = 'Close-up of `hero` screaming under a red moon';
  const a = buildArtPrompt(sb, { ...sb.scenes[1], id: 's02' }, 1).prompt;
  const b = buildArtPrompt(sb, { ...sb.scenes[2], id: 's03' }, 2).prompt;
  for (const p of [a, b]) {
    assert.ok(p.includes(STYLES['thai-retro'].art));
    assert.ok(p.includes(sb.palette.join(', ')));
    for (const ch of sb.characters) assert.ok(p.includes(ch.visual));
    assert.match(p, /viewBox="0 0 1080 1920"/);
    assert.match(p, /NO text/);
  }
  assert.ok(a.includes('red moon') && a.includes('`hero` (พระเอก) — APPEARS IN THIS SCENE'));
  assert.ok(a.includes('"s02-"') && b.includes('"s03-"'));
  assert.ok(buildArtPrompt({ ...sb, style: 'pixar' }, sb.scenes[0], 0).prompt.includes(STYLES.pixar.art));
});

test('generateArt: writes files, retries once, falls back to mock art, honours `only`', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-art-'));
  const sb = mockStoryboard(resolveOptions({ prompt: 'ผี', genre: 'ghost', scenes: 3 }));
  sb.scenes.forEach((s, i) => (s.id = `s0${i + 1}`));
  const calls = {};
  const llm = async ({ prompt }) => {
    const n = Number(prompt.match(/Draw scene (\d)/)[1]);
    calls[n] = (calls[n] || 0) + 1;
    if (n === 1) return GOOD;
    if (n === 2) return calls[n] === 1 ? 'oops <svg><g>' : GOOD; // succeeds on retry
    return 'never an svg';
  };
  const events = [];
  await generateArt(sb, dir, { llm, concurrency: 2, onProgress: (e) => events.push(e) });
  assert.deepEqual(calls, { 1: 1, 2: 2, 3: 2 });
  assert.deepEqual(sb.scenes.map((s) => s.art), ['scenes/s01.svg', 'scenes/s02.svg', 'scenes/s03.svg']);
  for (const s of sb.scenes) assert.match(await fs.readFile(path.join(dir, s.art), 'utf8'), /^<svg[^>]*viewBox="0 0 1080 1920"/);
  const done = events.filter((e) => e.detail?.sceneId);
  assert.equal(done.length, 3);
  assert.equal(done.at(-1).progress, 1);
  assert.equal(done.find((e) => e.detail.sceneId === 's03').detail.fallback, true);

  const before = await fs.readFile(path.join(dir, 'scenes/s01.svg'), 'utf8');
  const only = [];
  await generateArt(sb, dir, { llm: async ({ prompt }) => (only.push(prompt.match(/Draw scene (\d)/)[1]), GOOD.replace('#000', '#123')), only: ['s03'] });
  assert.deepEqual(only, ['3']);
  assert.equal(await fs.readFile(path.join(dir, 'scenes/s01.svg'), 'utf8'), before);
  await fs.rm(dir, { recursive: true, force: true });
});

// ── CLI args ──
test('parseArgs: idea + flags', () => {
  const r = parseArgs(['ปลาบู่ทอง', '--genre', 'folktale', '--style=pixar', '-l', 'medium', '--scenes', '8', '--tts', 'none', '--no-music', '--out', 'x', '--mock']);
  assert.equal(r.command, 'create');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.input, { prompt: 'ปลาบู่ทอง', genre: 'folktale', style: 'pixar', length: 'medium', scenes: 8, tts: 'none', music: false, outDir: 'x', mock: true });
  assert.equal(parseArgs(['ผี', 'ตีสอง', '-g', 'ghost']).input.prompt, 'ผี ตีสอง');
});

test('parseArgs: commands, errors, continue', () => {
  assert.equal(parseArgs([]).command, 'help');
  assert.equal(parseArgs(['--help']).command, 'help');
  assert.equal(parseArgs(['list']).command, 'list');
  assert.equal(parseArgs(['studio']).command, 'studio');
  assert.equal(parseArgs(['list', 'ของผี']).command, 'create');
  assert.equal(parseArgs(['x', '--genre', 'scifi']).errors.length, 1);
  assert.equal(parseArgs(['x', '--style', 'cubism', '--scenes', '99', '--bogus']).errors.length, 3);
  assert.equal(parseArgs(['x', '--genre']).errors.length, 1);
  const c = parseArgs(['--continue', 'output/abc']);
  assert.equal(c.command, 'create');
  assert.equal(c.continueDir, 'output/abc');
  assert.match(helpText(), /--continue/);
});

test('continueInput: next episode inherits series, genre, style and characters', () => {
  const prev = { title: 'ผู้โดยสารตีสอง', genre: 'ghost', style: 'thai-retro', scenes: [1, 2, 3, 4], characters: [{ id: 'chat' }], series: { title: 'วินผีตีสอง', episode: 1, summary: 'ส', nextHook: 'ฮ' } };
  const inp = continueInput({ prompt: '' }, prev);
  assert.equal(inp.genre, 'ghost');
  assert.equal(inp.style, 'thai-retro');
  assert.equal(inp.scenes, 4);
  assert.equal(inp.prompt, 'วินผีตีสอง');
  assert.deepEqual(inp.series, { title: 'วินผีตีสอง', episode: 1, summary: 'ส', nextHook: 'ฮ', characters: [{ id: 'chat' }] });
  assert.equal(continueInput({ prompt: 'ไปต่อ', style: 'anime' }, prev).style, 'anime');
  assert.equal(resolveOptions(inp).series.episode, 1);
});
