// สร้าง — the "one command" screen.
import { api } from '../api.js';
import { setGenreTint } from '../app.js';
import { ICONS, genreArt, styleThumb } from '../art.js';
import { autoGrow, clear, copyText, h, svg, thaiNum, toast } from '../dom.js';

const DRAFT_KEY = 'nithan.draft.v1';
const MAX_PROMPT = 500;

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch {
    return {};
  }
}
function saveDraft(state) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

/** Quote for a POSIX shell, keeping the common case pretty: nithan "ปลาบู่ทอง" */
function shellQuote(text) {
  return '"' + text.replace(/(["\\$`])/g, '\\$1') + '"';
}

export function cliTokens(state, presets) {
  const t = [
    ['cmd', 'nithan'],
    ['str', shellQuote(state.prompt.trim() || 'ชื่อเรื่องของคุณ')],
    ['flag', '--genre'], ['val', state.genre],
    ['flag', '--style'], ['val', state.style],
  ];
  if (state.length !== presets.defaults.length) t.push(['flag', '--length'], ['val', state.length]);
  if (!state.voice) t.push(['flag', '--tts'], ['val', 'none']);
  if (!state.music) t.push(['flag', '--no-music']);
  if (state.mock) t.push(['flag', '--mock']);
  return t;
}

export function mountCreate(root, { presets }) {
  const genres = Object.values(presets.genres);
  const styles = Object.values(presets.styles);
  const lengths = Object.values(presets.lengths);
  const draft = loadDraft();
  const genre0 = presets.genres[draft.genre] ? draft.genre : presets.defaults.genre;
  const state = {
    prompt: typeof draft.prompt === 'string' ? draft.prompt.slice(0, MAX_PROMPT) : '',
    genre: genre0,
    style: presets.styles[draft.style] ? draft.style : presets.genres[genre0].defaultStyle,
    length: presets.lengths[draft.length] ? draft.length : presets.defaults.length,
    voice: draft.voice !== false,
    music: draft.music !== false,
    mock: Boolean(draft.mock),
  };
  const defaultStyleFor = (g) => (presets.image?.realistic || !presets.styles[g.defaultStyle]?.needsImageModel ? g.defaultStyle : g.cartoonStyle || g.defaultStyle);
  if (!presets.styles[draft.style] || (draft.autoStyle && draft.style !== defaultStyleFor(presets.genres[genre0]))) state.style = defaultStyleFor(presets.genres[genre0]);
  let styleTouched = Boolean(draft.style && !draft.autoStyle && draft.style !== presets.genres[genre0].defaultStyle);
  let busy = false;

  // ── ๑ prompt
  const counter = h('span', { aria: { hidden: 'true' } });
  const promptEl = autoGrow(
    h('textarea', {
      id: 'prompt',
      rows: 2,
      maxLength: MAX_PROMPT,
      placeholder: 'พิมพ์ชื่อเรื่องหรือไอเดีย 1 บรรทัด…',
      value: state.prompt,
      enterKeyHint: 'go',
      aria: { label: 'ชื่อเรื่องหรือไอเดีย', describedby: 'prompt-hint' },
      oninput: () => {
        state.prompt = promptEl.value;
        sync();
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          submit();
        }
      },
    }),
  );
  const chipsLabel = h('p', { class: 'chips-label' });
  const chips = h('div', { class: 'chips' });

  // ── ๒ genre
  const genreGrid = h(
    'div',
    { class: 'genre-grid', role: 'radiogroup', aria: { labelledby: 'st-genre' } },
    genres.map((g) =>
      h(
        'label',
        { class: 'pick' },
        h('input', {
          type: 'radio',
          name: 'genre',
          value: g.id,
          checked: g.id === state.genre,
          onchange: () => {
            state.genre = g.id;
            if (!styleTouched) state.style = defaultStyleFor(g);
            sync(true);
          },
        }),
        h('span', { class: 'genre-card', vars: { '--g': g.accent } }, h('span', { class: 'genre-art' }, svg(genreArt(g.id))), h('span', { class: 'genre-body' }, h('span', { class: 'genre-name' }, g.name), h('span', { class: 'genre-tag' }, g.tagline))),
        h('span', { class: 'tick' }, svg(ICONS.check)),
      ),
    ),
  );

  // ── ๓ style
  const realGrid = h('div', { class: 'style-grid real', role: 'radiogroup', aria: { labelledby: 'st-style' } });
  const toonGrid = h('div', { class: 'style-grid', role: 'radiogroup', aria: { label: 'ลายเส้นการ์ตูน' } });
  const styleInputs = new Map();
  const recoTags = new Map();
  const img = presets.image || { realistic: false, provider: 'claude' };
  const imageCard = h(
    'div',
    { class: 'image-status' + (img.realistic ? ' ok' : '') },
    svg(img.realistic ? ICONS.check : ICONS.alert),
    h(
      'div',
      { class: 'image-status-body' },
      h('span', { class: 'image-status-title' }, img.realistic ? `ภาพสมจริงพร้อมใช้ · วาดด้วย ${{ cloudflare: 'FLUX.2 (Cloudflare, ฟรี)', gemini: 'Gemini', openai: 'OpenAI' }[img.provider] || img.provider}` : 'ภาพสมจริงยังไม่พร้อม — ต้องใส่คีย์โมเดลภาพก่อน (Cloudflare ใช้ฟรี)'),
      h('span', { class: 'dim' }, img.realistic ? 'ล็อกหน้าตัวละครให้เหมือนกันทุกฉากอัตโนมัติ' : 'ระหว่างนี้เลือกลายเส้นการ์ตูนได้ Claude วาดให้เอง'),
    ),
    h('a', { class: 'btn btn-sm ' + (img.realistic ? 'btn-ghost' : 'btn-primary'), href: '#/settings' }, svg(ICONS.gear), img.realistic ? 'ตั้งค่า' : 'ใส่คีย์'),
  );
  for (const s of styles) {
    const input = h('input', {
      type: 'radio',
      name: 'style',
      value: s.id,
      onchange: () => {
        state.style = s.id;
        styleTouched = s.id !== presets.genres[state.genre].defaultStyle;
        sync();
      },
    });
    const reco = h('span', { class: 'reco', hidden: true }, 'แนะนำ');
    styleInputs.set(s.id, input);
    recoTags.set(s.id, reco);
    (s.needsImageModel ? realGrid : toonGrid).append(
      h('label', { class: 'pick' + (s.needsImageModel && !img.realistic ? ' locked' : '') }, input, h('span', { class: 'style-card' }, h('span', { class: 'style-thumb' }, svg(styleThumb(s))), h('span', { class: 'style-body' }, h('span', { class: 'style-name' }, s.name), h('span', { class: 'style-sub' }, s.needsImageModel ? (img.realistic ? s.subtitle : 'ต้องใส่คีย์ก่อน') : s.subtitle))), reco, h('span', { class: 'tick' }, svg(ICONS.check))),
    );
  }
  const styleGrid = h(
    'div',
    { class: 'style-groups' },
    h('div', { class: 'style-group' }, h('h3', { class: 'style-group-title' }, 'ภาพสมจริง', h('span', { class: 'dim' }, ' · โมเดลภาพ + ล็อกหน้าตัวละคร')), imageCard, realGrid),
    h('div', { class: 'style-group' }, h('h3', { class: 'style-group-title' }, 'การ์ตูน', h('span', { class: 'dim' }, ' · Claude วาดเอง ไม่ต้องใช้คีย์')), toonGrid),
  );

  // ── ๔ length + more
  const seg = h(
    'div',
    { class: 'seg', role: 'radiogroup', aria: { labelledby: 'st-length' } },
    lengths.map((l) => {
      const [name, approx] = String(l.name).split(/\s+(?=~)/);
      return h(
        'label',
        { class: 'pick' },
        h('input', { type: 'radio', name: 'length', value: l.id, checked: l.id === state.length, onchange: () => ((state.length = l.id), sync()) }),
        h('span', { class: 'seg-item' }, h('span', { class: 'seg-name' }, name + (approx ? ' ' + approx.replace('~', '≈ ') : '')), h('span', { class: 'seg-sub' }, `${l.scenes} ฉาก`)),
      );
    }),
  );
  const toggle = (key, title, hint) =>
    h(
      'label',
      { class: 'switch' },
      h('span', { class: 'switch-text' }, h('span', { class: 'switch-title' }, title), h('span', { class: 'switch-hint' }, hint)),
      h('input', { type: 'checkbox', role: 'switch', checked: state[key], onchange: (e) => ((state[key] = e.target.checked), sync()) }),
      h('span', { class: 'switch-track' }),
    );
  const more = h(
    'details',
    { class: 'more', open: !state.voice || !state.music || state.mock },
    h('summary', null, 'ตั้งค่าเพิ่มเติม', svg(ICONS.chevron)),
    h(
      'div',
      { class: 'more-body' },
      toggle('voice', 'เสียงพากย์ไทย', 'ให้ AI พากย์ทุกบรรทัด (ต้องต่ออินเทอร์เน็ต) ปิดแล้วจะได้ซับไทยกับดนตรี'),
      toggle('music', 'ดนตรีประกอบ', 'เพลงคลอเบา ๆ ตามอารมณ์ของเรื่อง'),
      toggle('mock', 'โหมดทดลอง', 'ลองดูขั้นตอนด้วยบทและภาพตัวอย่าง โดยไม่เรียก Claude'),
    ),
  );

  // ── ticket
  const phoneArt = h('div', { class: 'phone', aria: { hidden: 'true' } });
  const phoneCap = h('div', { class: 'phone-cap' });
  const sumGenre = h('dd');
  const sumStyle = h('dd');
  const sumLen = h('dd');
  const cliPre = h('pre', { aria: { label: 'คำสั่งที่เทียบเท่า' } });
  const copyBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: copyCli }, svg(ICONS.copy), 'คัดลอก');
  const cta = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, svg(ICONS.spark), h('span', null, 'สร้างวิดีโอ'));
  const errorBox = h('div', { role: 'alert' });
  const ctaHint = h('p', { class: 'cta-hint' });

  const stepHead = (n, id, title, note) =>
    h('div', { class: 'step-head' }, h('span', { class: 'step-num', aria: { hidden: 'true' } }, thaiNum(n)), h('h2', { class: 'step-title', id }, title), note ? h('span', { class: 'step-note' }, note) : null);

  const form = h(
    'form',
    { class: 'create-grid', novalidate: true, onsubmit: (e) => (e.preventDefault(), submit()) },
    h(
      'div',
      { class: 'composer' },
      h(
        'section',
        { class: 'step' },
        stepHead(1, 'st-prompt', 'อยากเล่าเรื่องอะไร', 'กด Enter เพื่อสร้างได้เลย'),
        h('div', { class: 'prompt' }, h('div', { class: 'prompt-inner' }, promptEl, h('div', { class: 'prompt-foot' }, h('span', { id: 'prompt-hint' }, 'ชื่อนิทาน พล็อตสั้น ๆ หรือประโยคเดียวก็พอ'), counter))),
        h('div', null, chipsLabel, chips),
        errorBox,
      ),
      h('section', { class: 'step' }, stepHead(2, 'st-genre', 'เลือกแนวเรื่อง'), genreGrid),
      h('section', { class: 'step' }, stepHead(3, 'st-style', 'เลือกลายเส้น', 'เปลี่ยนได้ตามใจ ไม่ต้องตรงกับแนวเรื่อง'), styleGrid),
      h('section', { class: 'step' }, stepHead(4, 'st-length', 'ความยาว'), seg, more),
    ),
    h(
      'aside',
      { class: 'ticket card', aria: { label: 'สรุปก่อนสร้าง' } },
      h('p', { class: 'ticket-title' }, 'ตัวอย่างหน้าตาวิดีโอ 9:16'),
      h(
        'div',
        { class: 'preview-row' },
        phoneArt,
        h('dl', { class: 'summary' }, h('div', null, h('dt', null, 'แนวเรื่อง'), sumGenre), h('div', null, h('dt', null, 'ลายเส้น'), sumStyle), h('div', null, h('dt', null, 'ความยาว'), sumLen)),
      ),
      h('div', { class: 'cli' }, h('div', { class: 'cli-head' }, h('span', null, svg(ICONS.terminal), 'หรือสั่งด้วยคำสั่งเดียว'), copyBtn), cliPre),
      h('div', { class: 'cta-bar' }, cta, ctaHint),
    ),
  );

  root.append(
    h(
      'section',
      { class: 'hero' },
      h('span', { class: 'eyebrow' }, svg(ICONS.spark), 'สร้างวิดีโอด้วย Claude ในคำสั่งเดียว'),
      h('h1', null, 'พิมพ์บรรทัดเดียว ', h('em', null, 'ได้วิดีโอทั้งเรื่อง')),
      h('p', null, 'Claude เขียนบทและกำกับภาพทุกฉาก โมเดลภาพวาดให้สมจริงแบบหนัง ล็อกหน้าตัวละคร พากย์ไทย ใส่ซับ แล้วตัดต่อเป็นวิดีโอแนวตั้งพร้อมโพสต์'),
    ),
    form,
  );
  document.body.classList.add('has-bar');

  function cliString() {
    return cliTokens(state, presets).map(([, v]) => v).join(' ');
  }
  async function copyCli() {
    const ok = await copyText(cliString());
    toast(ok ? 'คัดลอกคำสั่งแล้ว วางในเทอร์มินัลได้เลย' : 'คัดลอกไม่สำเร็จ ลองเลือกข้อความแล้วคัดลอกเอง', ok ? 'info' : 'error');
  }

  function sync(genreChanged = false) {
    const g = presets.genres[state.genre];
    const s = presets.styles[state.style];
    const blocked = Boolean(s.needsImageModel && !img.realistic);
    cta.classList.toggle('btn-warn', blocked);
    ctaHint.textContent = blocked ? 'ลายเส้นนี้ต้องใส่คีย์โมเดลภาพก่อน หรือเลือกลายเส้นการ์ตูนแทน' : 'ใช้เวลาไม่กี่นาที ระหว่างรอดูภาพขึ้นทีละฉากได้';
    setGenreTint(state.genre);
    for (const [id, input] of styleInputs) input.checked = id === state.style;
    for (const [id, tag] of recoTags) tag.hidden = id !== defaultStyleFor(g) || id === state.style;
    counter.textContent = `${state.prompt.length}/${MAX_PROMPT}`;
    chipsLabel.textContent = `ยังนึกไม่ออก? แตะตัวอย่างแนว${g.name}`;
    if (genreChanged || !chips.childElementCount) {
      clear(chips).append(
        ...g.examples.map((ex) =>
          h('button', {
            class: 'chip',
            type: 'button',
            onclick: () => {
              state.prompt = ex;
              promptEl.value = ex;
              promptEl.dispatchEvent(new Event('input'));
              promptEl.focus();
            },
          }, ex),
        ),
      );
    }
    clear(phoneArt).append(svg(styleThumb(s)), phoneCap);
    phoneCap.textContent = state.prompt.trim() || 'ชื่อเรื่องของคุณ';
    phoneCap.style.fontFamily = `"${g.captionFont}", var(--font-ui)`;
    sumGenre.textContent = g.name;
    sumStyle.textContent = `${s.name} · ${s.subtitle}`;
    const len = presets.lengths[state.length];
    sumLen.textContent = `${len.name} · ${len.scenes} ฉาก`;
    clear(cliPre).append(...cliTokens(state, presets).flatMap(([kind, v], i) => [i ? ' ' : '', h('span', { class: 'tok-' + kind }, v)]));
    if (state.prompt.trim()) clear(errorBox);
    saveDraft({ ...state, autoStyle: !styleTouched });
  }

  async function submit() {
    if (busy) return;
    const prompt = state.prompt.trim();
    if (!prompt) {
      clear(errorBox).append(h('div', { class: 'notice error' }, svg(ICONS.alert), h('div', { class: 'notice-body' }, 'พิมพ์ชื่อเรื่องหรือไอเดียก่อนนะ หรือแตะตัวอย่างด้านล่างก็ได้')));
      promptEl.focus();
      return;
    }
    busy = true;
    cta.disabled = true;
    clear(cta).append(h('span', { class: 'spinner' }), h('span', null, 'กำลังเริ่ม…'));
    try {
      const { jobId } = await api.createJob({ prompt, genre: state.genre, style: state.style, length: state.length, tts: state.voice ? 'auto' : 'none', music: state.music, mock: state.mock });
      saveDraft({ ...state, prompt: '' });
      location.hash = `#/job/${jobId}`;
    } catch (err) {
      busy = false;
      cta.disabled = false;
      clear(cta).append(svg(ICONS.spark), h('span', null, 'สร้างวิดีโอ'));
      clear(errorBox).append(h('div', { class: 'notice error' }, svg(ICONS.alert), h('div', { class: 'notice-body' }, err.message)));
      toast(err.message, 'error');
    }
  }

  sync(true);
  return () => document.body.classList.remove('has-bar');
}
