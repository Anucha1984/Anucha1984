// Voice roles (shared/presets.js VOICE_ROLES) → concrete voice + delivery, per provider.
import { GENRES, VOICE_ROLES } from '../../shared/presets.js';

/**
 * Provider-independent delivery per role.
 *  gender: which base voice; rate: speed multiplier; pitch: semitones; echo: spectral tail for ghosts.
 */
export const ROLE_PROFILES = {
  narrator: { gender: null, rate: 1.0, pitch: 0 }, // gender comes from GENRES[genre].narratorVoice
  male: { gender: 'male', rate: 1.02, pitch: 0 },
  female: { gender: 'female', rate: 1.02, pitch: 0.4 },
  child: { gender: 'female', rate: 1.1, pitch: 3.2 },
  'elder-male': { gender: 'male', rate: 0.88, pitch: -1.6 },
  'elder-female': { gender: 'female', rate: 0.88, pitch: -1.8 },
  ghost: { gender: 'female', rate: 0.8, pitch: -3.5, echo: true },
};

const BASE_VOICES = {
  edge: { female: 'th-TH-PremwadeeNeural', male: 'th-TH-NiwatNeural' },
  // OpenAI voices are multilingual; these read Thai acceptably.
  openai: { female: 'nova', male: 'onyx', child: 'coral', 'elder-male': 'ash', 'elder-female': 'sage', ghost: 'fable' },
  // ElevenLabs premade voice ids (multilingual v2 speaks Thai with any of them).
  elevenlabs: {
    female: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    male: 'JBFqnCBsd6RMkjVDRZzb', // George
    child: 'pFZP5JQG7iQjIQuC4Bku', // Lily
    'elder-male': 'pqHfZKP75CvOlQylNhV4', // Bill
    'elder-female': 'XB0fDUnXU5powFXDhCwa', // Charlotte
    ghost: 'N2lVS1w4EtoT3dr4eOWO', // Callum
  },
};

const OPENAI_INSTRUCTIONS = {
  narrator: 'พูดภาษาไทยชัดถ้อยชัดคำ น้ำเสียงนักเล่าเรื่อง ชวนติดตาม',
  male: 'พูดภาษาไทย น้ำเสียงผู้ชายวัยหนุ่ม มีอารมณ์ตามบท',
  female: 'พูดภาษาไทย น้ำเสียงผู้หญิงวัยสาว มีอารมณ์ตามบท',
  child: 'พูดภาษาไทย น้ำเสียงเด็ก สดใส',
  'elder-male': 'พูดภาษาไทย น้ำเสียงชายชรา ช้าและใจดี',
  'elder-female': 'พูดภาษาไทย น้ำเสียงหญิงชรา ช้าและอบอุ่น',
  ghost: 'พูดภาษาไทย เสียงกระซิบเย็นยะเยือก ช้า ลากเสียง น่าขนลุก',
};

const envKey = (provider, role) => `NITHAN_VOICE_${provider}_${role}`.toUpperCase().replace(/-/g, '_');

/**
 * @param {'edge'|'openai'|'elevenlabs'} provider
 * @param {string} role one of VOICE_ROLES
 * @param {string} genre key of GENRES (decides the narrator's gender and mood)
 * @returns {{role:string,gender:string,voice:string,rate:number,pitch:number,echo:boolean,instructions?:string}}
 */
export function resolveVoice(provider, role, genre, env = process.env) {
  const r = VOICE_ROLES.includes(role) ? role : 'narrator';
  const g = GENRES[genre] ?? GENRES.folktale;
  const profile = { ...ROLE_PROFILES[r] };
  if (r === 'narrator') {
    profile.gender = g.narratorVoice === 'male' ? 'male' : 'female';
    if (g.id === 'ghost') Object.assign(profile, { rate: 0.94, pitch: -0.8 }); // calm, low storyteller
    if (g.id === 'cdrama') profile.rate = 1.05; // punchy
  }
  const table = BASE_VOICES[provider] ?? BASE_VOICES.edge;
  // narrator and plain male/female use the gendered base voice; special roles may have a dedicated one
  const voice = env[envKey(provider, r)] || (r !== 'narrator' && table[r]) || table[profile.gender];
  const out = { role: r, gender: profile.gender, voice, rate: profile.rate, pitch: profile.pitch, echo: Boolean(profile.echo) };
  if (provider === 'openai') out.instructions = OPENAI_INSTRUCTIONS[r];
  return out;
}
