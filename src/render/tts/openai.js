// OpenAI text-to-speech (POST /v1/audio/speech). Needs OPENAI_API_KEY.
export const name = 'openai';
export const available = (env = process.env) => Boolean(env.OPENAI_API_KEY);

/** Pure request builder (unit-testable). rate → `speed`; pitch is applied afterwards with ffmpeg. */
export function buildRequest({ text, voice, rate = 1, instructions }, env = process.env) {
  const model = env.NITHAN_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const body = { model, voice, input: text, response_format: 'mp3', speed: Math.min(4, Math.max(0.25, Number(rate.toFixed(2)))) };
  // only the gpt-4o* speech models understand free-form delivery instructions
  if (instructions && /^gpt-4o/.test(model)) body.instructions = instructions;
  return {
    url: `${base}/audio/speech`,
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function synthesize(req, { timeoutMs = 30000, fetchImpl = globalThis.fetch } = {}) {
  const { url, ...init } = buildRequest(req);
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`openai tts: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
