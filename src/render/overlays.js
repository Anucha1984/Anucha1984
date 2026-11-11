// Everything that is text on screen: caption chunks, speaker chips, hook title card,
// moral card, series badge / end tag, poster. Drawn by Chromium with bundled Thai fonts.
import fsp from 'node:fs/promises';
import path from 'node:path';
import { GENRES } from '../shared/presets.js';
import { chunkCaption, timeChunks, tokenize, visibleLength, CAPTION_MAX } from './captions.js';
import { fontFaceCss, fontFatten, fontLineHeight, fontScale, resolveFont } from './fonts.js';
import { renderOverlayItems, screenshotHtml } from './browser.js';
import { HEIGHT, TIMING, WIDTH } from './timeline.js';
import { escapeHtml } from './util.js';

// TikTok/Reels safe area on a 1080×1920 canvas: keep text out of the bottom ~18 %
// (caption/description UI), the right-hand button column and the top status area.
export const SAFE = { left: 64, right: 176, top: 190, bottom: Math.round(HEIGHT * 0.18) + 6 };
const CAPTION_BOX = { left: SAFE.left, width: WIDTH - SAFE.left - SAFE.right };

const hexOk = (c) => (/^#[0-9a-f]{3,8}$/i.test(c ?? '') ? c : '#F5A524');

/** Thai words as unbreakable spans; the browser may only wrap between words. */
function wordsHtml(text) {
  return tokenize(text)
    .map((t) => `<span class="w">${escapeHtml(t.text)}</span>${t.spaceAfter ? ' ' : '<wbr>'}`)
    .join('');
}

/** Text with a thick dark outline: a stroked copy underneath, the clean fill on top. */
function outlined(text, cls = '') {
  const inner = wordsHtml(text);
  return `<div class="ol ${cls}"><span class="ol-s" aria-hidden="true">${inner}</span><span class="ol-f">${inner}</span></div>`;
}

function baseCss(font, accent) {
  const k = fontScale(font);
  const px = (n) => `${Math.round(n * k)}px`;
  return `
${fontFaceCss(font)}
*{box-sizing:border-box}
.stage{font-family:'${font}','Kanit',sans-serif;color:#fff;font-weight:700;font-synthesis:none}
.w{white-space:nowrap}
.ol{display:grid;text-align:center;text-wrap:balance;line-height:${fontLineHeight(font)}}
.ol>span{grid-area:1/1}
.ol-s{color:#07070c;-webkit-text-stroke:var(--stroke,14px) #07070c;stroke-linejoin:round;text-shadow:0 8px 18px rgba(0,0,0,.6)}
.ol-f{position:relative;-webkit-text-stroke:${fontFatten(font)}px currentColor}
.badge,.endbadge,.chip,.label{-webkit-text-stroke:${fontFatten(font) / 2}px currentColor}

/* captions */
.cap{position:absolute;left:${CAPTION_BOX.left}px;width:${CAPTION_BOX.width}px;bottom:${SAFE.bottom}px;
  display:flex;flex-direction:column;align-items:center;gap:6px;padding:48px 14px 30px}
.cap .ol{font-size:${px(68)};letter-spacing:.3px}
.cap.long .ol{font-size:${px(60)}}
.cap.talk .ol-f{color:#FFF6D6}
.chip{font-size:${px(40)};line-height:1.25;padding:6px 30px 8px;border-radius:999px;background:rgba(7,7,12,.86);
  color:${accent};border:3px solid ${accent};box-shadow:0 6px 16px rgba(0,0,0,.45);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}

/* hook title card */
.title{position:absolute;left:0;top:0;width:${WIDTH}px;padding:${SAFE.top + 40}px 80px 220px;
  display:flex;flex-direction:column;align-items:center;gap:26px;
  background:linear-gradient(180deg,rgba(5,5,10,.82) 0%,rgba(5,5,10,.62) 45%,rgba(5,5,10,0) 100%)}
.badge{font-size:${px(44)};line-height:1.2;padding:10px 40px 12px;border-radius:999px;background:${accent};color:#0b0b12;
  box-shadow:0 8px 22px rgba(0,0,0,.45);white-space:nowrap}
.hook{--stroke:18px;max-width:920px}
.hook .ol-f{color:#fff}
.bar{width:220px;height:10px;border-radius:5px;background:${accent};box-shadow:0 4px 14px rgba(0,0,0,.5)}
.sub{--stroke:11px;font-size:${px(54)};max-width:880px}
.sub .ol-f{color:${accent}}

/* moral + end tag */
.card{position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px;padding:0 ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;
  background:radial-gradient(ellipse at 50% 45%,rgba(5,5,10,.78) 0%,rgba(5,5,10,.6) 60%,rgba(5,5,10,.45) 100%)}
.label{display:flex;align-items:center;gap:22px;font-size:${px(46)};color:${accent};line-height:1.2;white-space:nowrap}
.label i{display:block;width:90px;height:5px;border-radius:3px;background:${accent}}
.moral{--stroke:12px;font-size:${px(64)};max-width:${CAPTION_BOX.width}px}
.next{--stroke:12px;font-size:${px(60)};max-width:${CAPTION_BOX.width}px}
.endbadge{font-size:${px(58)};padding:14px 54px 18px;border-radius:999px;background:${accent};color:#0b0b12;
  box-shadow:0 10px 26px rgba(0,0,0,.5);white-space:nowrap;line-height:1.2}
.ep{font-size:${px(40)};color:rgba(255,255,255,.86);font-weight:400;white-space:nowrap}
`;
}

function hookSize(text, font) {
  const n = visibleLength(text);
  const base = n <= 8 ? 150 : n <= 12 ? 132 : n <= 18 ? 112 : n <= 26 ? 94 : n <= 36 ? 80 : 68;
  return Math.round(base * fontScale(font));
}

function titleCardHtml(sb, font) {
  const hook = String(sb.hook || sb.title || '').trim();
  const title = String(sb.title || '').trim();
  const ep = Number(sb.series?.episode);
  const parts = [];
  if (sb.series && ep > 0) parts.push(`<div class="badge">ตอนที่ ${escapeHtml(ep)}</div>`);
  parts.push(`<div style="font-size:${hookSize(hook, font)}px;display:contents">${outlined(hook, 'hook')}</div>`);
  parts.push('<div class="bar"></div>');
  if (title && title !== hook) parts.push(outlined(title, 'sub'));
  return `<div class="item title">${parts.join('')}</div>`;
}

function moralHtml(sb) {
  return `<div class="item card"><div class="label"><i></i>ข้อคิดจากเรื่องนี้<i></i></div>${outlined(String(sb.moral).trim(), 'moral')}</div>`;
}

function endTagHtml(sb) {
  const s = sb.series || {};
  const parts = ['<div class="endbadge">ติดตามตอนต่อไป</div>'];
  if (String(s.nextHook || '').trim()) parts.push(outlined(String(s.nextHook).trim(), 'next'));
  const ep = Number(s.episode);
  if (ep > 0) parts.push(`<div class="ep">${escapeHtml(s.title || sb.title || '')} · จบตอนที่ ${escapeHtml(ep)}</div>`);
  return `<div class="item card">${parts.join('')}</div>`;
}

const stage = (id, inner) => `<section class="stage" data-id="${id}">${inner}</section>`;

/**
 * Plan every overlay of the video from the timeline (no rendering yet).
 * @returns {{font:string,accent:string,css:string,items:Array,cues:Array}}
 *   items: {id, sceneIndex, html, start, end (scene-relative seconds), fade:boolean}
 *   cues:  {start,end (absolute seconds), text, speaker?} for the .srt
 */
export function planOverlays(sb, timeline) {
  const genre = GENRES[sb.genre] ?? GENRES.folktale;
  const font = resolveFont(genre.captionFont);
  const accent = hexOk(genre.accent);
  const names = new Map((sb.characters || []).map((c) => [c.id, c.name]));
  const items = [];
  const cues = [];

  for (const sc of timeline.scenes) {
    const sid = sc.scene.id;
    sc.lines.forEach((entry, j) => {
      const speaker = entry.line.speaker !== 'narrator' ? names.get(entry.line.speaker) : null;
      const chunks = timeChunks(chunkCaption(entry.line.text), entry.start, entry.dur);
      chunks.forEach((c, k) => {
        const long = visibleLength(c.text) > CAPTION_MAX * 0.8;
        const chip = speaker ? `<div class="chip">${escapeHtml(speaker)}</div>` : '';
        items.push({
          id: `${sid}-${j + 1}-${k + 1}`,
          sceneIndex: sc.index,
          kind: 'caption',
          html: `<div class="item cap${speaker ? ' talk' : ''}${long ? ' long' : ''}">${chip}${outlined(c.text)}</div>`,
          start: c.start,
          // keep the last chunk of a line on screen through the short pause after it
          end: k === chunks.length - 1 ? c.end + Math.min(0.2, TIMING.gap * 0.6) : c.end,
          fade: false,
        });
        cues.push({ start: sc.start + c.start, end: sc.start + c.end, text: c.text, speaker: speaker || undefined });
      });
    });
    if (sc.index === 0) {
      const end = Math.min(TIMING.titleMax, sc.moral?.start ?? sc.endTag?.start ?? sc.dur);
      items.push({ id: 'title', sceneIndex: 0, kind: 'title', html: titleCardHtml(sb, font), start: 0, end, fade: true, fadeIn: 0 });
    }
    if (sc.moral) {
      items.push({ id: 'moral', sceneIndex: sc.index, kind: 'card', html: moralHtml(sb), start: sc.moral.start, end: sc.moral.start + sc.moral.dur, fade: true });
    }
    if (sc.endTag) {
      items.push({ id: 'endtag', sceneIndex: sc.index, kind: 'card', html: endTagHtml(sb), start: sc.endTag.start, end: sc.dur, fade: true });
    }
  }
  return { font, accent, css: baseCss(font, accent), items, cues };
}

/** Draw all planned overlays into captions/*.png; fills item.file/x/y/w/h. */
export async function renderOverlays(browser, plan, projectDir) {
  const outDir = path.join(projectDir, 'captions');
  await fsp.rm(outDir, { recursive: true, force: true });
  const drawn = await renderOverlayItems(browser, {
    css: plan.css,
    stages: plan.items.map((it) => stage(it.id, it.html)).join('\n'),
    ids: plan.items.map((it) => it.id),
    outDir,
    relDir: 'captions',
    width: WIDTH,
    height: HEIGHT,
  });
  for (const it of plan.items) Object.assign(it, drawn[it.id] ?? {});
  return plan.items.filter((it) => it.file);
}

/** poster.jpg: first scene frame + hook title card. */
export async function renderPoster(browser, sb, plan, projectDir, framePath) {
  const frame = await fsp.readFile(path.join(projectDir, framePath));
  const html =
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0b0b14}` +
    `.stage{position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}` +
    `.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}` +
    `.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)}${plan.css}</style>` +
    `<section class="stage"><img class="bg" src="data:image/png;base64,${frame.toString('base64')}"><div class="shade"></div>${titleCardHtml(sb, plan.font)}</section>`;
  await screenshotHtml(browser, html, path.join(projectDir, 'poster.jpg'), { width: WIDTH, height: HEIGHT });
  return 'poster.jpg';
}
