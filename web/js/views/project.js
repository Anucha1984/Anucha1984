// ผลงาน — phone-frame player, downloads, next episode and the storyboard editor.
import { api, followJob, mediaUrl } from '../api.js';
import { setGenreTint, setTitle } from '../app.js';
import { ICONS } from '../art.js';
import { autoGrow, clear, confirmDialog, fmtDate, fmtDuration, h, svg, toast } from '../dom.js';

const CAMERA_LABEL = {
  'zoom-in': 'ซูมเข้า',
  'zoom-out': 'ซูมออก',
  'pan-left': 'แพนซ้าย',
  'pan-right': 'แพนขวา',
  'pan-up': 'แพนขึ้น',
  'pan-down': 'แพนลง',
  static: 'กล้องนิ่ง',
};
const MAX_LINES = 6;

const editable = (sb) => ({
  title: sb.title || '',
  hook: sb.hook || '',
  moral: sb.moral || '',
  scenes: sb.scenes.map((s) => ({ id: s.id, visual: s.visual || '', camera: s.camera, lines: s.lines.map((l) => ({ speaker: l.speaker, text: l.text })) })),
});

export async function mountProject(root, ctx) {
  const { presets, param: id, isCurrent } = ctx;
  let stopJob = null;
  let disposed = false;
  const onBeforeUnload = (e) => {
    if (root.querySelector('.savebar.show')) e.preventDefault();
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  async function load(keepScroll = false) {
    const y = window.scrollY;
    const sb = await api.project(id);
    if (disposed || !isCurrent()) return;
    stopJob?.();
    stopJob = null;
    clear(root);
    stopJob = render(sb);
    if (keepScroll) window.scrollTo(0, y);
  }

  function render(sb) {
    const info = sb._studio || {};
    const genre = presets.genres[sb.genre];
    const style = presets.styles[sb.style];
    setGenreTint(sb.genre);
    setTitle(sb.title);
    const base = editable(sb);
    const draft = structuredClone(base);
    let busy = false; // a job is running for this project
    let stop = null;
    const v = info.version || Date.now();
    const locks = []; // controls disabled while a job runs

    // ── player
    const firstArt = sb.scenes.find((s) => s.art)?.art;
    const posterUrl = info.poster ? mediaUrl(id, info.poster, v) : firstArt ? mediaUrl(id, firstArt, v) : '';
    const phone = h('div', { class: 'phone' });
    const busyFill = h('div', { class: 'bar-fill' });
    const busyMsg = h('span', null, '');
    const busyBox = h('div', { class: 'phone-busy', hidden: true, role: 'status', aria: { live: 'polite' } }, busyMsg, h('div', { class: 'bar' }, busyFill));
    const lock = (el) => (locks.push(el), el);
    const renderBtn = (label, opts, cls = 'btn btn-primary') => lock(h('button', { class: cls, type: 'button', onclick: () => saveThen(() => api.render(id, opts)) }, svg(ICONS.clapper), label));

    if (info.hasVideo) {
      phone.append(h('video', { src: mediaUrl(id, info.video, v), poster: info.poster ? posterUrl : undefined, controls: true, playsInline: true, preload: 'metadata', aria: { label: `วิดีโอ ${sb.title}` } }));
    } else {
      if (posterUrl) phone.append(h('img', { src: posterUrl, alt: '' }));
      phone.append(h('div', { class: 'phone-empty' }, h('p', null, 'ยังไม่มีไฟล์วิดีโอ'), renderBtn('เรนเดอร์วิดีโอ', {})));
    }
    phone.append(busyBox);

    const dl = (label, rel, name) =>
      rel
        ? h('a', { class: 'btn btn-soft', href: mediaUrl(id, rel, v, true), download: name }, svg(ICONS.download), label)
        : h('button', { class: 'btn btn-soft', type: 'button', disabled: true, title: 'ยังไม่มีไฟล์นี้' }, svg(ICONS.download), label);
    const nextBtn = lock(
      h(
        'button',
        {
          class: 'btn btn-block ' + (sb.genre === 'cdrama' ? 'btn-primary btn-lg' : 'btn-accent'),
          type: 'button',
          onclick: async () => {
            nextBtn.disabled = true;
            try {
              const { jobId } = await api.nextEpisode(id);
              location.hash = `#/job/${jobId}`;
            } catch (err) {
              nextBtn.disabled = false;
              toast(err.message, 'error');
            }
          },
        },
        svg(ICONS.next),
        `สร้างตอนต่อไป${sb.series?.episode ? ` (ตอนที่ ${Number(sb.series.episode) + 1})` : ''}`,
      ),
    );
    const nextHook = sb.series?.nextHook ? h('p', { class: 'dim' }, 'ตอนหน้า: ' + sb.series.nextHook) : null;
    if (nextHook) nextHook.style.fontSize = '14px';

    const notices = h('div', { class: 'scenes' });
    if (info.hasVideo && sb.output?.voiced === false) {
      notices.append(
        h(
          'div',
          { class: 'notice' },
          svg(ICONS.mute),
          h(
            'div',
            { class: 'notice-body' },
            h('p', { class: 'notice-title' }, 'วิดีโอนี้ยังไม่มีเสียงพากย์'),
            h('p', { class: 'muted' }, info.tts === 'none' ? 'คุณปิดเสียงพากย์ไว้ตอนสร้าง จึงมีแค่ซับไทยกับดนตรี' : 'ตอนเรนเดอร์ต่อบริการเสียงไม่ได้ จึงใส่ซับไทยกับดนตรีให้แทน เชื่อมอินเทอร์เน็ตแล้วลองใหม่ได้'),
            h('div', { class: 'row-actions' }, renderBtn('เรนเดอร์พร้อมเสียงพากย์', { tts: 'auto' }, 'btn btn-soft btn-sm')),
          ),
        ),
      );
    }
    if (info.hasVideo && info.needsRender) {
      notices.append(h('div', { class: 'notice' }, svg(ICONS.refresh), h('div', { class: 'notice-body' }, h('p', null, 'บทหรือภาพถูกแก้หลังเรนเดอร์ครั้งล่าสุด วิดีโอยังเป็นเวอร์ชันเก่า'), h('div', { class: 'row-actions' }, renderBtn('เรนเดอร์ใหม่', {}, 'btn btn-soft btn-sm')))));
    }

    // ── editor
    const savebar = h('div', { class: 'savebar', role: 'region', aria: { label: 'บันทึกการแก้ไข' } });
    const isDirty = () => JSON.stringify(draft) !== JSON.stringify(base);
    const touch = () => {
      const dirty = isDirty() && !busy;
      savebar.classList.toggle('show', dirty);
      savebar.inert = !dirty;
      document.body.classList.toggle('has-bar', dirty);
    };
    const field = (label, key, max, wide, hint) =>
      h('label', { class: 'field' + (wide ? ' wide' : '') }, h('span', { class: 'label' }, label), lock(h('input', { class: 'input', type: 'text', value: draft[key], maxLength: max, placeholder: hint || '', oninput: (e) => ((draft[key] = e.target.value), touch()) })));

    const speakers = [['narrator', 'ผู้บรรยาย'], ...(sb.characters || []).map((c) => [c.id, c.name])];
    const sceneCards = sb.scenes.map((scene, i) => {
      const d = draft.scenes[i];
      const img = h('img', { alt: `ภาพฉากที่ ${i + 1}`, loading: 'lazy', decoding: 'async' });
      const thumb = h('div', { class: 'thumb ready' }, img, h('span', { class: 'thumb-num' }, i + 1));
      if (scene.art) img.src = mediaUrl(id, scene.art, v);
      const redraw = lock(h('button', { class: 'btn btn-soft btn-sm btn-block', type: 'button', aria: { label: `วาดฉากที่ ${i + 1} ใหม่` }, onclick: () => saveThen(() => api.redraw(id, scene.id), thumb) }, svg(ICONS.brush), 'วาดใหม่'));
      const linesBox = h('div', { class: 'scenes' });
      const addBtn = lock(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => (d.lines.push({ speaker: 'narrator', text: '' }), drawLines(true), touch()) }, svg(ICONS.plus), 'เพิ่มบรรทัด'));
      function drawLines(focusLast = false) {
        clear(linesBox);
        d.lines.forEach((line, j) => {
          const ta = autoGrow(lock(h('textarea', { class: 'textarea', rows: 1, maxLength: 400, value: line.text, placeholder: 'ข้อความที่จะพากย์และขึ้นซับ', aria: { label: `ฉากที่ ${i + 1} บรรทัดที่ ${j + 1}` }, oninput: (e) => ((line.text = e.target.value), touch()) })));
          linesBox.append(
            h(
              'div',
              { class: 'line' },
              lock(
                h(
                  'select',
                  { class: 'select', aria: { label: `ผู้พูด บรรทัดที่ ${j + 1}` }, onchange: (e) => ((line.speaker = e.target.value), touch()) },
                  speakers.map(([val, name]) => h('option', { value: val, selected: val === line.speaker }, name)),
                ),
              ),
              ta,
              lock(h('button', { class: 'btn btn-ghost btn-icon', type: 'button', disabled: d.lines.length <= 1, aria: { label: `ลบบรรทัดที่ ${j + 1}` }, onclick: () => (d.lines.splice(j, 1), drawLines(), touch()) }, svg(ICONS.close))),
            ),
          );
          if (focusLast && j === d.lines.length - 1) requestAnimationFrame(() => ta.focus());
        });
        addBtn.hidden = d.lines.length >= MAX_LINES;
      }
      drawLines();
      const card = h(
        'article',
        { class: 'scene card', aria: { label: `ฉากที่ ${i + 1}` } },
        h('div', { class: 'scene-side' }, thumb, redraw),
        h(
          'div',
          { class: 'scene-main' },
          h(
            'div',
            { class: 'scene-top' },
            h('h3', null, scene.heading || `ฉากที่ ${i + 1}`),
            lock(
              h(
                'select',
                { class: 'select', aria: { label: `การเคลื่อนกล้อง ฉากที่ ${i + 1}` }, onchange: (e) => ((d.camera = e.target.value), touch()) },
                presets.cameraMoves.map((c) => h('option', { value: c, selected: c === d.camera }, CAMERA_LABEL[c] || c)),
              ),
            ),
          ),
          linesBox,
          h('div', null, addBtn),
          h(
            'details',
            { class: 'visual' },
            h('summary', null, 'คำสั่งวาดภาพ (ภาษาอังกฤษ)', svg(ICONS.chevron)),
            autoGrowOnOpen(lock(h('textarea', { class: 'textarea', rows: 2, maxLength: 1500, value: d.visual, aria: { label: `คำสั่งวาดภาพ ฉากที่ ${i + 1}` }, oninput: (e) => ((d.visual = e.target.value), touch()) }))),
          ),
        ),
      );
      return { card, thumb, img, scene };
    });

    function autoGrowOnOpen(ta) {
      autoGrow(ta);
      queueMicrotask(() => ta.closest('details')?.addEventListener('toggle', () => ta.dispatchEvent(new Event('input'))));
      return ta;
    }

    async function save() {
      const saved = await api.saveProject(id, draft);
      Object.assign(base, structuredClone(draft)); // keep `draft` identity: scene cards hold references into it
      return saved;
    }
    /** Save pending edits, then start a job and follow it inline. */
    async function saveThen(start, thumb) {
      if (busy) return;
      try {
        if (isDirty()) await save();
        setBusy(true, 'กำลังเข้าคิว…', 0);
        thumb?.classList.remove('ready');
        thumb?.classList.add('shimmer');
        const { jobId } = await start();
        follow(jobId);
      } catch (err) {
        setBusy(false);
        thumb?.classList.add('ready');
        toast(err.message, 'error');
      }
    }
    function setBusy(on, message, progress) {
      busy = on;
      for (const el of locks) el.disabled = on || (el.classList.contains('btn-icon') && el.closest('.scenes')?.childElementCount <= 1);
      busyBox.hidden = !on;
      if (message) busyMsg.textContent = message;
      if (progress !== undefined) busyFill.style.width = Math.round(progress * 100) + '%';
      touch();
    }
    function follow(jobId) {
      setBusy(true, 'กำลังทำงาน…');
      stop?.();
      stop = followJob(jobId, {
        onEvent: (ev) => {
          if (ev.stage === 'error') {
            setBusy(false);
            for (const c of sceneCards) c.thumb.classList.add('ready');
            toast(ev.message || 'ทำไม่สำเร็จ', 'error');
            return;
          }
          if (ev.stage === 'done') {
            toast('เรียบร้อย อัปเดตวิดีโอแล้ว');
            load(true).catch((e) => toast(e.message, 'error'));
            return;
          }
          busyMsg.textContent = `${ev.message || 'กำลังทำงาน…'} · ${Math.round(ev.progress * 100)}%`;
          busyFill.style.width = Math.round(ev.progress * 100) + '%';
          if (ev.stage === 'art' && ev.detail?.sceneId && ev.detail.art) {
            const c = sceneCards.find((x) => x.scene.id === ev.detail.sceneId);
            if (c) {
              c.img.src = mediaUrl(id, ev.detail.art, Date.now());
              c.thumb.classList.remove('shimmer');
              c.thumb.classList.add('ready');
            }
          }
        },
        onLost: (gone) => gone && (setBusy(false), toast('การเชื่อมต่อหลุด โหลดหน้านี้ใหม่เพื่อดูสถานะล่าสุด', 'error')),
      });
    }

    savebar.append(
      h('span', { class: 'savebar-text' }, 'มีการแก้ไขที่ยังไม่ได้บันทึก'),
      h(
        'div',
        { class: 'row-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => load(true).catch((e) => toast(e.message, 'error')) }, 'ยกเลิก'),
        h(
          'button',
          {
            class: 'btn btn-soft',
            type: 'button',
            onclick: async () => {
              try {
                await save();
                toast('บันทึกแล้ว กด “เรนเดอร์ใหม่” เมื่อพร้อม');
                await load(true);
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          },
          'บันทึก',
        ),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => saveThen(() => api.render(id, {})) }, svg(ICONS.clapper), 'บันทึกและเรนเดอร์ใหม่'),
      ),
    );
    savebar.inert = true;

    const meta = h(
      'div',
      { class: 'proj-meta' },
      genre ? h('span', { class: 'badge', vars: { '--badge': genre.accent } }, genre.name) : null,
      style ? h('span', { class: 'badge plain' }, style.name) : null,
      sb.series?.episode ? h('span', { class: 'badge plain' }, `ตอนที่ ${sb.series.episode}`) : null,
      sb.output?.durationSec ? h('span', { class: 'badge plain' }, fmtDuration(sb.output.durationSec) + ' นาที') : null,
      info.mock ? h('span', { class: 'badge plain' }, 'โหมดทดลอง') : null,
      h('span', { class: 'dim' }, fmtDate(sb.createdAt)),
    );

    root.append(
      h(
        'div',
        { class: 'project' },
        h(
          'aside',
          { class: 'player-col', aria: { label: 'วิดีโอและดาวน์โหลด' } },
          phone,
          h('div', { class: 'dl-row' }, dl('MP4', info.video, `${id}.mp4`), dl('ซับ SRT', info.srt, `${id}.srt`), dl('ปก', info.poster, `${id}-poster.jpg`)),
          nextBtn,
          nextHook,
        ),
        h(
          'div',
          { class: 'editor-col' },
          h('header', { class: 'proj-head' }, h('a', { class: 'back-link', href: '#/library' }, svg(ICONS.back), 'คลังวิดีโอ'), h('h1', null, sb.title), h('p', { class: 'muted' }, sb.logline || ''), meta),
          notices.childElementCount ? notices : null,
          h('div', { class: 'sec-title' }, h('h2', null, 'แก้บทและภาพ'), h('span', { class: 'dim' }, `${sb.scenes.length} ฉาก · แก้แล้วกดเรนเดอร์ใหม่ได้เลย`)),
          h('section', { class: 'meta-form card', aria: { label: 'ข้อมูลเรื่อง' } }, field('ชื่อเรื่อง', 'title', 120), field('ประโยคเปิด (ขึ้นตัวใหญ่ตอนต้นคลิป)', 'hook', 80), field('ข้อคิดท้ายเรื่อง', 'moral', 300, true, 'เว้นว่างได้')),
          h('div', { class: 'scenes' }, sceneCards.map((c) => c.card)),
        ),
      ),
      savebar,
    );

    if (info.activeJob) follow(info.activeJob);
    return () => stop?.();
  }

  await load();
  return () => {
    disposed = true;
    stopJob?.();
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.body.classList.remove('has-bar');
  };
}

export async function deleteProjectFlow(project) {
  const ok = await confirmDialog({ title: 'ลบวิดีโอนี้?', body: `“${project.title}” จะถูกลบออกจากเครื่องถาวร ทั้งวิดีโอ ภาพ และบท`, confirmLabel: 'ลบถาวร', danger: true });
  if (!ok) return false;
  await api.deleteProject(project.id);
  return true;
}
