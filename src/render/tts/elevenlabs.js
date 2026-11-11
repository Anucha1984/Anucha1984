// ElevenLabs text-to-speech (multilingual model speaks Thai). Needs ELEVENLABS_API_KEY.
export const name = 'elevenlabs';
export const available = (env = process.env) => Boolean(env.ELEVENLABS_API_KEY);

/** Pure request builder (unit-testable). rate → voice_settings.speed (0.7–1.2); pitch is applied afterwards with ffmpeg. */
export function buildRequest({ text, voice, rate = 1, role }, env = process.env) {
  const model = env.NITHAN_ELEVENLABS_MODEL || 'eleven_multilingual_v2';
  const ghost = role === 'ghost';
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: ghost ? 0.3 : 0.45,
        similarity_boost: 0.75,
        style: ghost ? 0.55 : 0.3,
        use_speaker_boost: true,
        speed: Math.min(1.2, Math.max(0.7, Number(rate.toFixed(2)))),
      },
    }),
  };
}

export async function synthesize(req, { timeoutMs = 45000, fetchImpl = globalThis.fetch } = {}) {
  const { url, ...init } = buildRequest(req);
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`elevenlabs tts: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
