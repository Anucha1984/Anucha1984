// Small process / fs helpers shared by the renderer modules.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

export const FFMPEG = process.env.NITHAN_FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.NITHAN_FFPROBE || 'ffprobe';

/** Error whose message is Thai and safe to show to the user. */
export class RenderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'RenderError';
    if (cause) this.cause = cause;
  }
}

/** Run a process, collect output. Rejects with the last lines of stderr on failure. */
export function run(cmd, args, { timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err);
      return;
    }
    const out = [];
    let err = '';
    let timer = null;
    let timedOut = false;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);
    }
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => {
      err = (err + d).slice(-6000);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(out).toString('utf8');
      if (code === 0) resolve({ stdout, stderr: err });
      else {
        const tail = err.trim().split('\n').slice(-6).join('\n');
        const e = new Error(timedOut ? `${cmd} timed out after ${timeoutMs} ms` : `${cmd} exited with code ${code}\n${tail}`);
        e.stderr = err;
        reject(e);
      }
    });
  });
}

export async function ffmpeg(args, opts) {
  try {
    return await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], opts);
  } catch (err) {
    if (err.code === 'ENOENT') throw missingFfmpeg(err);
    throw err;
  }
}

function missingFfmpeg(cause) {
  return new RenderError(
    'ไม่พบ ffmpeg/ffprobe ในเครื่อง — กรุณาติดตั้ง ffmpeg ก่อน (เช่น `apt install ffmpeg` หรือ `brew install ffmpeg`) หรือกำหนดตำแหน่งด้วยตัวแปร NITHAN_FFMPEG / NITHAN_FFPROBE',
    cause,
  );
}

let ffmpegChecked = null;
/** Resolves true when ffmpeg + ffprobe can run; throws a Thai RenderError otherwise. */
export function ensureFfmpeg() {
  ffmpegChecked ??= Promise.all([run(FFMPEG, ['-version']), run(FFPROBE, ['-version'])]).then(
    () => true,
    (err) => {
      ffmpegChecked = null;
      throw missingFfmpeg(err);
    },
  );
  return ffmpegChecked;
}

/** Media duration in seconds (0 when unknown). */
export async function probeDuration(file) {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = parseFloat(stdout);
  return Number.isFinite(d) ? d : 0;
}

export const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

/** Map with bounded concurrency, results in input order. Stops scheduling after the first error. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  const settled = await Promise.allSettled(workers);
  const bad = settled.find((s) => s.status === 'rejected');
  if (bad) throw bad.reason;
  return results;
}

/** Fixed-precision number for ffmpeg expressions (no exponent notation). */
export const num = (n, digits = 4) => String(Number(Number(n).toFixed(digits)));

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
