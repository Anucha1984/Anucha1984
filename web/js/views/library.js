// คลังวิดีโอ — poster grid of past projects + anything still cooking.
import { api } from '../api.js';
import { ICONS } from '../art.js';
import { clear, fmtDate, fmtDuration, h, svg, toast } from '../dom.js';
import { deleteProjectFlow } from './project.js';

export async function mountLibrary(root, { presets, isCurrent }) {
  let timer = null;
  let disposed = false;
  const running = h('section', { class: 'lib-running', aria: { label: 'งานที่กำลังทำ' } });
  const grid = h('div', { class: 'lib-grid' });
  const count = h('p', { class: 'muted' });
  root.append(
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'คลังวิดีโอ'), count), h('a', { class: 'btn btn-primary', href: '#/create' }, svg(ICONS.plus), 'สร้างเรื่องใหม่')),
    running,
    grid,
  );

  function card(p) {
    const g = presets.genres[p.genre];
    const el = h(
      'article',
      { class: 'lib-card', vars: g ? { '--badge': g.accent } : undefined },
      h(
        'a',
        { class: 'lib-poster', href: `#/project/${p.id}`, aria: { label: `เปิด ${p.title}` } },
        p.poster ? h('img', { src: p.poster, alt: '', loading: 'lazy', decoding: 'async' }) : null,
        h('span', { class: 'lib-top' }, g ? h('span', { class: 'badge' }, g.name) : h('span'), p.durationSec ? h('span', { class: 'badge plain' }, fmtDuration(p.durationSec)) : !p.hasVideo ? h('span', { class: 'badge plain' }, 'ยังไม่เรนเดอร์') : null),
        h('span', { class: 'lib-info' }, h('span', { class: 'lib-title' }, p.title), h('span', { class: 'lib-sub' }, [p.series?.episode ? `ตอนที่ ${p.series.episode}` : null, presets.styles[p.style]?.name, `${p.scenes} ฉาก`].filter(Boolean).join(' · '))),
      ),
      h(
        'div',
        { class: 'lib-foot' },
        h('span', null, fmtDate(p.createdAt)),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon',
            type: 'button',
            aria: { label: `ลบ ${p.title}` },
            onclick: async () => {
              try {
                if (await deleteProjectFlow(p)) {
                  el.remove();
                  toast('ลบแล้ว');
                  refresh();
                }
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          },
          svg(ICONS.trash),
        ),
      ),
    );
    return el;
  }

  async function refresh() {
    const [{ projects }, { jobs }] = await Promise.all([api.projects(), api.jobs().catch(() => ({ jobs: [] }))]);
    if (disposed || !isCurrent()) return;
    const active = jobs.filter((j) => j.status === 'queued' || j.status === 'running');
    clear(running).append(
      ...active.map((j) => {
        const fill = h('div', { class: 'bar-fill' });
        fill.style.width = Math.round(j.progress * 100) + '%';
        return h('a', { class: 'run-item card', href: `#/job/${j.id}` }, h('span', { class: 'spinner' }), h('span', { class: 'run-title' }, j.title || 'เรื่องใหม่'), h('div', { class: 'bar' }, fill), h('span', { class: 'dim' }, j.status === 'queued' ? 'รอคิว' : Math.round(j.progress * 100) + '%'));
      }),
    );
    running.hidden = !active.length;
    count.textContent = projects.length ? `ทั้งหมด ${projects.length} เรื่อง` : '';
    clear(grid);
    if (!projects.length) {
      grid.hidden = true;
      if (!root.querySelector('.state'))
        root.append(
          h(
            'section',
            { class: 'state' },
            h('div', { class: 'state-art' }, svg(ICONS.film)),
            h('h2', null, 'ยังไม่มีวิดีโอในคลัง'),
            h('p', null, 'เริ่มจากนิทานที่คุ้นเคยอย่างปลาบู่ทอง หรือเรื่องผีที่เคยฟังตอนเด็กก็ได้ พิมพ์บรรทัดเดียวพอ'),
            h('div', { class: 'state-actions' }, h('a', { class: 'btn btn-primary btn-lg', href: '#/create' }, svg(ICONS.spark), 'สร้างวิดีโอเรื่องแรก')),
          ),
        );
    } else {
      grid.hidden = false;
      root.querySelector('.state')?.remove();
      grid.append(...projects.map(card));
    }
    clearTimeout(timer);
    if (active.length) timer = setTimeout(() => refresh().catch(() => {}), 2500);
  }

  await refresh();
  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}
