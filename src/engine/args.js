// Argument parsing + help text for bin/nithan.js (no dependencies; kept here so it can be unit-tested).
import { GENRES, LENGTHS, STYLES } from '../shared/presets.js';

const TTS = ['auto', 'edge', 'openai', 'elevenlabs', 'none'];
const VALUE_FLAGS = {
  '--genre': 'genre', '-g': 'genre',
  '--style': 'style', '-s': 'style',
  '--length': 'length', '-l': 'length',
  '--scenes': 'scenes', '-n': 'scenes',
  '--tts': 'tts',
  '--image': 'image',
  '--out': 'outDir', '-o': 'outDir',
  '--continue': 'continueDir', '-c': 'continueDir',
  '--model': 'model',
};

/**
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {{command:'create'|'list'|'studio'|'help'|'version', input:object, continueDir?:string, errors:string[]}}
 */
export function parseArgs(argv) {
  const input = {};
  const errors = [];
  const words = [];
  let command = 'create';
  let continueDir;
  const args = [...argv];
  while (args.length) {
    let a = args.shift();
    if (a === '--') {
      words.push(...args.splice(0));
      break;
    }
    if (a === '--help' || a === '-h') command = 'help';
    else if (a === '--version' || a === '-v') command = 'version';
    else if (a === '--mock') input.mock = true;
    else if (a === '--open') input.open = true;
    else if (a === '--no-music') input.music = false;
    else if (a.startsWith('-') && a.length > 1) {
      let value;
      const eq = a.indexOf('=');
      if (a.startsWith('--') && eq > 0) {
        value = a.slice(eq + 1);
        a = a.slice(0, eq);
      }
      const key = VALUE_FLAGS[a];
      if (!key) {
        errors.push(`ไม่รู้จักตัวเลือก ${a}`);
        continue;
      }
      if (value === undefined) {
        if (!args.length || (args[0].startsWith('--') && args[0].length > 2)) {
          errors.push(`ตัวเลือก ${a} ต้องมีค่าตามหลัง`);
          continue;
        }
        value = args.shift();
      }
      if (key === 'continueDir') continueDir = value;
      else if (key === 'scenes') {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 3 || n > 30) errors.push(`--scenes ต้องเป็นจำนวนเต็ม 3–30 (ได้ "${value}")`);
        else input.scenes = n;
      } else input[key] = value;
    } else words.push(a);
  }

  if (command === 'create' && words.length && ['list', 'studio', 'help'].includes(words[0]) && words.length === 1) {
    command = words.shift();
  }
  if (input.genre && !GENRES[input.genre]) errors.push(`ไม่รู้จักแนวเรื่อง "${input.genre}" (เลือกได้: ${Object.keys(GENRES).join(', ')})`);
  if (input.style && !STYLES[input.style]) errors.push(`ไม่รู้จักลายเส้น "${input.style}" (เลือกได้: ${Object.keys(STYLES).join(', ')})`);
  if (input.length && !LENGTHS[input.length]) errors.push(`ไม่รู้จักความยาว "${input.length}" (เลือกได้: ${Object.keys(LENGTHS).join(', ')})`);
  if (input.tts && !TTS.includes(input.tts)) errors.push(`ไม่รู้จัก --tts "${input.tts}" (เลือกได้: ${TTS.join(', ')})`);
  input.prompt = words.join(' ').trim();
  if (command === 'create' && !input.prompt && !continueDir && !errors.length) command = 'help';
  return { command, input, continueDir, errors };
}

/**
 * Merge a previous project's storyboard into the input for the next episode (`--continue`).
 * Explicit flags win over the previous project's genre/style.
 */
export function continueInput(input, prev) {
  if (!prev || typeof prev !== 'object') throw new Error('ไม่พบสตอรี่บอร์ดของตอนก่อนหน้า');
  const series = {
    title: prev.series?.title || prev.title,
    episode: Number(prev.series?.episode) || 1,
    summary: prev.series?.summary || prev.logline || '',
    nextHook: prev.series?.nextHook || '',
    characters: prev.series?.characters || prev.characters || [],
  };
  return {
    ...input,
    genre: input.genre || prev.genre,
    style: input.style || prev.style,
    scenes: input.scenes || (input.length ? undefined : prev.scenes?.length),
    prompt: input.prompt || series.title,
    series,
  };
}

export function helpText() {
  return `NiThan Studio — สร้างวิดีโอแนวตั้งพากย์ไทยด้วย Claude ในคำสั่งเดียว

วิธีใช้
  nithan "<ชื่อเรื่องหรือไอเดีย>" [ตัวเลือก]     สร้างวิดีโอหนึ่งเรื่อง
  nithan --continue <โฟลเดอร์โปรเจกต์> ["ทิศทางของตอนใหม่"]   สร้างตอนต่อไปของเรื่องเดิม
  nithan list                                   ดูแนวเรื่องและลายเส้นทั้งหมด
  nithan studio [--open]                        เปิดสตูดิโอ (--open เปิดเบราว์เซอร์ให้เลย)

ตัวเลือก
  --genre, -g   แนวเรื่อง: ${Object.keys(GENRES).join(' | ')}   (ค่าเริ่มต้น folktale)
  --style, -s   ลายเส้น: ${Object.keys(STYLES).join(' | ')}
                (ค่าเริ่มต้นตามแนวเรื่อง)
  --length, -l  ความยาว: short (~45 วิ) | medium (~90 วิ) | long (~3 นาที)
  --scenes, -n  กำหนดจำนวนฉากเอง 3–30
  --image       ผู้วาดภาพ: auto | claude | cloudflare | gemini | openai (ภาพสมจริงใช้ cloudflare ได้ฟรี)
  --tts         เสียงพากย์: ${TTS.join(' | ')}
  --no-music    ไม่ใส่ดนตรีประกอบ
  --out, -o     โฟลเดอร์เก็บผลงาน (ค่าเริ่มต้น output)
  --model       ระบุโมเดล Claude เอง (หรือตั้ง NITHAN_MODEL)
  --mock        ทดลองโดยไม่เรียก Claude (ใช้บทและภาพจำลอง)
  --continue, -c <dir>  ต่อตอนใหม่จากโปรเจกต์เดิม (ใช้ตัวละคร แนวเรื่อง ลายเส้นเดิม)
  --help, -h    แสดงวิธีใช้นี้

ตัวอย่าง
  nithan "ปลาบู่ทอง"
  nithan "วินมอเตอร์ไซค์รับผู้โดยสารสาวตอนตีสอง" --genre ghost --style thai-retro
  nithan "ประธานบริษัทปลอมตัวเป็นพนักงานส่งของ" -g cdrama -s china -l medium
  nithan --continue output/reel-20260101120000

การเชื่อมต่อ Claude
  ถ้าตั้ง ANTHROPIC_API_KEY ไว้จะเรียกผ่าน API โดยตรง ไม่เช่นนั้นจะใช้คำสั่ง claude (Claude Code) ที่ล็อกอินไว้แล้ว
`;
}

export function listText() {
  const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
  let out = 'แนวเรื่อง (--genre)\n';
  for (const g of Object.values(GENRES)) out += `  ${pad(g.id, 12)}${g.name} — ${g.tagline}  [ลายเส้นเริ่มต้น: ${g.defaultStyle}]\n`;
  out += '\nลายเส้น (--style)\n';
  for (const s of Object.values(STYLES)) out += `  ${pad(s.id, 12)}${s.name} (${s.subtitle})\n`;
  out += '\nความยาว (--length)\n';
  for (const l of Object.values(LENGTHS)) out += `  ${pad(l.id, 12)}${l.name} · ${l.scenes} ฉาก\n`;
  return out;
}
