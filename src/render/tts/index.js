// Voice stage: pick a TTS provider, synthesise one mp3 per line (cached), measure durations.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { voiceRoleFor } from '../../shared/schema.js';
import { estimateDuration } from '../timeline.js';
import { ffmpeg, pool, probeDuration, sha1 } from '../util.js';
import { resolveVoice } from './voices.js';
import * as edge from './edge.js';
import * as openai from './openai.js';
import * as elevenlabs from './elevenlabs.js';

export const PROVIDERS = { edge, openai, elevenlabs };
export const TTS_MODES = ['auto', 'edge', 'openai', 'elevenlabs', 'none'];

/**
 * Providers to try, in order. `auto` = every provider that has credentials, then the free Edge voices.
 * @returns {string[]} provider names ([] = silent)
 */
export function providerOrder(tts = 'auto', env = process.env) {
  const mode = TTS_MODES.includes(tts) ? tts : 'auto';
  if (mode === 'none') return [];
  if (mode !== 'auto') return [mode];
  const order = [];
  if (elevenlabs.available(env)) order.push('elevenlabs');
  if (openai.available(env)) order.push('openai');
  order.push('edge');
  return order;
}

/** ffmpeg audio filters applied after synthesis (pitch for providers without native pitch, ghost echo). */
export function postFilters(providerName, voice) {
  const filters = [];
  if (providerName !== 'edge' && Math.abs(voice.pitch) >= 0.3) {
    const f = 2 ** (voice.pitch / 12);
    filters.push('aresample=44100', `asetrate=${Math.round(44100 * f)}`, 'aresample=44100', `atempo=${(1 / f).toFixed(4)}`);
  }
  if (voice.echo) filters.push('aecho=0.8:0.75:70|150:0.32|0.18', 'lowpass=f=6500');
  return filters;
}

const lineHash = (providerName, voice, text) =>
  sha1(JSON.stringify([providerName, voice.voice, voice.rate, voice.pitch, voice.echo, text.trim(), process.env.NITHAN_OPENAI_TTS_MODEL, process.env.NITHAN_ELEVENLABS_MODEL]));

/**
 * Synthesise every line. Mutates sb: line.audio (relative mp3 path) + line.durationSec.
 * When no provider works the whole video falls back to silent mode (estimated durations, no line.audio).
 * @returns {Promise<{voiced:boolean, provider:string|null, synthesized:number, cached:number}>}
 */
export async function synthesizeVoices(sb, projectDir, { tts = 'auto', onProgress, providers = PROVIDERS, env = process.env } = {}) {
  const audioDir = path.join(projectDir, 'audio');
  const jobs = [];
  sb.scenes.forEach((scene) =>
    scene.lines.forEach((line, j) => jobs.push({ scene, line, rel: `audio/${scene.id}-${j + 1}.mp3`, role: voiceRoleFor(sb, line.speaker) })),
  );
  const report = (done, message) => onProgress?.({ stage: 'voice', progress: jobs.length ? done / jobs.length : 1, message });

  const silent = (message) => {
    for (const { line } of jobs) {
      delete line.audio;
      line.durationSec = estimateDuration(line.text);
    }
    report(jobs.length, message);
    return { voiced: false, provider: null, synthesized: 0, cached: 0 };
  };

  const order = providerOrder(tts, env).filter((n) => providers[n]);
  if (!order.length || !jobs.length) return silent('โหมดไม่มีเสียงพากย์: ใช้คำบรรยายและดนตรีประกอบ');

  await fsp.mkdir(audioDir, { recursive: true });
  const manifestPath = path.join(audioDir, 'manifest.json');
  let manifest = {};
  try {
    manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  } catch {
    /* no cache yet */
  }
  const stats = { synthesized: 0, cached: 0 };

  const synthOne = async (providerName, job) => {
    const provider = providers[providerName];
    const voice = resolveVoice(providerName, job.role, sb.genre, env);
    const dest = path.join(projectDir, job.rel);
    const hash = lineHash(providerName, voice, job.line.text);
    const hit = manifest[job.rel];
    if (hit && hit.hash === hash && hit.durationSec > 0 && fs.existsSync(dest)) {
      stats.cached++;
      return hit.durationSec;
    }
    const mp3 = await provider.synthesize({ text: job.line.text.trim(), ...voice });
    if (!mp3?.length) throw new Error(`${providerName}: empty audio`);
    const filters = postFilters(providerName, voice);
    if (filters.length) {
      const raw = `${dest}.raw.mp3`;
      await fsp.writeFile(raw, mp3);
      try {
        await ffmpeg(['-i', raw, '-af', filters.join(','), '-c:a', 'libmp3lame', '-q:a', '3', dest]);
      } finally {
        await fsp.rm(raw, { force: true });
      }
    } else await fsp.writeFile(dest, mp3);
    const durationSec = Math.round((await probeDuration(dest)) * 1000) / 1000;
    if (!(durationSec > 0)) throw new Error(`${providerName}: unreadable audio`);
    manifest[job.rel] = { hash, durationSec, provider: providerName, voice: voice.voice };
    stats.synthesized++;
    return durationSec;
  };

  // The first line decides which provider the whole video uses.
  let active = null;
  const errors = [];
  for (const providerName of order) {
    report(0, `กำลังเตรียมเสียงพากย์ (${providerName})…`);
    try {
      const d = await synthOne(providerName, jobs[0]);
      jobs[0].line.audio = jobs[0].rel;
      jobs[0].line.durationSec = d;
      active = providerName;
      break;
    } catch (err) {
      errors.push(`${providerName}: ${err.message}`);
    }
  }
  if (!active) {
    const res = silent('เชื่อมต่อบริการเสียงพากย์ไม่ได้ — ทำวิดีโอแบบไม่มีเสียงพากย์ (คำบรรยาย + ดนตรีประกอบ)');
    res.errors = errors;
    return res;
  }

  let done = 1;
  report(done, `พากย์เสียงแล้ว 1/${jobs.length} บรรทัด`);
  let failedLines = 0;
  await pool(jobs.slice(1), 3, async (job) => {
    let d = 0;
    for (let attempt = 0; attempt < 2 && !d; attempt++) {
      try {
        d = await synthOne(active, job);
      } catch (err) {
        if (attempt === 1) errors.push(`${job.rel}: ${err.message}`);
      }
    }
    if (d) {
      job.line.audio = job.rel;
      job.line.durationSec = d;
    } else {
      // keep going: this one line is caption-only
      failedLines++;
      delete job.line.audio;
      job.line.durationSec = estimateDuration(job.line.text);
    }
    report(++done, `พากย์เสียงแล้ว ${done}/${jobs.length} บรรทัด`);
  });

  // forget cache entries of lines that no longer exist
  const live = new Set(jobs.map((j) => j.rel));
  for (const key of Object.keys(manifest)) {
    if (!live.has(key)) {
      delete manifest[key];
      await fsp.rm(path.join(projectDir, key), { force: true });
    }
  }
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  report(jobs.length, failedLines ? `พากย์เสียงเสร็จ (ข้าม ${failedLines} บรรทัดที่สังเคราะห์ไม่สำเร็จ)` : 'พากย์เสียงครบทุกบรรทัดแล้ว');
  return { voiced: true, provider: active, ...stats, errors };
}
