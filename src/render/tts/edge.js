// Microsoft Edge "Read aloud" TTS over WebSocket (free, no key). Protocol notes:
//  - wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1
//  - query: TrustedClientToken, ConnectionId, Sec-MS-GEC (rolling 5-minute SHA-256 token), Sec-MS-GEC-Version
//  - text frame 1: speech.config (output format), text frame 2: SSML
//  - binary frames: [uint16 BE header length][headers][mp3 bytes]; text frame "Path:turn.end" ends the turn
import crypto from 'node:crypto';

export const name = 'edge';
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = process.env.NITHAN_EDGE_VERSION || '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0];
const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const WIN_EPOCH_OFFSET = 11644473600; // seconds between 1601-01-01 and 1970-01-01
export const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

export const available = () => typeof globalThis.WebSocket === 'function';

/** Sec-MS-GEC: SHA-256 (upper hex) of "<Windows file-time ticks rounded down to 5 min><TrustedClientToken>". */
export function secMsGec(nowMs = Date.now()) {
  let seconds = Math.floor(nowMs / 1000) + WIN_EPOCH_OFFSET;
  seconds -= seconds % 300;
  const ticks = BigInt(seconds) * 10000000n; // 100-nanosecond intervals
  return crypto.createHash('sha256').update(`${ticks}${TRUSTED_CLIENT_TOKEN}`, 'ascii').digest('hex').toUpperCase();
}

const xmlEscape = (s) =>
  String(s)
    // drop characters that are illegal in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const signed = (n, unit) => `${n >= 0 ? '+' : '-'}${Math.abs(Math.round(n))}${unit}`;

/** "th-TH-PremwadeeNeural" → the long voice name the service expects. */
export function edgeVoiceName(shortName) {
  const m = /^([a-z]{2,3})-([A-Za-z]{2,4})-(.+)$/.exec(shortName);
  if (!m) return shortName;
  return `Microsoft Server Speech Text to Speech Voice (${m[1]}-${m[2]}, ${m[3]})`;
}

/**
 * SSML for one line. rate is a speed multiplier (1 = normal), pitch in semitones (converted to Hz offset).
 */
export function buildSsml({ text, voice, rate = 1, pitch = 0, volume = 0 }) {
  const lang = /^([a-z]{2,3}-[A-Za-z]{2,4})-/.exec(voice)?.[1] ?? 'th-TH';
  const ratePct = signed((rate - 1) * 100, '%');
  const pitchHz = signed(pitch * 10, 'Hz');
  const vol = signed(volume, '%');
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${edgeVoiceName(voice)}'>` +
    `<prosody pitch='${pitchHz}' rate='${ratePct}' volume='${vol}'>${xmlEscape(text)}</prosody>` +
    `</voice></speak>`
  );
}

const jsDate = (d) => {
  // "Thu Jun 20 2024 12:00:00 GMT+0000 (Coordinated Universal Time)"
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`
  );
};

/**
 * Everything needed for one synthesis request (pure — unit-testable without network).
 * @returns {{url:string, headers:Record<string,string>, configMessage:string, ssmlMessage:string, requestId:string}}
 */
export function buildRequest({ text, voice, rate, pitch }, { now = new Date(), connectionId, requestId, muid } = {}) {
  connectionId ??= crypto.randomUUID().replace(/-/g, '');
  requestId ??= crypto.randomUUID().replace(/-/g, '');
  muid ??= crypto.randomBytes(16).toString('hex').toUpperCase();
  const url =
    `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${connectionId}` +
    `&Sec-MS-GEC=${secMsGec(now.getTime())}` +
    `&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`;
  const headers = {
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
      `Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
    Cookie: `muid=${muid};`,
  };
  const stamp = jsDate(now);
  const configMessage =
    `X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
            outputFormat: OUTPUT_FORMAT,
          },
        },
      },
    });
  const ssmlMessage =
    `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp}Z\r\nPath:ssml\r\n\r\n` +
    buildSsml({ text, voice, rate, pitch });
  return { url, headers, configMessage, ssmlMessage, requestId };
}

/** Extract the mp3 payload of a binary frame (empty buffer when it is not an audio frame). */
export function parseAudioFrame(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 2) return Buffer.alloc(0);
  const headerLen = buf.readUInt16BE(0);
  if (headerLen + 2 > buf.length) return Buffer.alloc(0);
  const header = buf.subarray(2, 2 + headerLen).toString('utf8');
  if (!/Path:\s*audio/i.test(header)) return Buffer.alloc(0);
  return buf.subarray(2 + headerLen);
}

/**
 * @param {{text:string, voice:string, rate:number, pitch:number}} req
 * @returns {Promise<Buffer>} mp3
 */
export function synthesize(req, { timeoutMs = 20000, connectTimeoutMs = 5000, WebSocketImpl = globalThis.WebSocket } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocketImpl !== 'function') {
      reject(new Error('WebSocket is not available in this Node version (need Node ≥ 22)'));
      return;
    }
    const { url, headers, configMessage, ssmlMessage } = buildRequest(req);
    const chunks = [];
    let done = false;
    let ws;
    let connectTimer;
    let totalTimer;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(connectTimer);
      clearTimeout(totalTimer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      const audio = Buffer.concat(chunks);
      if (err) reject(err);
      else if (!audio.length) reject(new Error('edge-tts: no audio received'));
      else resolve(audio);
    };
    try {
      // Node's built-in (undici) WebSocket accepts request headers as a non-standard option.
      ws = new WebSocketImpl(url, { headers });
    } catch (err) {
      finish(err);
      return;
    }
    ws.binaryType = 'arraybuffer';
    connectTimer = setTimeout(() => finish(new Error(`edge-tts: connect timeout after ${connectTimeoutMs} ms`)), connectTimeoutMs);
    totalTimer = setTimeout(() => finish(new Error(`edge-tts: timeout after ${timeoutMs} ms`)), timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(connectTimer);
      try {
        ws.send(configMessage);
        ws.send(ssmlMessage);
      } catch (err) {
        finish(err);
      }
    });
    ws.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') {
        if (/Path:\s*turn\.end/i.test(ev.data)) finish();
        return;
      }
      const audio = parseAudioFrame(ev.data instanceof ArrayBuffer ? Buffer.from(ev.data) : ev.data);
      if (audio.length) chunks.push(audio);
    });
    ws.addEventListener('error', (ev) => finish(new Error(`edge-tts: ${ev?.message || ev?.error?.message || 'connection failed'}`)));
    ws.addEventListener('close', (ev) => {
      // a clean close after audio (some gateways drop turn.end) still counts as success
      if (chunks.length) finish();
      else finish(new Error(`edge-tts: connection closed (${ev?.code ?? '?'})`));
    });
  });
}
