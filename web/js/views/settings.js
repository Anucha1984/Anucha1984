// ตั้งค่า — keys for the realistic image models and voices, saved to ~/.nithan/config.json by the server.
import { api } from '../api.js';
import { ICONS } from '../art.js';
import { clear, h, svg, toast } from '../dom.js';

const PROVIDERS = [
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    model: 'FLUX.2 [klein] 9B',
    badge: 'ฟรี · แนะนำ',
    free: true,
    desc: 'มีโควตาฟรีรายวัน ภาพสมจริงคุณภาพดี และรับภาพอ้างอิงเพื่อล็อกหน้าตัวละครได้',
    fields: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    steps: ['สมัคร/เข้าสู่ระบบที่ dash.cloudflare.com (ฟรี)', 'เมนู Workers & Pages → คัดลอก Account ID จากแถบขวา', 'My Profile → API Tokens → Create Token → เทมเพลต “Workers AI” → คัดลอก Token มาวาง'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'Gemini image',
    badge: 'คิดเงินตามภาพ',
    desc: 'คุณภาพสูง รองรับภาพอ้างอิงหลายภาพ ต้องเปิดการเรียกเก็บเงินใน Google AI Studio',
    fields: ['GEMINI_API_KEY'],
    steps: ['aistudio.google.com → Get API key → สร้างคีย์', 'วางคีย์ด้านล่าง'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    model: 'gpt-image',
    badge: 'คิดเงินตามภาพ',
    desc: 'คุณภาพสูง และใช้คีย์เดียวกันกับเสียงพากย์ OpenAI ได้',
    fields: ['OPENAI_API_KEY'],
    steps: ['platform.openai.com → API keys → Create new secret key', 'วางคีย์ด้านล่าง'],
  },
];

export async function mountSettings(root) {
  let data = await api.settings();
  const inputs = new Map();
  const status = h('div', { class: 'settings-status' });

  const field = (key) => {
    const meta = data.settings[key];
    const input = h('input', {
      class: 'input mono',
      type: meta.label.includes('Token') || meta.label.includes('Key') ? 'password' : 'text',
      autocomplete: 'off',
      spellcheck: false,
      placeholder: meta.set ? `ตั้งค่าไว้แล้ว (${meta.value})` : meta.label,
      aria: { label: meta.label },
    });
    inputs.set(key, input);
    const clearBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', hidden: !meta.set, onclick: () => save({ [key]: '' }) }, 'ลบ');
    return h('div', { class: 'field' }, h('label', { class: 'label' }, meta.label, meta.source === 'env' ? h('span', { class: 'dim' }, ' · มาจาก environment variable') : null), h('div', { class: 'field-row' }, input, clearBtn));
  };

  const providerCard = (p) => {
    const ready = data.image.keys[p.id];
    const active = data.image.provider === p.id;
    return h(
      'section',
      { class: 'card provider' + (active ? ' active' : ''), dataset: { provider: p.id } },
      h(
        'header',
        { class: 'provider-head' },
        h('div', null, h('h2', null, p.name), h('p', { class: 'dim' }, p.model)),
        h('span', { class: 'badge' + (p.free ? ' free' : ' plain') }, p.badge),
      ),
      h('p', null, p.desc),
      h('p', { class: 'provider-state' + (ready ? ' ok' : '') }, svg(ready ? ICONS.check : ICONS.clock), ready ? (active ? 'ใช้งานอยู่ — ภาพสมจริงพร้อมสร้าง' : 'ตั้งค่าแล้ว') : 'ยังไม่ได้ตั้งค่า'),
      h('ol', { class: 'steps' }, p.steps.map((t) => h('li', null, t))),
      h(
        'form',
        {
          class: 'provider-form',
          onsubmit: (e) => {
            e.preventDefault();
            const changes = {};
            for (const k of p.fields) {
              const v = inputs.get(k).value.trim();
              if (v) changes[k] = v;
            }
            if (!Object.keys(changes).length) return toast('ยังไม่ได้กรอกค่าอะไร', 'error');
            save(changes);
          },
        },
        p.fields.map(field),
        h('button', { class: 'btn btn-primary', type: 'submit' }, svg(ICONS.check), 'บันทึก'),
      ),
    );
  };

  const prefSelect = (key, options, hint) => {
    const sel = h('select', { class: 'select', aria: { label: data.settings[key].label }, onchange: () => save({ [key]: sel.value }) }, options.map(([v, label]) => h('option', { value: v, selected: (data.settings[key].value || '') === v }, label)));
    return h('div', { class: 'field' }, h('label', { class: 'label' }, data.settings[key].label), sel, hint ? h('p', { class: 'dim' }, hint) : null);
  };

  function renderStatus() {
    const img = data.image;
    const name = PROVIDERS.find((p) => p.id === img.provider)?.name;
    clear(status).append(
      h(
        'div',
        { class: 'notice' + (img.realistic ? ' ok' : '') },
        svg(img.realistic ? ICONS.check : ICONS.alert),
        h(
          'div',
          { class: 'notice-body' },
          h('p', { class: 'notice-title' }, img.realistic ? `ภาพสมจริงพร้อมใช้ — วาดด้วย ${name}` : 'ยังสร้างภาพสมจริงไม่ได้'),
          h('p', null, img.realistic ? 'ทุกเรื่องใหม่จะวาดด้วยโมเดลภาพนี้ และล็อกหน้าตัวละครให้เหมือนกันทุกฉาก' : 'ตอนนี้ Claude จะวาดเป็นภาพเวกเตอร์แนวการ์ตูน ใส่คีย์ของผู้ให้บริการด้านล่างอย่างน้อยหนึ่งราย (Cloudflare ใช้ฟรี) เพื่อให้ได้ภาพสมจริง'),
        ),
      ),
    );
  }

  async function save(changes) {
    try {
      data = await api.saveSettings(changes);
      toast('บันทึกแล้ว');
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const page = h('div', { class: 'settings' });
  function rerender() {
    renderStatus();
    inputs.clear();
    clear(page).append(
      h('div', { class: 'provider-grid' }, PROVIDERS.map(providerCard)),
      h(
        'section',
        { class: 'card prefs' },
        h('h2', null, 'ค่าเริ่มต้น'),
        h(
          'div',
          { class: 'prefs-grid' },
          prefSelect('NITHAN_IMAGE', [['', 'อัตโนมัติ (Cloudflare → Gemini → OpenAI → Claude)'], ['cloudflare', 'Cloudflare FLUX.2'], ['gemini', 'Gemini'], ['openai', 'OpenAI'], ['claude', 'Claude วาดเวกเตอร์ (การ์ตูน)']], 'ผู้วาดภาพสำหรับเรื่องใหม่'),
          prefSelect('NITHAN_MODEL', [['', 'Claude Sonnet (ค่าเริ่มต้น)'], ['claude-sonnet-5-5', 'claude-sonnet-5-5'], ['claude-opus-5-5', 'claude-opus-5-5'], ['claude-haiku-5-5', 'claude-haiku-5-5']], 'โมเดลที่เขียนบทและกำกับภาพ'),
          prefSelect('NITHAN_CF_IMAGE_MODEL', [['', 'FLUX.2 [klein] 9B (เร็ว ฟรี)'], ['@cf/black-forest-labs/flux-2-dev', 'FLUX.2 [dev] (ละเอียดกว่า ช้ากว่า)'], ['@cf/black-forest-labs/flux-2-klein-4b', 'FLUX.2 [klein] 4B (เร็วที่สุด)']], 'โมเดลภาพของ Cloudflare'),
        ),
      ),
      h(
        'section',
        { class: 'card prefs' },
        h('h2', null, 'เสียงพากย์'),
        h('p', { class: 'dim' }, 'ค่าเริ่มต้นใช้เสียง Microsoft Edge (ฟรี ต้องต่ออินเทอร์เน็ต) ใส่คีย์ ElevenLabs หรือ OpenAI ถ้าต้องการเสียงที่เป็นธรรมชาติกว่า'),
        h(
          'form',
          {
            class: 'provider-form',
            onsubmit: (e) => {
              e.preventDefault();
              const v = inputs.get('ELEVENLABS_API_KEY').value.trim();
              if (v) save({ ELEVENLABS_API_KEY: v });
            },
          },
          field('ELEVENLABS_API_KEY'),
          h('button', { class: 'btn btn-primary', type: 'submit' }, svg(ICONS.check), 'บันทึก'),
        ),
      ),
      h('p', { class: 'dim settings-foot' }, 'คีย์ถูกเก็บไว้ในเครื่องของคุณเท่านั้น (~/.nithan/config.json) และใช้กับคำสั่ง nithan ในเทอร์มินัลด้วย'),
    );
  }

  root.append(h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'ตั้งค่า'), h('p', { class: 'muted' }, 'เชื่อมต่อโมเดลภาพสมจริงและเสียงพากย์'))), status, page);
  rerender();
}
