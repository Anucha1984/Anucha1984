// Tiny DOM helpers. All dynamic text goes through textContent — never innerHTML —
// because storyboard text is model-generated.

/**
 * h('div', {class:'x', onclick, dataset:{a:1}, aria:{label:'..'}}, child, 'text', [more])
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'aria') for (const [a, av] of Object.entries(v)) el.setAttribute('aria-' + a, String(av));
      else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

/** Parse a TRUSTED, static SVG string (our own icons/illustrations) into a node. */
export function svg(markup, className) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const node = document.importNode(doc.documentElement, true);
  if (className) node.setAttribute('class', className);
  if (!node.hasAttribute('aria-label')) node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  return node;
}

let toastTimer = null;
export function toast(message, kind = 'info') {
  const host = document.getElementById('toast');
  if (!host) return;
  host.textContent = message;
  host.dataset.kind = kind;
  host.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove('show'), kind === 'error' ? 6000 : 3200);
}

/** Promise<boolean> confirmation using the native <dialog>. */
export function confirmDialog({ title, body, confirmLabel = 'ตกลง', cancelLabel = 'ยกเลิก', danger = false }) {
  return new Promise((resolve) => {
    const dlg = h(
      'dialog',
      { class: 'dialog', aria: { labelledby: 'dlg-title' } },
      h('h2', { id: 'dlg-title', class: 'dialog-title' }, title),
      body ? h('p', { class: 'dialog-body' }, body) : null,
      h(
        'div',
        { class: 'dialog-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close('no') }, cancelLabel),
        h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'button', onclick: () => dlg.close('yes') }, confirmLabel),
      ),
    );
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(dlg.returnValue === 'yes');
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' · ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export const thaiNum = (n) => String(n).replace(/\d/g, (d) => THAI_DIGITS[d]);

/** Grow a textarea to fit its content. */
export function autoGrow(ta) {
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return ta;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { value: text, class: 'sr-only', readOnly: true });
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
