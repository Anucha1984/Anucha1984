import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildImagePrompt, buildPortraitPrompt, cloudflareRequest, generateRasterArt, geminiRequest, openaiRequest, pickImageProvider, sceneCast, sceneSize } from '../src/engine/image.js';

const sb = () => ({
  style: 'realistic',
  characters: [{ id: 'chat', name: 'ชาติ', voice: 'male', visual: 'Thai man, 40, orange vest' }],
  scenes: [
    { id: 's01', visual: 'chat rides a motorbike at night', mood: 'tense', lines: [{ speaker: 'narrator', text: 'ก' }] },
    { id: 's02', visual: 'an empty temple road', mood: 'eerie', lines: [{ speaker: 'narrator', text: 'ข' }] },
  ],
});

test('pickImageProvider: auto prefers free Cloudflare, realistic styles require an image model', () => {
  const cf = { CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' };
  assert.equal(pickImageProvider(null, 'thai', {}), 'claude');
  assert.equal(pickImageProvider(null, 'thai', { ...cf, GEMINI_API_KEY: 'k' }), 'cloudflare');
  assert.equal(pickImageProvider(null, 'thai', { GEMINI_API_KEY: 'k' }), 'gemini');
  assert.equal(pickImageProvider(null, 'thai', { OPENAI_API_KEY: 'k' }), 'openai');
  assert.equal(pickImageProvider('claude', 'thai', cf), 'claude');
  assert.equal(pickImageProvider(null, 'thai', { NITHAN_IMAGE: 'claude', GEMINI_API_KEY: 'k' }), 'claude');
  assert.throws(() => pickImageProvider(null, 'realistic', {}), /CLOUDFLARE_API_TOKEN/);
  assert.throws(() => pickImageProvider('cloudflare', 'thai', {}), /CLOUDFLARE_ACCOUNT_ID/);
});

test('prompts: scene cast, face-lock instructions, portrait prompt', () => {
  const b = sb();
  assert.deepEqual(sceneCast(b, b.scenes[0]).map((c) => c.id), ['chat']);
  assert.deepEqual(sceneCast(b, b.scenes[1]), []);
  const p = buildImagePrompt(b, b.scenes[0], [{ id: 'chat' }]);
  assert.match(p, /Photorealistic/);
  assert.match(p, /image 0 is the character "chat"/);
  assert.match(p, /exact face/);
  assert.match(p, /NO text/);
  assert.doesNotMatch(buildImagePrompt(b, b.scenes[1]), /REFERENCE IMAGES/);
  assert.match(buildPortraitPrompt(b, b.characters[0]), /orange vest/);
});

test('request builders', () => {
  const ref = { data: Buffer.from('r') };
  const c = cloudflareRequest('x', { size: { w: 864, h: 1536 }, refs: [ref, ref], seed: 5 }, { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 't' });
  assert.match(c.url, /accounts\/acc\/ai\/run\/@cf\/black-forest-labs\/flux-2/);
  assert.deepEqual(c.files.map((f) => f.field), ['input_image_0', 'input_image_1']);
  assert.equal(c.fields.height, 1536);
  const g = geminiRequest('x', { refs: [ref] }, { GEMINI_API_KEY: 'k' });
  assert.match(g.url, /generateContent$/);
  assert.equal(g.headers['x-goog-api-key'], 'k');
  assert.equal(g.body.contents[0].parts.length, 2);
  assert.equal(g.body.generationConfig.imageConfig.aspectRatio, '9:16');
  assert.match(openaiRequest('x', {}, { OPENAI_API_KEY: 'k' }).url, /generations$/);
  assert.match(openaiRequest('x', { refs: [ref] }, { OPENAI_API_KEY: 'k' }).url, /edits$/);
  assert.deepEqual(sceneSize({ NITHAN_IMAGE_SIZE: '1000x1800' }), { w: 1008, h: 1808 });
});

test('generateRasterArt: portraits first, refs attached to scenes with that character, reuse across episodes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-img-'));
  await fs.mkdir(path.join(dir, 'scenes'));
  await fs.writeFile(path.join(dir, 'scenes/s01.svg'), '<svg/>');
  const board = sb();
  const calls = [];
  let flaky = true;
  const generate = async (provider, prompt, opts) => {
    if (!opts.portrait && flaky) {
      flaky = false;
      throw new Error('flaky');
    }
    calls.push({ portrait: Boolean(opts.portrait), refs: (opts.refs || []).map((r) => r.id) });
    return { data: Buffer.from(opts.portrait ? 'face' : 'img'), ext: '.jpg' };
  };
  const events = [];
  await generateRasterArt(board, dir, 'cloudflare', { onProgress: (e) => events.push(e), generate, concurrency: 1 });
  assert.deepEqual(calls, [{ portrait: true, refs: [] }, { portrait: false, refs: ['chat'] }, { portrait: false, refs: [] }]);
  assert.equal(board.characters[0].ref, 'characters/chat.jpg');
  assert.equal(board.scenes[0].art, 'scenes/s01.jpg');
  assert.deepEqual((await fs.readdir(path.join(dir, 'scenes'))).sort(), ['s01.jpg', 's02.jpg']);
  assert.equal(events.at(-1).progress, 1);

  // next episode: the portrait is copied, not regenerated
  const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-img-'));
  calls.length = 0;
  await generateRasterArt(sb(), dir2, 'cloudflare', { generate, refsDir: path.join(dir, 'characters') });
  assert.equal(calls.filter((c) => c.portrait).length, 0);
  assert.equal((await fs.readFile(path.join(dir2, 'characters/chat.jpg'))).toString(), 'face');

  await assert.rejects(
    generateRasterArt(sb(), dir, 'openai', { lockFaces: false, generate: async () => { throw Object.assign(new Error('bad key'), { code: 'auth' }); } }),
    /bad key/,
  );
  await fs.rm(dir, { recursive: true });
  await fs.rm(dir2, { recursive: true });
});
