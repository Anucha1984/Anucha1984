// User settings saved by the Studio settings page (or by hand) in ~/.nithan/config.json,
// so a desktop user never has to set environment variables. Real env vars always win.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Settings the Studio may read/write. `secret` values are only ever reported masked. */
export const SETTING_KEYS = [
  { key: 'CLOUDFLARE_ACCOUNT_ID', group: 'image', label: 'Cloudflare Account ID', secret: false },
  { key: 'CLOUDFLARE_API_TOKEN', group: 'image', label: 'Cloudflare API Token (Workers AI)', secret: true },
  { key: 'GEMINI_API_KEY', group: 'image', label: 'Gemini API Key', secret: true },
  { key: 'OPENAI_API_KEY', group: 'image', label: 'OpenAI API Key', secret: true },
  { key: 'ELEVENLABS_API_KEY', group: 'voice', label: 'ElevenLabs API Key', secret: true },
  { key: 'NITHAN_IMAGE', group: 'image', label: 'ผู้วาดภาพ', secret: false },
  { key: 'NITHAN_MODEL', group: 'claude', label: 'โมเดล Claude', secret: false },
  { key: 'NITHAN_CF_IMAGE_MODEL', group: 'image', label: 'โมเดลภาพ Cloudflare', secret: false },
];
const KEYS = new Set(SETTING_KEYS.map((k) => k.key));
const VALUE_RE = /^[\x21-\x7e]{1,512}$/; // printable ASCII, no spaces/newlines

export function configPath(env = process.env) {
  return env.NITHAN_CONFIG || path.join(env.NITHAN_HOME || path.join(os.homedir(), '.nithan'), 'config.json');
}

export async function readConfig(env = process.env) {
  try {
    const raw = JSON.parse(await fs.readFile(configPath(env), 'utf8'));
    return Object.fromEntries(Object.entries(raw).filter(([k, v]) => KEYS.has(k) && typeof v === 'string' && VALUE_RE.test(v)));
  } catch {
    return {};
  }
}

/**
 * Merge saved settings into env (keys already set in env are kept).
 * Call once at startup (CLI, Studio). Returns the keys that were applied.
 */
export async function loadConfig(env = process.env) {
  const cfg = await readConfig(env);
  const applied = [];
  for (const [k, v] of Object.entries(cfg)) {
    if (env[k] === undefined || env[k] === '') {
      env[k] = v;
      applied.push(k);
    }
  }
  return applied;
}

/**
 * Save settings: strings are set, '' or null removes a key, unknown keys are rejected.
 * Values are also applied to env right away so the running Studio picks them up.
 */
export async function saveConfig(changes, env = process.env) {
  const cfg = await readConfig(env);
  for (const [k, v] of Object.entries(changes || {})) {
    if (!KEYS.has(k)) throw new Error(`ไม่รู้จักการตั้งค่า ${k}`);
    if (v === '' || v === null || v === undefined) {
      delete cfg[k];
      if (env[k] !== undefined) delete env[k];
      continue;
    }
    const val = String(v).trim();
    if (!VALUE_RE.test(val)) throw new Error(`ค่าของ ${k} ไม่ถูกต้อง (ต้องเป็นตัวอักษรภาษาอังกฤษ/ตัวเลข ไม่มีช่องว่าง)`);
    cfg[k] = val;
    env[k] = val;
  }
  const file = configPath(env);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  try {
    await fs.chmod(file, 0o600);
  } catch {}
  return cfg;
}

const mask = (v) => (v.length <= 8 ? '••••' : v.slice(0, 4) + '…' + v.slice(-4));

/** What the Studio shows: which keys are set (masked) and where each value comes from. */
export async function describeConfig(env = process.env) {
  const cfg = await readConfig(env);
  return Object.fromEntries(
    SETTING_KEYS.map(({ key, secret, label, group }) => {
      const v = env[key] || '';
      return [key, { label, group, set: Boolean(v), value: v ? (secret ? mask(v) : v) : '', source: v ? (cfg[key] === v ? 'config' : 'env') : null }];
    }),
  );
}
