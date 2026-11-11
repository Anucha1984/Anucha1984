// Storyboard generation: one Claude call → Thai script + art direction as JSON (see src/shared/schema.js).
import { CAMERA_MOVES, GENRES, STYLES, VOICE_ROLES, resolveOptions } from '../shared/presets.js';
import { validateStoryboard } from '../shared/schema.js';
import { completeJson } from './llm.js';

const SYSTEM = `You are the head writer and art director of "NiThan Studio", a studio that makes vertical 9:16 short videos for Thai TikTok / Reels audiences. Each video is a sequence of still illustrated scenes (one striking illustration per scene, slow camera move) with Thai voice-over and Thai captions.

You write like a professional Thai scriptwriter: natural, vivid, spoken Thai that sounds right when read aloud. You also direct the illustrator, in English, with concrete, drawable shot descriptions.

You always reply with a single valid JSON object and nothing else.`;

/** Build {system, prompt} for the storyboard call. Pure; exported for tests. */
export function buildStoryboardPrompt(input) {
  const opts = input?.scenes && GENRES[input.genre] && STYLES[input.style] ? input : resolveOptions(input);
  const genre = GENRES[opts.genre];
  const style = STYLES[opts.style];
  const n = opts.scenes;
  const s = opts.series && typeof opts.series === 'object' ? opts.series : null;
  const prevEp = Number(s?.episode) || 0;
  const voices = VOICE_ROLES.filter((v) => v !== 'narrator');
  const idea = opts.prompt || s?.title || genre.examples[0];

  const seriesBlock = s
    ? `## Series continuation — write EPISODE ${prevEp + 1}
This is the next episode of an ongoing series. Continue the SAME story with the SAME characters (same names, same ids, same looks); do not restart or retell the previous episode.
- Series title: ${s.title || idea}
- Previous episode: ${prevEp}
- Story so far: ${s.summary || '(not recorded)'}
- The previous episode ended on this hook, which this episode must pick up and pay off in its first scene: ${s.nextHook || '(not recorded)'}
${Array.isArray(s.characters) && s.characters.length ? `- Returning characters (reuse these ids, names, voices and visual descriptors verbatim; add new characters only if the story needs them):\n${JSON.stringify(s.characters, null, 1)}\n` : ''}Open with a one-sentence spoken recap ("ความเดิมตอนที่แล้ว…") only if it helps, then move the story forward. "title" should be the series title plus the episode, e.g. "${s.title || idea} ตอนที่ ${prevEp + 1}". In "series", set episode to ${prevEp + 1}, and make "summary" cover the WHOLE story so far including this episode.`
    : `## Series
This is episode 1. Fill "series" so a next episode can be generated later: series.title (the series name), episode 1, a summary of this episode, and nextHook (what would pull the viewer into the next episode${opts.genre === 'cdrama' ? ' — the cliffhanger' : ''}).`;

  const prompt = `# Brief
Idea from the user (Thai): «${idea}»
${opts.prompt && s ? '(The user\'s idea above is a direction for this new episode.)\n' : ''}
## Genre: ${genre.name} (${genre.id})
${genre.writing}

## Art style the illustrator will use: ${style.name} / ${style.subtitle} (${style.id})
${style.art}

${seriesBlock}

## Length
Exactly ${n} scenes. The whole video is about ${Math.round(n * 7.5)} seconds, so every line must earn its place. Structure: scene 1 is the hook that stops the scroll; build steadily; the peak lands around scene ${Math.max(2, n - 1)}; the last scene resolves${opts.genre === 'cdrama' ? ' on a cliffhanger' : ' and delivers the ending'}.

## Thai script rules (text is read by a Thai text-to-speech voice AND shown as a caption)
- Natural spoken Thai, the way a good Thai narrator or voice actor would say it. Short sentences. No English words where Thai has an everyday word.
- 1 to 3 lines per scene. Each line at most about 120 Thai characters (one breath). Prefer 2 lines in most scenes.
- "speaker" is "narrator" or a character id. Narration carries the story; character lines are short, in-character dialogue (include a few — they bring scenes alive).
- No emojis, no emoticons, no stage directions or brackets, no "(เสียงกรีดร้อง)". Sound effects only as words a voice can actually say.
- Write numbers and times as Thai words so TTS reads them right ("ตีสอง", "สามวัน", "หนึ่งบาท"), no digits, no ๆ doubled awkwardly, no abbreviations like "พ.ศ.". Avoid symbols (%, /, &, …). Use plain punctuation only.
- "hook": at most 40 Thai characters, punchy, shown huge on the cover. "title": short Thai title. "logline": one Thai sentence.
- If this is a known traditional tale, keep its canonical plot, characters and names; compress, do not invent a different story.
${opts.genre === 'cdrama' ? '' : '- "moral": one closing Thai sentence with the lesson, said by the narrator in spirit (also say it, or its substance, in the last scene\'s lines).\n'}
## Character rules
- 2 to 5 characters who actually appear. "id": short lowercase ascii kebab-case (e.g. "ueay", "old-monk"). "name": Thai name. "voice": one of ${voices.map((v) => `"${v}"`).join(', ')}.
- "visual": ENGLISH model-sheet description the illustrator reuses in every scene so the character always looks the same: apparent age and build, face shape and distinctive features, hair (style + colour), exact outfit with colours (give hex codes taken from or harmonising with the palette), and one signature item/silhouette cue. 30–55 words. Period/culture-correct for the story (e.g. traditional Thai dress for folktales).

## Scene art direction rules ("visual", in ENGLISH, 45–90 words each)
The illustrator sees ONLY this text plus the character sheets, one scene at a time, and draws a single still image as vector art on a tall 1080x1920 (9:16) canvas. So for each scene:
- Describe ONE clear moment, not a sequence. Name which characters appear by their id in backticks, e.g. \`ueay\`, with pose, facial expression and where they stand in the frame. At most 2–3 figures; one dominant subject.
- Compose vertically: say what fills the top, the middle and the bottom of the frame; give the shot size and angle (close-up, low angle, over-the-shoulder, wide establishing…). Vary shot sizes between consecutive scenes, and include at least one dramatic close-up of a face.
- Keep the main subject and all faces in the upper/middle of the frame; the lower quarter must stay visually calm (ground, water, floorboards, mist, shadow) because captions cover it.
- Give setting, time of day, light source and colour mood, and 2–4 concrete props or background elements that sell the place and era.
- No text, signs, letters or speech bubbles in the image. Nothing gory or graphic; horror comes from light, shadow, silhouette and expression.
- "mood": one or two English words (eerie, warm, tense, sad, triumphant, romantic, shocking…). "camera": one of ${CAMERA_MOVES.map((c) => `"${c}"`).join(', ')} — choose what suits the image (zoom-in for reveals and faces, pan-up/down for tall subjects, static rarely).

## Palette
"palette": exactly 5 hex colours (#RRGGBB) that all scene art shares, suited to this story and to the ${style.id} style: [dark/shadow, main, secondary, accent, light/highlight].

# Output
Reply with ONLY this JSON object (no markdown fences, no commentary):
{
  "title": "…",
  "logline": "…",
  "hook": "…",
  "palette": ["#…", "#…", "#…", "#…", "#…"],
  "characters": [{ "id": "…", "name": "…", "voice": "…", "visual": "…" }],
  "scenes": [
    { "heading": "short Thai scene title", "visual": "English art direction", "mood": "…", "camera": "…",
      "lines": [{ "speaker": "narrator", "text": "…" }] }
  ],
  ${opts.genre === 'cdrama' ? '' : '"moral": "…",\n  '}"series": { "title": "…", "episode": ${prevEp + 1}, "summary": "Thai, 2–4 sentences", "nextHook": "Thai, one sentence" }
}`;
  return { system: SYSTEM, prompt };
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
// Emoji & pictographs, variation selectors, ZWJ — never wanted in TTS text.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;

export function cleanThai(text) {
  return String(text ?? '')
    .replace(EMOJI, '')
    .replace(/[*_`#]+/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function asciiId(raw, fallback) {
  const id = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id && id !== 'narrator' ? id : fallback;
}

/**
 * Normalise Claude's raw object into a contract-conforming Storyboard (without id/createdAt) and validate it.
 * Throws (with an English message that can be fed back to Claude) when it cannot be repaired.
 */
export function normalizeStoryboard(raw, opts) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('reply is not a JSON object');
  const style = STYLES[opts.style];
  const sb = { ...raw, genre: opts.genre, style: opts.style };
  for (const k of ['title', 'logline', 'hook', 'moral']) if (typeof sb[k] === 'string') sb[k] = cleanThai(sb[k]);
  if (!sb.moral) delete sb.moral;
  if (typeof sb.hook === 'string' && [...sb.hook].length > 40) sb.hook = [...sb.hook].slice(0, 40).join('').trim();

  const pal = (Array.isArray(sb.palette) ? sb.palette : []).map((c) => String(c).trim()).filter((c) => HEX.test(c));
  for (const c of [...style.swatch, '#101018', '#F5F0E6']) if (pal.length < 5 && !pal.includes(c)) pal.push(c);
  sb.palette = pal.slice(0, 5);

  const idMap = new Map();
  const used = new Set();
  sb.characters = (Array.isArray(sb.characters) ? sb.characters : [])
    .filter((c) => c && typeof c === 'object')
    .map((c, i) => {
      let id = asciiId(c.id, `c${i + 1}`);
      while (used.has(id)) id += '-x';
      used.add(id);
      idMap.set(String(c.id), id);
      if (c.name) idMap.set(String(c.name), id);
      return { id, name: cleanThai(c.name), voice: c.voice, visual: String(c.visual ?? '').trim() };
    });

  const scenes = Array.isArray(sb.scenes) ? sb.scenes.filter((s) => s && typeof s === 'object') : [];
  const tooFew = scenes.length < Math.max(1, Math.ceil(opts.scenes * 0.6));
  if (tooFew) throw new Error(`expected exactly ${opts.scenes} scenes but got ${scenes.length}`);
  sb.scenes = scenes.slice(0, Math.max(opts.scenes, 1) + 2).map((s) => ({
    heading: cleanThai(s.heading),
    visual: String(s.visual ?? '').trim(),
    mood: String(s.mood ?? '').trim(),
    camera: String(s.camera ?? '').trim(),
    lines: (Array.isArray(s.lines) ? s.lines : [])
      .filter((l) => l && typeof l === 'object')
      .slice(0, 4)
      .map((l) => ({ speaker: idMap.get(String(l.speaker)) ?? asciiId(l.speaker, 'narrator') ?? 'narrator', text: cleanThai(l.text) }))
      .filter((l) => l.text),
  }));
  // art direction refers to characters as `id`: keep those references in sync with normalised ids
  for (const s of sb.scenes) for (const [from, to] of idMap) if (from !== to && /^[\w-]+$/.test(from)) s.visual = s.visual.replaceAll('`' + from + '`', '`' + to + '`');

  const prevEp = Number(opts.series?.episode) || 0;
  const ser = sb.series && typeof sb.series === 'object' ? sb.series : {};
  sb.series = {
    title: cleanThai(ser.title) || cleanThai(opts.series?.title) || sb.title,
    episode: prevEp + 1,
    summary: cleanThai(ser.summary) || sb.logline || '',
    nextHook: cleanThai(ser.nextHook) || '',
    // extra (additive) field: lets the next episode reuse the exact same character sheets
    characters: sb.characters.map((c) => ({ ...c })),
  };
  return validateStoryboard(sb);
}

/**
 * Write the storyboard for a one-line idea (or the next episode when opts.series is given).
 * @param {object} opts  resolved options (see resolveOptions) — prompt, genre, style, scenes, series, model
 * @param {{onProgress?:(ev:{progress:number,message:string})=>void, llm?:Function}} [ctx]
 * @returns {Promise<import('../shared/schema.js').Storyboard>}  without id / createdAt / art
 */
export async function generateStoryboard(opts, { onProgress, llm } = {}) {
  const o = opts?.scenes && GENRES[opts.genre] && STYLES[opts.style] ? opts : resolveOptions(opts);
  const genre = GENRES[o.genre];
  const ep = (Number(o.series?.episode) || 0) + 1;
  const { system, prompt } = buildStoryboardPrompt(o);
  onProgress?.({ progress: 0.05, message: ep > 1 ? `Claude กำลังเขียนบทตอนที่ ${ep} ต่อจากตอนเดิม…` : `Claude กำลังเขียนบท${genre.name} ${o.scenes} ฉาก…` });

  // Keep the UI alive while the single long call runs (typically 40–90 s).
  const started = Date.now();
  const hints = ['วางโครงเรื่องและตัวละคร…', 'เขียนบทพากย์ภาษาไทย…', 'กำกับภาพแต่ละฉาก…', 'ขัดเกลาบทให้ลื่นหู…'];
  let tick = 0;
  const timer = onProgress
    ? setInterval(() => {
        const sec = (Date.now() - started) / 1000;
        onProgress({ progress: Math.min(0.9, 0.05 + sec / 110), message: hints[Math.min(hints.length - 1, tick++)] });
      }, 12000)
    : null;
  timer?.unref?.();
  try {
    const sb = await completeJson(
      { system, prompt, model: o.model, maxTokens: 16000 },
      { validate: (raw) => normalizeStoryboard(raw, o), llm },
    );
    onProgress?.({ progress: 0.98, message: `เขียนบทเสร็จแล้ว: ${sb.title}` });
    return sb;
  } finally {
    if (timer) clearInterval(timer);
  }
}
