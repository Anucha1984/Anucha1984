// Project store: reads/writes project directories under the output dir.
import fsp from 'node:fs/promises';
import path from 'node:path';
import { CAMERA_MOVES, LENGTHS } from '../shared/presets.js';
import { validateStoryboard } from '../shared/schema.js';

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const SCENE_RE = /^s\d{2}$/;
const META_FILE = 'studio.json'; // studio-only sidecar: options used to create the project

const exists = (p) => fsp.access(p).then(() => true, () => false);
const mtime = (p) => fsp.stat(p).then((s) => Math.floor(s.mtimeMs), () => 0);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class ProjectStore {
  constructor(outDir) {
    this.outDir = path.resolve(outDir);
  }

  dir(id) {
    if (!ID_RE.test(String(id))) throw new HttpError(400, 'รหัสโปรเจกต์ไม่ถูกต้อง');
    const dir = path.join(this.outDir, id);
    if (path.dirname(dir) !== this.outDir) throw new HttpError(400, 'รหัสโปรเจกต์ไม่ถูกต้อง');
    return dir;
  }

  async load(id) {
    const dir = this.dir(id);
    try {
      return JSON.parse(await fsp.readFile(path.join(dir, 'storyboard.json'), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') throw new HttpError(404, 'ไม่พบโปรเจกต์นี้');
      throw new HttpError(500, 'อ่านสตอรี่บอร์ดไม่ได้: ' + err.message);
    }
  }

  async save(id, sb) {
    await fsp.writeFile(path.join(this.dir(id), 'storyboard.json'), JSON.stringify(sb, null, 2));
  }

  async readMeta(id) {
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(this.dir(id), META_FILE), 'utf8'));
      return meta && typeof meta === 'object' ? meta : {};
    } catch {
      return {};
    }
  }

  async writeMeta(id, patch) {
    const dir = this.dir(id);
    if (!(await exists(dir))) return;
    const meta = { ...(await this.readMeta(id)), ...patch };
    await fsp.writeFile(path.join(dir, META_FILE), JSON.stringify(meta, null, 2));
  }

  /** File facts the UI needs (what exists + a version for cache busting). */
  async info(id, sb) {
    const dir = this.dir(id);
    const videoRel = safeRel(sb?.output?.videoPath) || 'video.mp4';
    const posterRel = safeRel(sb?.output?.posterPath) || 'poster.jpg';
    const srtRel = safeRel(sb?.output?.srtPath) || 'subtitles.srt';
    const [videoAt, posterAt, srtAt, sbAt] = await Promise.all([
      mtime(path.join(dir, videoRel)),
      mtime(path.join(dir, posterRel)),
      mtime(path.join(dir, srtRel)),
      mtime(path.join(dir, 'storyboard.json')),
    ]);
    const meta = await this.readMeta(id);
    return {
      hasVideo: videoAt > 0,
      hasPoster: posterAt > 0,
      hasSrt: srtAt > 0,
      video: videoAt ? videoRel : null,
      poster: posterAt ? posterRel : null,
      srt: srtAt ? srtRel : null,
      version: Math.max(videoAt, posterAt, sbAt),
      needsRender: Boolean(meta.needsRender) || videoAt === 0,
      mock: Boolean(meta.mock),
      tts: meta.tts ?? null,
      music: meta.music ?? null,
      length: meta.length ?? null,
    };
  }

  async list() {
    let entries = [];
    try {
      entries = await fsp.readdir(this.outDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out = [];
    await Promise.all(
      entries
        .filter((e) => e.isDirectory() && ID_RE.test(e.name))
        .map(async (e) => {
          try {
            const sb = await this.load(e.name);
            const info = await this.info(e.name, sb);
            const firstArt = safeRel(sb.scenes?.find((s) => s.art)?.art);
            const posterRel = info.poster || (firstArt && (await exists(path.join(this.outDir, e.name, firstArt))) ? firstArt : null);
            out.push({
              id: e.name,
              title: String(sb.title || e.name),
              logline: String(sb.logline || ''),
              genre: sb.genre,
              style: sb.style,
              createdAt: sb.createdAt || new Date(info.version || Date.now()).toISOString(),
              poster: posterRel ? `/media/${e.name}/${posterRel}?v=${info.version}` : null,
              hasVideo: info.hasVideo,
              durationSec: Number(sb.output?.durationSec) || null,
              voiced: sb.output ? sb.output.voiced !== false : null,
              scenes: Array.isArray(sb.scenes) ? sb.scenes.length : 0,
              series: sb.series ? { title: sb.series.title, episode: sb.series.episode } : null,
            });
          } catch {
            /* not a project dir (or half-written): skip */
          }
        }),
    );
    return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async remove(id) {
    const dir = this.dir(id);
    if (!(await exists(path.join(dir, 'storyboard.json')))) throw new HttpError(404, 'ไม่พบโปรเจกต์นี้');
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

/** A relative path from a storyboard that we are willing to serve/link. */
export function safeRel(p) {
  if (typeof p !== 'string' || !p || p.length > 200) return null;
  const norm = p.replace(/\\/g, '/');
  if (norm.startsWith('/') || /^[a-zA-Z]:/.test(norm)) return null;
  const segs = norm.split('/');
  if (segs.some((s) => !s || s === '.' || s === '..' || s.startsWith('.'))) return null;
  return segs.join('/');
}

const clean = (v, max) =>
  String(v)
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Apply the user's edits to a storyboard. Only a whitelist of fields can change:
 * title, hook, moral, scene.visual, scene.camera and each line's speaker/text.
 * Returns {storyboard, changed}. Throws HttpError(400) on anything invalid.
 */
export function applyEdits(current, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
  const next = structuredClone(current);
  let changed = 0;
  const set = (obj, key, value) => {
    if (obj[key] !== value) {
      obj[key] = value;
      changed++;
    }
  };

  for (const [key, max] of [['title', 120], ['hook', 80], ['moral', 300]]) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'string') throw new HttpError(400, `ช่อง ${key} ต้องเป็นข้อความ`);
    const v = clean(body[key], max);
    if (key === 'title' && !v) throw new HttpError(400, 'ชื่อเรื่องห้ามว่าง');
    if (key === 'moral' && !v) {
      if (next.moral !== undefined) changed++;
      delete next.moral;
    } else set(next, key, v || next.title);
  }

  if ('scenes' in body) {
    if (!Array.isArray(body.scenes)) throw new HttpError(400, 'scenes ต้องเป็นรายการ');
    const speakers = new Set(['narrator', ...(next.characters || []).map((c) => c.id)]);
    for (const edit of body.scenes) {
      if (!edit || typeof edit !== 'object') throw new HttpError(400, 'ข้อมูลฉากไม่ถูกต้อง');
      const scene = next.scenes.find((s) => s.id === edit.id);
      if (!scene) throw new HttpError(400, `ไม่พบฉาก ${String(edit.id).slice(0, 20)}`);
      if ('visual' in edit) {
        if (typeof edit.visual !== 'string' || !clean(edit.visual, 1500)) throw new HttpError(400, `${scene.id}: คำบรรยายภาพห้ามว่าง`);
        set(scene, 'visual', clean(edit.visual, 1500));
      }
      if ('camera' in edit) {
        if (!CAMERA_MOVES.includes(edit.camera)) throw new HttpError(400, `${scene.id}: มุมกล้องไม่ถูกต้อง`);
        set(scene, 'camera', edit.camera);
      }
      if ('lines' in edit) {
        if (!Array.isArray(edit.lines) || edit.lines.length < 1 || edit.lines.length > 6)
          throw new HttpError(400, `${scene.id}: แต่ละฉากต้องมี 1–6 บรรทัด`);
        const lines = edit.lines.map((l, i) => {
          if (!l || typeof l.text !== 'string' || !clean(l.text, 400)) throw new HttpError(400, `${scene.id}: บรรทัดที่ ${i + 1} ยังไม่มีข้อความ`);
          const speaker = l.speaker === undefined ? 'narrator' : l.speaker;
          if (!speakers.has(speaker)) throw new HttpError(400, `${scene.id}: ไม่รู้จักผู้พูด “${String(speaker).slice(0, 30)}”`);
          const text = clean(l.text, 400);
          const old = scene.lines[i];
          // Keep the renderer's cached audio only when the line is untouched.
          if (old && old.text === text && old.speaker === speaker) return old;
          changed++;
          return { speaker, text };
        });
        if (lines.length !== scene.lines.length) changed++;
        scene.lines = lines;
      }
    }
  }

  try {
    validateStoryboard(next);
  } catch (err) {
    throw new HttpError(400, err.message);
  }
  return { storyboard: next, changed };
}

/** Best guess of the length preset a storyboard was made with. */
export function guessLength(sb, meta = {}) {
  if (LENGTHS[meta.length]) return meta.length;
  const n = sb.scenes?.length || 0;
  return Object.values(LENGTHS).reduce((best, l) => (Math.abs(l.scenes - n) < Math.abs(LENGTHS[best].scenes - n) ? l.id : best), 'short');
}
