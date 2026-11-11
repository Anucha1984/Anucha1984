// Storyboard schema (JSDoc types + runtime validation). The single data contract
// between engine (writes it), renderer (reads it) and studio UI (shows/edits it).
import { CAMERA_MOVES, GENRES, STYLES, VOICE_ROLES } from './presets.js';

/**
 * @typedef {{id:string,name:string,tagline:string,emoji:string,accent:string,defaultStyle:string,captionFont:string,examples:string[],writing:string,narratorVoice:string}} GenrePreset
 * @typedef {{id:string,name:string,subtitle:string,swatch:string[],art:string}} StylePreset
 *
 * @typedef {Object} Character
 * @property {string} id        kebab-case ascii id, e.g. "ueay"
 * @property {string} name      Thai display name, e.g. "เอื้อย"
 * @property {string} voice     one of VOICE_ROLES (not "narrator")
 * @property {string} visual    English visual description, reused in every scene for consistency
 *
 * @typedef {Object} Line
 * @property {string} speaker   "narrator" or a Character.id
 * @property {string} text      Thai text that is spoken AND shown as a caption
 * @property {string} [audio]         (renderer) path relative to project dir
 * @property {number} [durationSec]   (renderer)
 *
 * @typedef {Object} Scene
 * @property {string} id          "s01", "s02", ...
 * @property {string} heading     short Thai scene title (UI only)
 * @property {string} visual      English description of the image (art direction for this scene)
 * @property {string} mood        e.g. "eerie", "warm", "tense", "triumphant", "sad"
 * @property {string} camera      one of CAMERA_MOVES
 * @property {Line[]} lines       1–4 spoken lines, in order
 * @property {string} [art]       (engine) image path relative to project dir: "scenes/s01.svg" | .png | .jpg
 * @property {number} [startSec]     (renderer)
 * @property {number} [durationSec]  (renderer)
 *
 * @typedef {Object} Storyboard
 * @property {string} id          project id == project directory name
 * @property {string} title       Thai title
 * @property {string} logline     one-sentence Thai summary
 * @property {string} hook        ≤ 40 chars Thai hook shown big on the first scene / poster
 * @property {string} genre       key of GENRES
 * @property {string} style       key of STYLES
 * @property {string[]} palette   5 hex colours shared by all scene art
 * @property {Character[]} characters
 * @property {Scene[]} scenes
 * @property {string} [moral]     closing moral line (folktale / ghost)
 * @property {{title:string, episode:number, summary:string, nextHook:string}} [series]
 *           series state; pass back as options.series to generate the next episode
 * @property {{videoPath:string,posterPath:string,srtPath:string,durationSec:number,voiced:boolean}} [output] (renderer)
 * @property {string} createdAt   ISO date
 *
 * @typedef {Object} ProgressEvent
 * @property {'storyboard'|'art'|'voice'|'render'|'done'|'error'} stage
 * @property {number} progress   overall 0..1
 * @property {string} message    Thai, user-facing
 * @property {Object} [detail]   e.g. {sceneId, storyboard, art}
 */

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/** Validate & normalise a storyboard in place. Throws Error with all problems listed. */
export function validateStoryboard(sb) {
  const errs = [];
  if (!sb || typeof sb !== 'object') throw new Error('storyboard is not an object');
  for (const k of ['title', 'logline', 'genre', 'style']) if (!isStr(sb[k])) errs.push(`missing ${k}`);
  if (sb.genre && !GENRES[sb.genre]) errs.push(`unknown genre ${sb.genre}`);
  if (sb.style && !STYLES[sb.style]) errs.push(`unknown style ${sb.style}`);
  if (!isStr(sb.hook)) sb.hook = sb.title;
  if (!Array.isArray(sb.palette) || sb.palette.length < 3) sb.palette = STYLES[sb.style]?.swatch ?? ['#111', '#888', '#eee'];
  if (!Array.isArray(sb.characters)) sb.characters = [];
  const ids = new Set(['narrator']);
  sb.characters.forEach((c, i) => {
    if (!isStr(c.id)) errs.push(`characters[${i}].id missing`);
    if (!isStr(c.name)) errs.push(`characters[${i}].name missing`);
    if (!VOICE_ROLES.includes(c.voice) || c.voice === 'narrator') c.voice = 'female';
    if (!isStr(c.visual)) c.visual = c.name;
    ids.add(c.id);
  });
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) errs.push('no scenes');
  (sb.scenes || []).forEach((s, i) => {
    s.id = `s${String(i + 1).padStart(2, '0')}`;
    if (!isStr(s.heading)) s.heading = `ฉากที่ ${i + 1}`;
    if (!isStr(s.visual)) errs.push(`${s.id}.visual missing`);
    if (!isStr(s.mood)) s.mood = 'neutral';
    if (!CAMERA_MOVES.includes(s.camera)) s.camera = CAMERA_MOVES[i % 2];
    if (!Array.isArray(s.lines) || s.lines.length === 0) errs.push(`${s.id}.lines empty`);
    (s.lines || []).forEach((l, j) => {
      if (!isStr(l.text)) errs.push(`${s.id}.lines[${j}].text missing`);
      if (!ids.has(l.speaker)) l.speaker = 'narrator';
    });
  });
  if (errs.length) throw new Error('Invalid storyboard: ' + errs.join('; '));
  return sb;
}

/** Voice role for a line's speaker. */
export function voiceRoleFor(sb, speaker) {
  if (speaker === 'narrator') return 'narrator';
  return sb.characters.find((c) => c.id === speaker)?.voice ?? 'narrator';
}

export function slugify(text) {
  const ascii = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return (ascii ? ascii + '-' : 'reel-') + stamp;
}
