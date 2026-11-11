import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildImagePrompt, generateRasterArt, geminiRequest, openaiRequest, pickImageProvider } from '../src/engine/image.js';

const sb = () => ({
  style: 'realistic',
  characters: [{ id: 'chat', name: 'ชาติ', voice: 'male', visual: 'Thai man, 40, orange vest' }],
  scenes: [
    { id: 's01', visual: 'chat rides a motorbike at night', mood: 'tense', lines: [{ speaker: 'narrator', text: 'ก' }] },
    { id: 's02', visual: 'an empty temple road', mood: 'eerie', lines: [{ speaker: 'narrator', text: 'ข' }] },
  ],
});

test('pickImageProvider: auto prefers keys, realistic styles require an image model', () => {
  assert.equal(pickImageProvider(null, 'thai', {}), 'claude');
  assert.equal(pickImageProvider(null, 'thai', { GEMINI_API_KEY: 'k' }), 'gemini');
  assert.equal(pickImageProvider(null, 'thai', { OPENAI_API_KEY: 'k' }), 'openai');
  assert.equal(pickImageProvider('claude', 'thai', { OPENAI_API_KEY: 'k' }), 'claude');
  assert.equal(pickImageProvider(null, 'thai', { NITHAN_IMAGE: 'claude', GEMINI_API_KEY: 'k' }), 'claude');
  assert.throws(() => pickImageProvider(null, 'realistic', {}), /GEMINI_API_KEY/);
  assert.throws(() => pickImageProvider('openai', 'thai', {}), /OPENAI_API_KEY/);
});

test('buildImagePrompt carries style, scene, character sheet and no-text rule', () => {
  const p = buildImagePrompt(sb(), sb().scenes[0]);
  assert.match(p, /Photorealistic/);
  assert.match(p, /rides a motorbike/);
  assert.match(p, /orange vest/);
  assert.match(p, /NO text/);
});

test('request builders', () => {
  const g = geminiRequest('x', { GEMINI_API_KEY: 'k' });
  assert.match(g.url, /generateContent$/);
  assert.equal(g.headers['x-goog-api-key'], 'k');
  assert.equal(g.body.generationConfig.imageConfig.aspectRatio, '9:16');
  const o = openaiRequest('x', { OPENAI_API_KEY: 'k' });
  assert.equal(o.headers.authorization, 'Bearer k');
  assert.equal(o.body.size, '1024x1536');
});

test('generateRasterArt writes files, replaces old art, retries once, aborts on auth errors', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-img-'));
  await fs.mkdir(path.join(dir, 'scenes'));
  await fs.writeFile(path.join(dir, 'scenes/s01.svg'), '<svg/>');
  const board = sb();
  let calls = 0;
  const events = [];
  await generateRasterArt(board, dir, 'gemini', {
    onProgress: (e) => events.push(e),
    generate: async () => {
      if (++calls === 1) throw new Error('flaky');
      return { data: Buffer.from('img'), ext: '.jpg' };
    },
  });
  assert.equal(board.scenes[0].art, 'scenes/s01.jpg');
  assert.deepEqual((await fs.readdir(path.join(dir, 'scenes'))).sort(), ['s01.jpg', 's02.jpg']);
  assert.equal(events.at(-1).progress, 1);
  await assert.rejects(
    generateRasterArt(sb(), dir, 'openai', { generate: async () => { throw Object.assign(new Error('bad key'), { code: 'auth' }); } }),
    /bad key/,
  );
  await fs.rm(dir, { recursive: true });
});
