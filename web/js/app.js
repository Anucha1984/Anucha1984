// NiThan Studio — boot + hash router (#/create, #/job/:id, #/project/:id, #/library).
import { api } from './api.js';
import { ICONS, LOGO } from './art.js';
import { clear, h, svg } from './dom.js';
import { mountCreate } from './views/create.js';
import { mountJob } from './views/job.js';
import { mountLibrary } from './views/library.js';
import { mountProject } from './views/project.js';
import { mountSettings } from './views/settings.js';

const view = document.getElementById('view');
let cleanup = null;
let routeSeq = 0;

document.getElementById('brand-mark').append(svg(LOGO));
for (const el of document.querySelectorAll('[data-icon]')) el.append(svg(ICONS[el.dataset.icon]));

const ROUTES = [
  { re: /^\/create$/, nav: 'create', mount: mountCreate, title: 'สร้างวิดีโอ' },
  { re: /^\/job\/(j[a-f0-9]{12})$/, nav: 'create', mount: mountJob, title: 'กำลังสร้าง' },
  { re: /^\/project\/([a-z0-9][a-z0-9-]{0,79})$/, nav: 'library', mount: mountProject, title: 'ผลงาน' },
  { re: /^\/library$/, nav: 'library', mount: mountLibrary, title: 'คลังวิดีโอ' },
  { re: /^\/settings$/, nav: 'settings', mount: mountSettings, title: 'ตั้งค่า' },
];

export function setGenreTint(genre) {
  if (genre) document.body.dataset.genre = genre;
}

export function setTitle(text) {
  document.title = text ? `${text} · นิทานสตูดิโอ` : 'นิทานสตูดิโอ';
}

function errorState(message) {
  return h(
    'section',
    { class: 'state' },
    h('div', { class: 'state-art' }, svg(ICONS.alert)),
    h('h1', null, 'เปิดหน้านี้ไม่ได้'),
    h('p', null, message),
    h('div', { class: 'state-actions' }, h('a', { class: 'btn btn-primary', href: '#/create' }, 'กลับไปหน้าสร้าง'), h('a', { class: 'btn btn-soft', href: '#/library' }, 'ดูคลังวิดีโอ')),
  );
}

async function route() {
  const seq = ++routeSeq;
  const path = (location.hash.replace(/^#/, '') || '/create').split('?')[0];
  const match = ROUTES.map((r) => ({ r, m: r.re.exec(path) })).find((x) => x.m);
  if (!match) {
    location.replace('#/create');
    return;
  }
  try {
    cleanup?.();
  } catch {
    /* ignore */
  }
  cleanup = null;
  document.body.classList.remove('has-bar');
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === match.r.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  setTitle(match.r.title);
  clear(view);
  window.scrollTo(0, 0);
  try {
    const presets = await api.presets();
    if (seq !== routeSeq) return;
    const result = await match.r.mount(view, { presets, param: match.m[1], isCurrent: () => seq === routeSeq });
    if (seq !== routeSeq) result?.();
    else cleanup = typeof result === 'function' ? result : null;
  } catch (err) {
    if (seq !== routeSeq) return;
    clear(view).append(errorState(err?.message || 'เกิดข้อผิดพลาด'));
  }
}

window.addEventListener('hashchange', route);
route();
