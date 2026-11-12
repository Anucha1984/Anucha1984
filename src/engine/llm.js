// Small Claude client with two backends, auto-selected:
//   1. API  — @anthropic-ai/sdk, when ANTHROPIC_API_KEY is set (streaming).
//   2. CLI  — `claude -p --output-format json` (Claude Code, already logged in), prompt via stdin.
// Force one with NITHAN_LLM=api|cli. Model: opts.model > NITHAN_MODEL > default (claude-sonnet-5-5).
import { spawn } from 'node:child_process';
import os from 'node:os';

/** Default for both backends (fast and cheap enough for many scene calls). Override: opts.model, NITHAN_MODEL, --model. */
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const DEFAULT_TIMEOUT_MS = Number(process.env.NITHAN_TIMEOUT_MS) || 8 * 60 * 1000;
// Models whose safety classifiers can return stop_reason "refusal" and that accept server-side fallbacks.
const FALLBACK_CAPABLE = /^claude-(fable-5-[12]|opus-5(-5)?|sonnet-5-5)$/;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export class LlmError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'LlmError';
    this.code = code || 'llm';
  }
}

export function resolveModel(model) {
  return model || process.env.NITHAN_MODEL || null;
}

/** Which backend will be used: 'api' | 'cli'. */
export function pickBackend(env = process.env) {
  const forced = String(env.NITHAN_LLM || '').toLowerCase();
  if (forced === 'api' || forced === 'cli') return forced;
  return env.ANTHROPIC_API_KEY ? 'api' : 'cli';
}

// ───────────────────────────── API backend ─────────────────────────────

let clientPromise;
async function getClient() {
  clientPromise ??= import('@anthropic-ai/sdk').then(({ default: Anthropic }) => ({
    Anthropic,
    client: new Anthropic({ maxRetries: 2 }),
  }));
  return clientPromise;
}

async function completeViaApi({ system, prompt, model, maxTokens, effort, timeoutMs }) {
  const { Anthropic, client } = await getClient().catch((err) => {
    throw new LlmError('โหลด @anthropic-ai/sdk ไม่สำเร็จ ลองรัน npm install อีกครั้ง', { cause: err, code: 'sdk' });
  });
  const useModel = resolveModel(model) || DEFAULT_MODEL;
  const params = {
    model: useModel,
    max_tokens: maxTokens || 32000,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) params.system = system;
  if (EFFORTS.includes(effort)) params.output_config = { effort };
  try {
    let message;
    if (FALLBACK_CAPABLE.test(useModel)) {
      // Opt in to server-side refusal fallbacks: a false-positive classifier decline is re-run on another model.
      message = await client.beta.messages
        .stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { timeout: timeoutMs })
        .finalMessage();
    } else {
      message = await client.messages.stream(params, { timeout: timeoutMs }).finalMessage();
    }
    if (message.stop_reason === 'refusal') {
      throw new LlmError('Claude ปฏิเสธคำขอนี้ ลองปรับไอเดียหรือถ้อยคำแล้วลองใหม่อีกครั้ง', { code: 'refusal' });
    }
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!text.trim()) throw new LlmError('Claude ตอบกลับมาว่างเปล่า ลองใหม่อีกครั้ง', { code: 'empty' });
    return text;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new LlmError('ANTHROPIC_API_KEY ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบคีย์', { cause: err, code: 'auth' });
    }
    if (err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.NotFoundError) {
      throw new LlmError(`บัญชีนี้ใช้โมเดล ${useModel} ไม่ได้ ลองตั้ง NITHAN_MODEL เป็นโมเดลอื่น (${err.message})`, { cause: err, code: 'model' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new LlmError('เรียก Claude ถี่เกินโควตา (rate limit) รอสักครู่แล้วลองใหม่', { cause: err, code: 'rate' });
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new LlmError('Claude ใช้เวลานานเกินกำหนด ลองใหม่อีกครั้ง', { cause: err, code: 'timeout' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new LlmError('เชื่อมต่อ Claude API ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', { cause: err, code: 'network' });
    }
    if (err instanceof Anthropic.APIError) {
      throw new LlmError(`Claude API ผิดพลาด (${err.status ?? '?'}): ${err.message}`, { cause: err, code: 'api' });
    }
    throw err;
  }
}

// ───────────────────────────── CLI backend ─────────────────────────────

/** Arguments for the `claude` CLI call (exported for tests). */
export function buildCliArgs({ system, model, effort } = {}) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--tools', '', // pure text generation: no tools
    '--strict-mcp-config', // ignore the user's MCP servers
    '--disable-slash-commands',
    '--no-session-persistence',
  ];
  // Replace Claude Code's own system prompt entirely: we want a writer/illustrator, not a coding agent.
  args.push('--system-prompt', system || 'You are a helpful assistant.');
  args.push('--model', resolveModel(model) || DEFAULT_MODEL);
  if (EFFORTS.includes(effort)) args.push('--effort', effort);
  return args;
}

/** Pull the reply text out of `claude -p --output-format json` stdout (exported for tests). */
export function parseCliOutput(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) throw new LlmError('claude CLI ไม่ได้ส่งผลลัพธ์กลับมา', { code: 'empty' });
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Some versions print log lines before the JSON object: take the last JSON-looking line.
    const line = raw.split('\n').reverse().find((l) => l.trim().startsWith('{') || l.trim().startsWith('['));
    try {
      data = JSON.parse(line);
    } catch (err) {
      throw new LlmError('อ่านผลลัพธ์จาก claude CLI ไม่ได้: ' + raw.slice(0, 200), { cause: err, code: 'parse' });
    }
  }
  if (Array.isArray(data)) data = data.reverse().find((e) => e && e.type === 'result') || {};
  if (data.is_error || (data.subtype && data.subtype !== 'success')) {
    const why = typeof data.result === 'string' && data.result ? data.result : data.subtype || 'unknown error';
    throw new LlmError('claude CLI แจ้งข้อผิดพลาด: ' + why, { code: 'cli' });
  }
  if (typeof data.result !== 'string' || !data.result.trim()) {
    throw new LlmError('Claude ตอบกลับมาว่างเปล่า ลองใหม่อีกครั้ง', { code: 'empty' });
  }
  return data.result;
}

function completeViaCli({ system, prompt, model, effort, timeoutMs }) {
  const bin = process.env.NITHAN_CLAUDE_BIN || 'claude';
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, buildCliArgs({ system, model, effort }), {
        cwd: os.tmpdir(), // neutral cwd: don't load this repo's CLAUDE.md / project context
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (err) {
      reject(noBackendError(err));
      return;
    }
    let out = '';
    let errOut = '';
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(v);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new LlmError(`Claude ใช้เวลานานเกิน ${Math.round(timeoutMs / 1000)} วินาที จึงยกเลิก ลองใหม่อีกครั้ง`, { code: 'timeout' }));
    }, timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (d) => (out += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (errOut += d));
    child.on('error', (err) => finish(reject, err.code === 'ENOENT' ? noBackendError(err) : new LlmError('เรียก claude CLI ไม่สำเร็จ: ' + err.message, { cause: err, code: 'cli' })));
    child.on('close', (code) => {
      try {
        finish(resolve, parseCliOutput(out));
      } catch (err) {
        if (code !== 0 && !out.trim()) {
          const hint = /log ?in|auth|credential|api key/i.test(errOut) ? ' (ยังไม่ได้ล็อกอิน? ลองรัน `claude` แล้ว /login)' : '';
          finish(reject, new LlmError(`claude CLI จบการทำงานด้วยรหัส ${code}${hint}: ${errOut.trim().slice(0, 300)}`, { code: 'cli' }));
        } else finish(reject, err);
      }
    });
    child.stdin.on('error', () => {}); // EPIPE if the CLI dies early; the close handler reports it
    child.stdin.end(prompt);
  });
}

function noBackendError(cause) {
  return new LlmError(
    'ไม่พบวิธีเรียก Claude: ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY และไม่พบคำสั่ง `claude` (Claude Code) ในเครื่อง\n' +
      'ทางแก้: ตั้งค่า ANTHROPIC_API_KEY=sk-ant-… หรือติดตั้ง Claude Code แล้วล็อกอิน หรือใช้ --mock เพื่อทดลองโดยไม่เรียก Claude',
    { cause, code: 'no-backend' },
  );
}

// ───────────────────────────── public API ─────────────────────────────

/**
 * One-shot completion → reply text.
 * @param {{system?:string, prompt:string, model?:string, maxTokens?:number, effort?:string, timeoutMs?:number, backend?:'api'|'cli'}} opts
 * @returns {Promise<string>}
 */
export async function complete(opts) {
  if (!opts || typeof opts.prompt !== 'string' || !opts.prompt.trim()) throw new LlmError('prompt ว่างเปล่า', { code: 'input' });
  const o = { timeoutMs: DEFAULT_TIMEOUT_MS, effort: process.env.NITHAN_EFFORT, ...opts };
  const backend = o.backend || pickBackend();
  return backend === 'api' ? completeViaApi(o) : completeViaCli(o);
}

/** Close any brackets/strings left open by a truncated JSON reply. */
function closeTruncated(s) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = s;
  if (inStr) out += '"';
  out = out.replace(/[,:]\s*$/, (m) => (m.trim() === ':' ? ': null' : ''));
  while (stack.length) out += stack.pop();
  return out;
}

/** Escape raw newlines/tabs that appear inside JSON string literals. */
function escapeControlInStrings(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) {
        esc = false;
        out += ch;
      } else if (ch === '\\') {
        esc = true;
        out += ch;
      } else if (ch === '"') {
        inStr = false;
        out += ch;
      } else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '';
      else if (ch === '\t') out += '\\t';
      else out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

/**
 * Extract a JSON object/array from an LLM reply (code fences, chatter around it, trailing commas,
 * raw newlines in strings, truncated tail). Throws SyntaxError when nothing parses.
 */
export function extractJson(text) {
  let s = String(text ?? '').replace(/^﻿/, '').trim();
  const fence = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
  if (fence && /[{[]/.test(fence[1])) s = fence[1].trim();
  else s = s.replace(/^```(?:json|JSON)?\s*/, '');
  const start = s.search(/[{[]/);
  if (start < 0) throw new SyntaxError('no JSON object found in reply');
  const open = s[start];
  const end = s.lastIndexOf(open === '{' ? '}' : ']');
  const body = end > start ? s.slice(start, end + 1) : s.slice(start);
  const attempts = [
    (x) => x,
    (x) => x.replace(/,\s*([}\]])/g, '$1'),
    (x) => escapeControlInStrings(x).replace(/,\s*([}\]])/g, '$1'),
    (x) => closeTruncated(escapeControlInStrings(s.slice(start))).replace(/,\s*([}\]])/g, '$1'),
  ];
  let firstErr;
  for (const fix of attempts) {
    try {
      return JSON.parse(fix(body));
    } catch (err) {
      firstErr ??= err;
    }
  }
  throw new SyntaxError('invalid JSON in reply: ' + firstErr.message);
}

/**
 * Completion that must return JSON. Extracts/repairs; on failure retries once telling Claude what went wrong.
 * `validate(obj)` may throw to trigger the same single retry (its message is fed back).
 * @returns {Promise<any>}
 */
export async function completeJson(opts, { validate, llm = complete } = {}) {
  let lastErr;
  let prompt = opts.prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await llm({ ...opts, prompt });
    try {
      const obj = extractJson(text);
      return validate ? (validate(obj) ?? obj) : obj;
    } catch (err) {
      lastErr = err;
      prompt =
        `${opts.prompt}\n\n---\nYour previous reply could not be used: ${err.message}\n` +
        'Reply again with ONLY one complete, valid JSON object (double-quoted keys and strings, no trailing commas, ' +
        'no markdown fences, no commentary), fixing that problem.';
    }
  }
  throw new LlmError('Claude ตอบกลับมาไม่ตรงรูปแบบที่ต้องการ (ลองแล้ว 2 ครั้ง): ' + lastErr.message, { cause: lastErr, code: 'format' });
}
