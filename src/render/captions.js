// Caption text logic: Thai word segmentation, chunking, proportional timing, SRT.
// (Pure functions — the pixels are drawn in overlays.js.)

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

/** Max visible characters per caption chunk (≈ two lines at caption size). */
export const CAPTION_MAX = 34;

const OPENERS = /^[“‘"'(\[{«]+$/u;
const REPEATERS = /^[ๆฯ]/u;

/** Characters that occupy horizontal space: no whitespace, no combining marks (Thai upper/lower vowels, tone marks). */
export function visibleLength(text) {
  return String(text ?? '').replace(/[\s\p{M}]/gu, '').length;
}

/**
 * Split text into unbreakable tokens. Punctuation sticks to the word before it,
 * opening quotes/brackets to the word after. `spaceAfter` marks a natural phrase break.
 * @returns {{text:string, spaceAfter:boolean}[]}
 */
export function tokenize(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  const tokens = [];
  let prefix = '';
  for (const { segment, isWordLike } of segmenter.segment(clean)) {
    if (/^\s+$/.test(segment)) {
      if (tokens.length) tokens[tokens.length - 1].spaceAfter = true;
      continue;
    }
    if (!isWordLike && OPENERS.test(segment)) {
      prefix += segment;
      continue;
    }
    const prev = tokens[tokens.length - 1];
    const glue = (!isWordLike || REPEATERS.test(segment) || /^\p{M}/u.test(segment)) && prev && !prev.spaceAfter && !prefix;
    if (glue) prev.text += segment;
    else {
      tokens.push({ text: prefix + segment, spaceAfter: false });
      prefix = '';
    }
  }
  if (prefix) {
    if (tokens.length) tokens[tokens.length - 1].text += prefix;
    else tokens.push({ text: prefix, spaceAfter: false });
  }
  return tokens;
}

const joinTokens = (tokens) =>
  tokens
    .map((t, i) => t.text + (t.spaceAfter && i < tokens.length - 1 ? ' ' : ''))
    .join('')
    .trim();

/**
 * Split one spoken line into caption chunks of at most `max` visible characters,
 * balanced in length, breaking at spaces when possible and never inside a Thai word.
 * @returns {string[]}
 */
export function chunkCaption(text, max = CAPTION_MAX) {
  const tokens = tokenize(text);
  if (!tokens.length) return [];
  const lens = tokens.map((t) => visibleLength(t.text));
  const total = lens.reduce((a, b) => a + b, 0);
  if (total <= max) return [joinTokens(tokens)];

  const chunks = [];
  let start = 0;
  let remaining = total;
  while (start < tokens.length) {
    if (remaining <= max) {
      chunks.push(joinTokens(tokens.slice(start)));
      break;
    }
    const target = remaining / Math.ceil(remaining / max);
    let len = 0;
    let best = -1;
    let bestCost = Infinity;
    for (let i = start; i < tokens.length - 1; i++) {
      len += lens[i];
      if (len > max && best >= 0) break;
      // cost: distance from the balanced target; a space is a much nicer place to cut
      const cost = Math.abs(len - target) - (tokens[i].spaceAfter ? target * 0.35 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
      if (len > max) break; // single oversized token: accept it alone
    }
    if (best < 0) best = start;
    chunks.push(joinTokens(tokens.slice(start, best + 1)));
    for (let i = start; i <= best; i++) remaining -= lens[i];
    start = best + 1;
  }
  return chunks.filter(Boolean);
}

/**
 * Distribute a line's duration over its chunks, proportional to their length.
 * @returns {{text:string,start:number,end:number}[]}
 */
export function timeChunks(chunks, start, duration) {
  if (!chunks.length) return [];
  const weights = chunks.map((c) => visibleLength(c) + 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = start;
  return chunks.map((text, i) => {
    const d = (duration * weights[i]) / sum;
    const cue = { text, start: t, end: i === chunks.length - 1 ? start + duration : t + d };
    t += d;
    return cue;
  });
}

/** Word spans for HTML: each Thai word is unbreakable, breaks allowed between words only. */
export function wordsForHtml(text) {
  return tokenize(text);
}

export function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/** @param {{start:number,end:number,text:string,speaker?:string}[]} cues absolute seconds */
export function buildSrt(cues) {
  return (
    cues
      .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.speaker ? `${c.speaker}: ` : ''}${c.text}\n`)
      .join('\n')
  );
}
