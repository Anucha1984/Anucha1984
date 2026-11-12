#!/usr/bin/env node
// NiThan Studio CLI — one command, one video:  nithan "ปลาบู่ทอง"
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GENRES, STYLES, resolveOptions } from '../src/shared/presets.js';
import { continueInput, helpText, listText, parseArgs } from '../src/engine/args.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGES = { storyboard: 'เขียนบท', art: 'วาดภาพ', voice: 'พากย์เสียง', render: 'ตัดต่อ', done: 'เสร็จ', error: 'ผิดพลาด' };
const tty = process.stdout.isTTY;
const c = (code, s) => (tty && !process.env.NO_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);

function bar(p, width = 24) {
  const n = Math.round(Math.max(0, Math.min(1, p)) * width);
  return '█'.repeat(n) + '░'.repeat(width - n);
}

function makeProgress() {
  let lastStage = '';
  let lastLine = '';
  return (ev) => {
    if (ev.stage === 'error') return; // main() prints the error
    const pct = String(Math.round((ev.progress ?? 0) * 100)).padStart(3) + '%';
    const stage = STAGES[ev.stage] || ev.stage;
    if (tty) {
      if (lastStage && ev.stage !== lastStage) process.stdout.write('\n');
      const msg = (ev.message || '').slice(0, Math.max(10, (process.stdout.columns || 80) - 46));
      process.stdout.write(`\r\x1b[2K${c('36', bar(ev.progress ?? 0))} ${pct}  ${c('1', stage)}  ${msg}`);
      if (ev.stage === 'done') process.stdout.write('\n');
    } else {
      const line = `[${pct}] ${stage}: ${ev.message || ''}`;
      if (line !== lastLine) console.log(line);
      lastLine = line;
    }
    lastStage = ev.stage;
  };
}

async function main() {
  const { command, input, continueDir, errors } = parseArgs(process.argv.slice(2));
  if (errors.length) {
    for (const e of errors) console.error(c('31', 'ผิดพลาด: ') + e);
    console.error('\nพิมพ์ nithan --help เพื่อดูวิธีใช้');
    return 2;
  }
  if (command === 'help') return void console.log(helpText());
  if (command === 'list') return void console.log(listText());
  if (command === 'version') {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    return void console.log(pkg.version);
  }
  if (command === 'studio') {
    try {
      await import(pathToFileURL(path.join(root, 'src/server/index.js')).href);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' && /src[\\/]server[\\/]index\.js/.test(err.message)) {
        console.error('ยังไม่พบสตูดิโอ (src/server/index.js) ในชุดติดตั้งนี้');
        return 1;
      }
      throw err;
    }
    return; // the server keeps the process alive
  }

  let finalInput = input;
  if (continueDir) {
    const dir = path.resolve(continueDir);
    let prev;
    try {
      prev = JSON.parse(await fs.readFile(path.join(dir, 'storyboard.json'), 'utf8'));
    } catch {
      console.error(c('31', 'ผิดพลาด: ') + `อ่าน storyboard.json ใน ${dir} ไม่ได้ (ต้องเป็นโฟลเดอร์โปรเจกต์ที่เคยสร้างไว้)`);
      return 2;
    }
    finalInput = continueInput(input, prev);
    finalInput.refsDir = path.join(dir, 'characters'); // same faces as the previous episode
    // by default keep episodes of a series next to each other
    if (!input.outDir) finalInput.outDir = path.dirname(dir);
  }

  const opts = resolveOptions(finalInput);
  const ep = opts.series ? `  ·  ตอนที่ ${(Number(opts.series.episode) || 0) + 1}` : '';
  console.log(c('1', `NiThan Studio  ·  ${GENRES[opts.genre].name}  ·  ลายเส้น ${STYLES[opts.style].name}  ·  ${opts.scenes} ฉาก${ep}${opts.mock ? '  ·  โหมดจำลอง' : ''}`));
  console.log(`เรื่อง: ${opts.prompt}\n`);

  const { createVideo } = await import('../src/pipeline.js');
  const started = Date.now();
  const { projectDir, storyboard } = await createVideo(finalInput, makeProgress());
  const out = storyboard.output || {};
  const rel = (p) => (p ? path.relative(process.cwd(), path.join(projectDir, p)) || p : null);
  console.log('\n' + c('32', `เสร็จแล้ว: ${storyboard.title}`) + `  (ใช้เวลา ${Math.round((Date.now() - started) / 1000)} วินาที)`);
  if (out.videoPath) console.log(`วิดีโอ:    ${rel(out.videoPath)}${out.durationSec ? `  (${Math.round(out.durationSec)} วินาที)` : ''}`);
  if (out.posterPath) console.log(`ภาพปก:    ${rel(out.posterPath)}`);
  if (out.srtPath) console.log(`ซับไตเติล: ${rel(out.srtPath)}`);
  console.log(`โปรเจกต์:  ${path.relative(process.cwd(), projectDir) || projectDir}`);
  if (out.voiced === false) console.log(c('33', 'หมายเหตุ: ไม่มีเสียงพากย์ (เชื่อมต่อบริการเสียงไม่ได้) วิดีโอมีคำบรรยายและดนตรีประกอบแทน'));
  if (storyboard.series?.nextHook) console.log(`\nตอนต่อไป: ${storyboard.series.nextHook}\n  nithan --continue "${path.relative(process.cwd(), projectDir) || projectDir}"`);
}

main().then(
  (code) => {
    if (code) process.exitCode = code;
  },
  (err) => {
    if (tty) process.stdout.write('\n');
    console.error(c('31', 'ไม่สำเร็จ: ') + (err?.message || String(err)));
    if (process.env.NITHAN_DEBUG) console.error(err);
    process.exitCode = 1;
  },
);
