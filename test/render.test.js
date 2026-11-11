// Renderer tests (team B). No network. The integration tests skip themselves without ffmpeg/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { GENRES, VOICE_ROLES, resolveOptions } from '../src/shared/presets.js';
import { validateStoryboard } from '../src/shared/schema.js';
import { mockArt, mockStoryboard } from '../src/shared/mock.js';
import { buildTimeline, estimateDuration, FPS } from '../src/render/timeline.js';
import { buildSrt, CAPTION_MAX, chunkCaption, srtTime, timeChunks, tokenize, visibleLength } from '../src/render/captions.js';
import { resolveVoice } from '../src/render/tts/voices.js';
import { postFilters, providerOrder, synthesizeVoices } from '../src/render/tts/index.js';
import * as edge from '../src/render/tts/edge.js';
import * as openai from '../src/render/tts/openai.js';
import * as elevenlabs from '../src/render/tts/elevenlabs.js';
import { audioArgs, cameraFilter, sceneClipArgs } from '../src/render/compose.js';
import { fontFaceCss, resolveFont } from '../src/render/fonts.js';
import { embedFontInSvg } from '../src/render/browser.js';
import { renderVideo } from '../src/render/index.js';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
let hasChromium = false;
try {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const b = await chromium.launch();
  await b.close();
  hasChromium = true;
} catch {
  hasChromium = false;
}

const mockSb = (genre = 'folktale', scenes = 3) => {
  const sb = mockStoryboard(resolveOptions({ prompt: 'ปลาบู่ทอง', genre, scenes }));
  sb.id = 'test';
  sb.createdAt = new Date().toISOString();
  return validateStoryboard(sb);
};

test('estimateDuration: ~14 Thai chars/sec with a floor', () => {
  assert.equal(estimateDuration('ไป'), 1.6);
  assert.equal(estimateDuration(''), 1.6);
  const text = 'กาลครั้งหนึ่งนานมาแล้ว มีเรื่องเล่าขานถึงปลาบู่ทองในหมู่บ้านริมคลอง';
  const d = estimateDuration(text);
  const chars = text.replace(/\s/g, '').length;
  assert.ok(d >= chars / 15 && d <= chars / 13 + 0.5, `duration ${d} for ${chars} chars`);
  assert.ok(estimateDuration(text + text) > d * 1.8);
});

test('buildTimeline: frame-quantised, contiguous scenes, moral + end tag extend the last scene', () => {
  const sb = mockSb('folktale', 3);
  const tl = buildTimeline(sb);
  let t = 0;
  for (const sc of tl.scenes) {
    assert.equal(sc.scene.startSec, Math.round(t * 1000) / 1000);
    assert.ok(Number.isInteger(sc.frames));
    const speech = sc.lines.reduce((a, l) => a + l.dur, 0);
    assert.ok(sc.dur > speech);
    for (const l of sc.lines) assert.ok(l.line.durationSec > 0);
    t += sc.frames / FPS;
  }
  assert.equal(tl.totalFrames, tl.scenes.reduce((a, s) => a + s.frames, 0));
  const last = tl.scenes.at(-1);
  assert.ok(last.moral && last.endTag);
  assert.ok(last.dur >= last.speechEnd + last.moral.dur + last.endTag.dur);
  // measured audio durations win over estimates
  const sb2 = mockSb('folktale', 3);
  sb2.scenes[0].lines[0].durationSec = 9.5;
  assert.ok(buildTimeline(sb2).scenes[0].dur > 9.5);
});

test('chunkCaption: Thai text is split at word boundaries into balanced chunks', () => {
  assert.deepEqual(chunkCaption('ข้าจะไม่ยอมแพ้เด็ดขาด!'), ['ข้าจะไม่ยอมแพ้เด็ดขาด!']);
  const text =
    'แม่ปลาบู่ทองว่ายเข้ามาหาเอื้อยทุกเย็น น้ำตาของลูกสาวหยดลงบนผิวน้ำ “แม่จ๋า… หนูคิดถึงแม่เหลือเกิน” เธอกระซิบเบาๆ ก่อนที่แม่เลี้ยงใจร้ายจะตามมาพบเข้า';
  const chunks = chunkCaption(text);
  assert.ok(chunks.length >= 3);
  // nothing lost, nothing reordered
  assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
  const words = new Set(tokenize(text).map((t) => t.text));
  for (const c of chunks) {
    assert.ok(visibleLength(c) <= CAPTION_MAX, `too long: ${c}`);
    assert.ok(!/^[ะ-ฺ็-๎]/.test(c), `chunk starts with a combining mark: ${c}`);
    // every chunk starts and ends on a whole word
    assert.ok([...words].some((w) => c.startsWith(w)) && [...words].some((w) => c.endsWith(w)));
  }
  // no spaces at all: still chunked, never mid-word
  const solid = 'เหตุการณ์ดำเนินมาถึงตอนที่ทุกอย่างเริ่มเปลี่ยนไปอย่างที่ไม่มีใครคาดคิดมาก่อนเลยแม้แต่น้อย';
  const sc = chunkCaption(solid);
  assert.ok(sc.length >= 2);
  assert.equal(sc.join(''), solid);
  // numbers stay with their word
  for (const c of chunkCaption('เหตุการณ์ดำเนินมาถึงตอนที่ 3 ทุกอย่างเริ่มเปลี่ยนไป')) assert.ok(!/^\d/.test(c), c);
});

test('timeChunks: proportional, contiguous, covers the whole line', () => {
  const cues = timeChunks(['กาลครั้งหนึ่งนานมาแล้ว', 'มีปลา'], 2, 6);
  assert.equal(cues[0].start, 2);
  assert.equal(cues[0].end, cues[1].start);
  assert.equal(cues[1].end, 8);
  assert.ok(cues[0].end - cues[0].start > cues[1].end - cues[1].start);
});

test('SRT formatting', () => {
  assert.equal(srtTime(0), '00:00:00,000');
  assert.equal(srtTime(3723.4567), '01:02:03,457');
  const srt = buildSrt([
    { start: 0.35, end: 2.1, text: 'กาลครั้งหนึ่ง' },
    { start: 2.1, end: 4, text: 'ข้าจะไม่ยอมแพ้!', speaker: 'พระเอก' },
  ]);
  assert.equal(srt, '1\n00:00:00,350 --> 00:00:02,100\nกาลครั้งหนึ่ง\n\n2\n00:00:02,100 --> 00:00:04,000\nพระเอก: ข้าจะไม่ยอมแพ้!\n');
});

test('voice-role mapping per provider', () => {
  for (const provider of ['edge', 'openai', 'elevenlabs']) {
    for (const role of VOICE_ROLES) {
      const v = resolveVoice(provider, role, 'ghost', {});
      assert.ok(v.voice && v.rate > 0.5 && v.rate < 1.5, `${provider}/${role}`);
    }
  }
  // narrator gender follows the genre preset
  assert.equal(GENRES.ghost.narratorVoice, 'male');
  assert.equal(resolveVoice('edge', 'narrator', 'ghost', {}).voice, 'th-TH-NiwatNeural');
  assert.equal(resolveVoice('edge', 'narrator', 'folktale', {}).voice, 'th-TH-PremwadeeNeural');
  assert.equal(resolveVoice('edge', 'male', 'folktale', {}).voice, 'th-TH-NiwatNeural');
  const ghost = resolveVoice('edge', 'ghost', 'ghost', {});
  const child = resolveVoice('edge', 'child', 'ghost', {});
  assert.ok(ghost.rate < 0.9 && ghost.pitch < -2 && ghost.echo);
  assert.ok(child.pitch > 2 && child.rate > 1);
  assert.ok(resolveVoice('edge', 'elder-male', 'ghost', {}).rate < 1);
  // unknown role → narrator; env override
  assert.equal(resolveVoice('edge', 'robot', 'cdrama', {}).role, 'narrator');
  assert.equal(resolveVoice('openai', 'ghost', 'ghost', { NITHAN_VOICE_OPENAI_GHOST: 'echo' }).voice, 'echo');
  // providers without native pitch get an ffmpeg pitch shift; edge only the ghost echo
  assert.ok(postFilters('openai', child).some((f) => f.startsWith('asetrate=')));
  assert.deepEqual(postFilters('edge', child), []);
  assert.ok(postFilters('edge', ghost).some((f) => f.startsWith('aecho=')));
});

test('provider selection', () => {
  assert.deepEqual(providerOrder('none', {}), []);
  assert.deepEqual(providerOrder('auto', {}), ['edge']);
  assert.deepEqual(providerOrder('auto', { OPENAI_API_KEY: 'x' }), ['openai', 'edge']);
  assert.deepEqual(providerOrder('auto', { OPENAI_API_KEY: 'x', ELEVENLABS_API_KEY: 'y' }), ['elevenlabs', 'openai', 'edge']);
  assert.deepEqual(providerOrder('openai', {}), ['openai']);
  assert.deepEqual(providerOrder('bogus', {}), ['edge']);
});

test('edge: SSML, Sec-MS-GEC token and request building (no network)', () => {
  const ssml = edge.buildSsml({ text: 'แม่ <จ๋า> & "ลูก"', voice: 'th-TH-PremwadeeNeural', rate: 0.8, pitch: -3.5 });
  assert.match(ssml, /^<speak version='1\.0' xmlns='http:\/\/www\.w3\.org\/2001\/10\/synthesis' xml:lang='th-TH'>/);
  assert.match(ssml, /<voice name='Microsoft Server Speech Text to Speech Voice \(th-TH, PremwadeeNeural\)'>/);
  assert.match(ssml, /<prosody pitch='-35Hz' rate='-20%' volume='\+0%'>แม่ &lt;จ๋า&gt; &amp; &quot;ลูก&quot;<\/prosody>/);
  assert.match(edge.buildSsml({ text: 'ก', voice: 'th-TH-NiwatNeural' }), /pitch='\+0Hz' rate='\+0%'/);

  // token: SHA-256 upper hex, constant inside a 5-minute window, changes across windows
  const t0 = Date.UTC(2025, 0, 1, 0, 0, 10);
  assert.match(edge.secMsGec(t0), /^[0-9A-F]{64}$/);
  assert.equal(edge.secMsGec(t0), edge.secMsGec(t0 + 200_000));
  assert.notEqual(edge.secMsGec(t0), edge.secMsGec(t0 + 300_000));

  const req = edge.buildRequest(
    { text: 'สวัสดี', voice: 'th-TH-NiwatNeural', rate: 1, pitch: 0 },
    { now: new Date(t0), connectionId: 'c'.repeat(32), requestId: 'r'.repeat(32), muid: 'A'.repeat(32) },
  );
  const url = new URL(req.url);
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.host, 'speech.platform.bing.com');
  assert.equal(url.pathname, '/consumer/speech/synthesize/readaloud/edge/v1');
  assert.equal(url.searchParams.get('TrustedClientToken'), edge.TRUSTED_CLIENT_TOKEN);
  assert.equal(url.searchParams.get('Sec-MS-GEC'), edge.secMsGec(t0));
  assert.match(url.searchParams.get('Sec-MS-GEC-Version'), /^1-\d+\.\d+\.\d+\.\d+$/);
  assert.match(req.headers.Origin, /^chrome-extension:\/\//);
  assert.match(req.headers['User-Agent'], /Edg\//);
  assert.match(req.configMessage, /Path:speech\.config\r\n\r\n\{/);
  assert.ok(req.configMessage.includes(edge.OUTPUT_FORMAT));
  assert.match(req.ssmlMessage, /^X-RequestId:r{32}\r\nContent-Type:application\/ssml\+xml\r\nX-Timestamp:.*Z\r\nPath:ssml\r\n\r\n<speak/);

  // binary frame: [uint16 header length][header][audio]
  const header = Buffer.from('X-RequestId:abc\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n');
  const frame = Buffer.concat([Buffer.from([header.length >> 8, header.length & 255]), header, Buffer.from([1, 2, 3])]);
  assert.deepEqual([...edge.parseAudioFrame(frame)], [1, 2, 3]);
  assert.equal(edge.parseAudioFrame(Buffer.from([0, 5, 1])).length, 0);
});

test('edge: synthesize speaks the protocol against a fake WebSocket and fails fast', async () => {
  const sent = [];
  class FakeWs extends EventTarget {
    constructor(url, opts) {
      super();
      FakeWs.last = { url, opts };
      queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    send(msg) {
      sent.push(msg);
      if (!/Path:ssml/.test(msg)) return;
      const header = Buffer.from('Path:audio\r\n');
      const frame = Buffer.concat([Buffer.from([0, header.length]), header, Buffer.from('MP3DATA')]);
      const ab = frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.length);
      queueMicrotask(() => {
        this.dispatchEvent(Object.assign(new Event('message'), { data: ab }));
        this.dispatchEvent(Object.assign(new Event('message'), { data: 'X-RequestId:1\r\nPath:turn.end\r\n\r\n{}' }));
      });
    }
    close() {}
  }
  const mp3 = await edge.synthesize({ text: 'สวัสดี', voice: 'th-TH-NiwatNeural', rate: 1, pitch: 0 }, { WebSocketImpl: FakeWs });
  assert.equal(mp3.toString(), 'MP3DATA');
  assert.equal(sent.length, 2);
  assert.ok(FakeWs.last.opts.headers.Origin);

  class DeadWs extends EventTarget {
    close() {}
  }
  const t0 = Date.now();
  await assert.rejects(edge.synthesize({ text: 'ก', voice: 'th-TH-NiwatNeural' }, { WebSocketImpl: DeadWs, connectTimeoutMs: 60 }), /connect timeout/);
  assert.ok(Date.now() - t0 < 2000);
});

test('openai / elevenlabs request building (no network)', () => {
  const o = openai.buildRequest({ text: 'สวัสดี', voice: 'nova', rate: 0.8, instructions: 'พูดช้า' }, { OPENAI_API_KEY: 'sk-test' });
  assert.equal(o.url, 'https://api.openai.com/v1/audio/speech');
  assert.equal(o.headers.Authorization, 'Bearer sk-test');
  const ob = JSON.parse(o.body);
  assert.deepEqual([ob.voice, ob.input, ob.response_format, ob.speed], ['nova', 'สวัสดี', 'mp3', 0.8]);
  assert.equal(ob.instructions, 'พูดช้า');
  assert.equal(JSON.parse(openai.buildRequest({ text: 'ก', voice: 'nova', instructions: 'x' }, { NITHAN_OPENAI_TTS_MODEL: 'tts-1' }).body).instructions, undefined);

  const e = elevenlabs.buildRequest({ text: 'สวัสดี', voice: 'VOICE', rate: 0.5, role: 'ghost' }, { ELEVENLABS_API_KEY: 'el-test' });
  assert.match(e.url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/VOICE\?output_format=mp3_/);
  assert.equal(e.headers['xi-api-key'], 'el-test');
  const eb = JSON.parse(e.body);
  assert.equal(eb.model_id, 'eleven_multilingual_v2');
  assert.equal(eb.voice_settings.speed, 0.7);
});

test('fonts: every genre caption font is bundled with a Thai subset', () => {
  for (const g of Object.values(GENRES)) {
    assert.equal(resolveFont(g.captionFont), g.captionFont);
    const css = fontFaceCss(g.captionFont);
    assert.match(css, /U\+0E01-0E5B/);
    assert.match(css, /font-weight:700/);
  }
  assert.equal(resolveFont('No Such Font'), 'Kanit');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>ผี</text></svg>';
  assert.match(embedFontInSvg(svg, 'Kanit'), /<svg[^>]*><style>@font-face/);
  assert.equal(embedFontInSvg('<svg><rect/></svg>', 'Kanit'), '<svg><rect/></svg>');
});

test('ffmpeg graph building: camera moves, overlays, audio', () => {
  for (const cam of ['zoom-in', 'zoom-out', 'static']) assert.match(cameraFilter(cam, 90, 102), /scale=w='2\*round\(540\*.*eval=frame.*crop=1080:1920/);
  for (const cam of ['pan-left', 'pan-right', 'pan-up', 'pan-down']) assert.match(cameraFilter(cam, 90, 102), /crop=2160:3840:.*scale=1080:1920/);
  assert.ok(!cameraFilter('zoom-in', 90, 102).includes('zoompan'));
  const args = sceneClipArgs({
    frame: 'a.png', camera: 'zoom-in', frames: 90, hasNext: true, out: 'o.mp4',
    prev: { frame: 'p.png', camera: 'pan-left', frames: 120 },
    overlays: [{ path: 'c.png', x: 64, y: 1300, start: 0.5, end: 2 }, { path: 't.png', x: 0, y: 0, start: 0, end: 2.5, fade: true }],
  });
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /xfade=transition=fade/);
  assert.match(graph, /overlay=x=64:y=1300:.*enable='between\(t,0\.5,2\)'/);
  assert.match(graph, /fade=t=out:.*alpha=1/);
  assert.ok(args.includes('libx264') && args.includes('yuv420p'));

  const voiced = audioArgs({ voices: [{ path: 'a.mp3', start: 0.35 }, { path: 'b.mp3', start: 4.2 }], music: true, genre: 'ghost', duration: 10, out: 'a.m4a' });
  const ag = voiced[voiced.indexOf('-filter_complex') + 1];
  assert.match(ag, /adelay=350:all=1/);
  assert.match(ag, /adelay=4200:all=1/);
  assert.match(ag, /sidechaincompress/);
  const silent = audioArgs({ voices: [], music: false, genre: 'ghost', duration: 10, out: 'a.m4a' });
  assert.match(silent[silent.indexOf('-filter_complex') + 1], /anullsrc/);
});

test('synthesizeVoices: falls back to silent mode when the provider fails on the first line', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-tts-'));
  try {
    const sb = mockSb('ghost', 3);
    let calls = 0;
    const providers = { edge: { synthesize: async () => { calls++; throw new Error('blocked'); } } };
    const events = [];
    const res = await synthesizeVoices(sb, dir, { tts: 'edge', providers, env: {}, onProgress: (e) => events.push(e) });
    assert.equal(res.voiced, false);
    assert.equal(calls, 1);
    for (const s of sb.scenes) for (const l of s.lines) {
      assert.equal(l.audio, undefined);
      assert.equal(l.durationSec, estimateDuration(l.text));
    }
    assert.equal(events.at(-1).progress, 1);
    assert.equal((await synthesizeVoices(mockSb(), dir, { tts: 'none' })).voiced, false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

const probe = (file) =>
  JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }).stdout);

test('synthesizeVoices: real durations, per-line cache, re-synthesis only for edited lines', { skip: !hasFfmpeg && 'ffmpeg not available' }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-tts-'));
  try {
    let calls = 0;
    // fake provider: a 1.2 s tone encoded as mp3
    const tone = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=f=220:d=1.2', '-c:a', 'libmp3lame', '-f', 'mp3', '-'], { maxBuffer: 1 << 24 }).stdout;
    const providers = { edge: { synthesize: async () => (calls++, tone) } };
    const sb = mockSb('folktale', 3);
    const total = sb.scenes.reduce((a, s) => a + s.lines.length, 0);
    const res = await synthesizeVoices(sb, dir, { tts: 'edge', providers, env: {} });
    assert.equal(res.voiced, true);
    assert.equal(calls, total);
    assert.equal(sb.scenes[0].lines[0].audio, 'audio/s01-1.mp3');
    assert.equal(sb.scenes[1].lines[1].audio, 'audio/s02-2.mp3');
    assert.ok(Math.abs(sb.scenes[0].lines[0].durationSec - 1.2) < 0.15);
    await fs.access(path.join(dir, 'audio/manifest.json'));
    // unchanged → everything cached
    await synthesizeVoices(sb, dir, { tts: 'edge', providers, env: {} });
    assert.equal(calls, total);
    // one edited line → one synthesis
    sb.scenes[1].lines[0].text += ' อีกครั้ง';
    const again = await synthesizeVoices(sb, dir, { tts: 'edge', providers, env: {} });
    assert.equal(calls, total + 1);
    assert.equal(again.cached, total - 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('integration: renders a 2-scene mock video (1080x1920, audio, duration)', { skip: (!hasFfmpeg && 'ffmpeg not available') || (!hasChromium && 'Chromium not available'), timeout: 180_000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-render-'));
  try {
    const sb = mockSb('ghost', 3);
    sb.scenes.length = 2; // resolveOptions clamps to ≥ 3 scenes
    await mockArt(sb, dir);
    const events = [];
    const out = await renderVideo(sb, dir, { tts: 'none', music: true, onProgress: (e) => events.push(e) });
    assert.deepEqual(
      { videoPath: out.videoPath, posterPath: out.posterPath, srtPath: out.srtPath, voiced: out.voiced },
      { videoPath: 'video.mp4', posterPath: 'poster.jpg', srtPath: 'subtitles.srt', voiced: false },
    );
    const info = probe(path.join(dir, 'video.mp4'));
    const v = info.streams.find((s) => s.codec_type === 'video');
    const a = info.streams.find((s) => s.codec_type === 'audio');
    assert.deepEqual([v.codec_name, v.width, v.height, v.pix_fmt, v.r_frame_rate], ['h264', 1080, 1920, 'yuv420p', '30/1']);
    assert.ok(a && a.codec_name === 'aac', 'has an AAC audio stream');
    assert.ok(Math.abs(Number(info.format.duration) - out.durationSec) < 0.2, `duration ${info.format.duration} vs ${out.durationSec}`);
    // storyboard is annotated and consistent with the reported duration
    const last = sb.scenes.at(-1);
    assert.equal(sb.scenes[0].startSec, 0);
    assert.ok(Math.abs(last.startSec + last.durationSec - out.durationSec) < 0.05);
    for (const s of sb.scenes) for (const l of s.lines) assert.ok(l.durationSec > 0);
    // side products
    assert.ok((await fs.stat(path.join(dir, 'poster.jpg'))).size > 10_000);
    assert.match(await fs.readFile(path.join(dir, 'subtitles.srt'), 'utf8'), /^1\n00:00:00,\d{3} --> /);
    await fs.access(path.join(dir, 'frames/s01.png'));
    await assert.rejects(fs.access(path.join(dir, '.render-tmp')));
    // progress: both stages, within 0..1, ends at 1
    assert.ok(events.some((e) => e.stage === 'voice') && events.some((e) => e.stage === 'render'));
    assert.ok(events.every((e) => e.progress >= 0 && e.progress <= 1 && typeof e.message === 'string'));
    assert.equal(events.at(-1).progress, 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('integration: voiced mix (voice lines + ducked music bed)', { skip: !hasFfmpeg && 'ffmpeg not available' }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-audio-'));
  try {
    const { renderAudio } = await import('../src/render/compose.js');
    for (const n of ['a', 'b']) spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=1.5', path.join(dir, `${n}.mp3`)]);
    for (const genre of Object.keys(GENRES)) {
      const out = path.join(dir, `${genre}.m4a`);
      await renderAudio({ voices: [{ path: path.join(dir, 'a.mp3'), start: 0.4 }, { path: path.join(dir, 'b.mp3'), start: 3 }], music: true, genre, duration: 6, out });
      assert.ok(Math.abs(Number(probe(out).format.duration) - 6) < 0.15, genre);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
