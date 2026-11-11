// กำลังสร้าง — live progress: stepper, progress bar, scene strip that fills in as art arrives.
import { api, followJob, mediaUrl } from '../api.js';
import { setGenreTint, setTitle } from '../app.js';
import { ICONS } from '../art.js';
import { clear, h, svg } from '../dom.js';

export const STEPS = [
  { stage: 'storyboard', label: 'เขียนบท', icon: 'pen' },
  { stage: 'art', label: 'วาดภาพ', icon: 'brush' },
  { stage: 'voice', label: 'พากย์เสียง', icon: 'mic' },
  { stage: 'render', label: 'ตัดต่อ', icon: 'clapper' },
];
const KIND_LABEL = { create: 'กำลังสร้างวิดีโอ', episode: 'กำลังสร้างตอนต่อไป', render: 'กำลังเรนเดอร์ใหม่', redraw: 'กำลังวาดฉากใหม่' };

export async function mountJob(root, { presets, param: jobId, isCurrent }) {
  let job;
  try {
    job = await api.job(jobId);
  } catch (err) {
    root.append(
      h(
        'section',
        { class: 'state' },
        h('div', { class: 'state-art' }, svg(ICONS.clock)),
        h('h1', null, 'ไม่พบงานนี้แล้ว'),
        h('p', null, err.status === 404 ? 'งานอาจเสร็จไปแล้ว หรือสตูดิโอเพิ่งเปิดใหม่ ลองดูในคลังวิดีโอ' : err.message),
        h('div', { class: 'state-actions' }, h('a', { class: 'btn btn-primary', href: '#/library' }, 'ไปคลังวิดีโอ'), h('a', { class: 'btn btn-soft', href: '#/create' }, 'สร้างเรื่องใหม่')),
      ),
    );
    return null;
  }
  if (!isCurrent()) return null;
  setGenreTint(job.input?.genre);

  let projectId = job.projectId;
  let finished = false;
  let navTimer = null;
  const thumbs = new Map();

  const eyebrow = h('span', { class: 'eyebrow' }, svg(ICONS.film), KIND_LABEL[job.kind] || KIND_LABEL.create);
  const title = h('h1', null, job.title || 'เรื่องใหม่');
  const logline = h('p', null, job.kind === 'create' || job.kind === 'episode' ? 'Claude กำลังอ่านไอเดียของคุณ…' : '');
  const stepEls = STEPS.map((s) => h('li', { dataset: { state: 'pending' } }, h('span', { class: 'step-dot' }, svg(ICONS[s.icon])), h('span', null, s.label)));
  const fill = h('div', { class: 'bar-fill' });
  const bar = h('div', { class: 'bar', role: 'progressbar', aria: { valuemin: 0, valuemax: 100, valuenow: 0, label: 'ความคืบหน้าทั้งหมด' } }, fill);
  const msg = h('p', { class: 'bar-msg', role: 'status', aria: { live: 'polite' } }, job.message || 'กำลังเริ่ม…');
  const pct = h('span', { class: 'bar-pct', aria: { hidden: 'true' } }, '0%');
  const stripCount = h('span', { class: 'dim' });
  const strip = h('div', { class: 'strip' });
  const stripWrap = h('section', { aria: { label: 'ภาพแต่ละฉาก' } }, h('div', { class: 'strip-head' }, h('h2', null, 'สตอรี่บอร์ด'), stripCount), strip);
  const alertBox = h('div', { role: 'alert' });
  const foot = h('p', { class: 'job-foot' }, 'ปิดหน้านี้ได้ งานยังทำต่อให้ กลับมาดูได้ที่คลังวิดีโอ');

  root.append(
    h(
      'div',
      { class: 'job' },
      h('header', { class: 'job-head' }, eyebrow, title, logline),
      h('section', { class: 'job-panel card' }, h('ol', { class: 'stepper', aria: { label: 'ขั้นตอน' } }, stepEls), h('div', null, bar, h('div', { class: 'bar-row' }, msg, pct))),
      alertBox,
      stripWrap,
      foot,
    ),
  );

  // Placeholder strip until the storyboard arrives.
  const expected = presets.lengths[job.input?.length]?.scenes || 6;
  if (job.kind === 'create' || job.kind === 'episode') for (let i = 0; i < expected; i++) strip.append(h('div', { class: 'thumb shimmer' }, h('span', { class: 'thumb-num' }, i + 1)));
  else stripWrap.hidden = true;

  function setSteps(stage, failed) {
    const idx = stage === 'done' ? STEPS.length : STEPS.findIndex((s) => s.stage === stage);
    stepEls.forEach((el, i) => {
      el.dataset.state = idx < 0 ? 'pending' : i < idx ? 'done' : i === idx ? (failed ? 'failed' : 'active') : 'pending';
      if (i === idx && !failed) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
  }
  function setProgress(p) {
    const v = Math.round(Math.max(0, Math.min(1, p)) * 100);
    fill.style.width = v + '%';
    bar.setAttribute('aria-valuenow', String(v));
    pct.textContent = v + '%';
  }
  function showStoryboard(sb) {
    projectId = sb.id || projectId;
    title.textContent = sb.title || title.textContent;
    setTitle(sb.title);
    logline.textContent = sb.logline || '';
    setGenreTint(sb.genre);
    if (thumbs.size) return;
    stripWrap.hidden = false;
    clear(strip);
    sb.scenes.forEach((s, i) => {
      const img = h('img', { alt: '', decoding: 'async' });
      const el = h('figure', { class: 'thumb shimmer', aria: { label: `ฉากที่ ${i + 1}` } }, img, h('span', { class: 'thumb-num' }, i + 1), h('figcaption', { class: 'thumb-cap' }, s.lines?.[0]?.text || s.heading || ''));
      el.style.margin = '0';
      thumbs.set(s.id, { el, img });
      strip.append(el);
      if (s.art) setArt(s.id, s.art);
    });
    countArt();
  }
  function setArt(sceneId, art) {
    const t = thumbs.get(sceneId);
    if (!t || !projectId || !art) return;
    t.img.onload = () => t.el.classList.add('ready');
    t.img.src = mediaUrl(projectId, art, Date.now());
    t.done = true;
    countArt();
  }
  function countArt() {
    const done = [...thumbs.values()].filter((t) => t.done).length;
    stripCount.textContent = thumbs.size ? `วาดแล้ว ${done}/${thumbs.size} ฉาก` : '';
  }

  function onEvent(ev) {
    if (finished) return;
    if (ev.detail?.storyboard) showStoryboard(ev.detail.storyboard);
    if (ev.detail?.projectId) projectId = ev.detail.projectId;
    if (ev.stage === 'error') return fail(ev);
    if (ev.stage === 'queued') {
      msg.textContent = ev.message;
      return;
    }
    setSteps(ev.stage);
    setProgress(ev.progress);
    if (ev.message) msg.textContent = ev.message;
    if (ev.stage === 'art' && ev.detail?.sceneId) setArt(ev.detail.sceneId, ev.detail.art);
    if (ev.stage === 'done') {
      finished = true;
      bar.classList.add('still');
      eyebrow.lastChild.textContent = 'เสร็จแล้ว';
      foot.textContent = 'กำลังเปิดวิดีโอ…';
      if (projectId) navTimer = setTimeout(() => location.replace(`#/project/${projectId}`), 900);
    }
  }

  function fail(ev) {
    finished = true;
    bar.classList.add('still');
    setSteps(ev.detail?.failedStage || 'storyboard', true);
    eyebrow.lastChild.textContent = 'สร้างไม่สำเร็จ';
    msg.textContent = 'หยุดไว้ตรงนี้ก่อน';
    foot.hidden = true;
    const hasProject = Boolean(projectId && thumbs.size);
    const retry = h('button', { class: 'btn btn-primary', type: 'button', onclick: doRetry }, svg(ICONS.refresh), 'ลองอีกครั้ง');
    async function doRetry() {
      retry.disabled = true;
      try {
        if (job.kind === 'create' || job.kind === 'episode') {
          const { jobId: next } = await api.createJob(job.input);
          location.hash = `#/job/${next}`;
        } else {
          const { jobId: next } = job.kind === 'redraw' ? await api.redraw(projectId, job.input.sceneId, job.input) : await api.render(projectId, job.input || {});
          location.hash = `#/job/${next}`;
        }
      } catch (err) {
        retry.disabled = false;
        msg.textContent = err.message;
      }
    }
    clear(alertBox).append(
      h(
        'div',
        { class: 'notice error' },
        svg(ICONS.alert),
        h(
          'div',
          { class: 'notice-body' },
          h('p', { class: 'notice-title' }, 'สร้างวิดีโอไม่สำเร็จ'),
          h('p', null, ev.message || 'เกิดข้อผิดพลาด'),
          h(
            'div',
            { class: 'row-actions' },
            retry,
            hasProject ? h('a', { class: 'btn btn-soft', href: `#/project/${projectId}` }, 'เปิดสตอรี่บอร์ดที่ได้') : null,
            h('a', { class: 'btn btn-ghost', href: '#/create' }, 'กลับไปแก้ไอเดีย'),
          ),
        ),
      ),
    );
    if (!thumbs.size) stripWrap.hidden = true;
    else for (const t of thumbs.values()) if (!t.done) t.el.classList.remove('shimmer');
  }

  const stop = followJob(jobId, {
    onEvent,
    onLost: (gone) => {
      if (finished) return;
      if (gone) fail({ message: 'การเชื่อมต่อกับสตูดิโอหลุด ตรวจว่าเซิร์ฟเวอร์ยังเปิดอยู่แล้วโหลดหน้านี้ใหม่', detail: {} });
      else msg.textContent = 'สัญญาณหลุด กำลังเชื่อมต่อใหม่…';
    },
  });
  return () => {
    stop();
    clearTimeout(navTimer);
  };
}
