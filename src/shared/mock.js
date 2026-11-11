// Offline mock engine: canned storyboard + simple generated SVG art. No Claude call.
// Used by `--mock`, by tests, and by the renderer/studio teams while developing.
import fs from 'node:fs/promises';
import path from 'node:path';
import { GENRES, STYLES } from './presets.js';

const MOODS = ['warm', 'tense', 'eerie', 'sad', 'triumphant'];

export function mockStoryboard(opts) {
  const g = GENRES[opts.genre];
  const title = opts.prompt || g.examples[0];
  const scenes = Array.from({ length: opts.scenes }, (_, i) => ({
    heading: `ฉากที่ ${i + 1}`,
    visual: `Mock scene ${i + 1} for "${title}"`,
    mood: MOODS[i % MOODS.length],
    camera: ['zoom-in', 'pan-left', 'zoom-out', 'pan-up'][i % 4],
    lines:
      i === 0
        ? [{ speaker: 'narrator', text: `กาลครั้งหนึ่งนานมาแล้ว มีเรื่องเล่าขานถึง ${title}` }]
        : [
            { speaker: 'narrator', text: `เหตุการณ์ดำเนินมาถึงตอนที่ ${i + 1} ทุกอย่างเริ่มเปลี่ยนไป` },
            { speaker: i % 2 ? 'hero' : 'elder', text: i % 2 ? 'ข้าจะไม่ยอมแพ้เด็ดขาด!' : 'จงระวังให้ดีเถิดลูกเอ๋ย' },
          ],
  }));
  return {
    title,
    logline: `เรื่องราวตัวอย่างของ ${title} (โหมดจำลอง ไม่ได้เรียก Claude)`,
    hook: title.slice(0, 40),
    genre: opts.genre,
    style: opts.style,
    palette: [...STYLES[opts.style].swatch, '#FFFFFF'].slice(0, 5),
    characters: [
      { id: 'hero', name: 'พระเอก', voice: 'male', visual: 'young man, simple clothes' },
      { id: 'elder', name: 'ยาย', voice: 'elder-female', visual: 'kind old woman' },
    ],
    scenes,
    moral: 'นิทานเรื่องนี้สอนให้รู้ว่า ทำดีได้ดี ทำชั่วได้ชั่ว',
    series: { title, episode: (opts.series?.episode ?? 0) + 1, summary: 'สรุปตอนจำลอง', nextHook: 'แล้วจะเกิดอะไรขึ้นต่อไป…' },
  };
}

export function mockSvg(sb, index) {
  const p = sb.palette;
  const a = p[index % p.length];
  const b = p[(index + 1) % p.length];
  const c = p[(index + 2) % p.length];
  const cx = 300 + ((index * 197) % 480);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#0b0b14"/></linearGradient>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${b}"/></radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <circle cx="${cx}" cy="420" r="150" fill="url(#moon)" opacity=".9"/>
  <path d="M0 1300 Q270 1100 540 1280 T1080 1220 V1920 H0Z" fill="${c}" opacity=".85"/>
  <path d="M0 1500 Q300 1380 620 1520 T1080 1460 V1920 H0Z" fill="#0b0b14" opacity=".7"/>
  <g transform="translate(${420 + (index % 3) * 60} 1120)" fill="${b}">
    <circle cx="60" cy="0" r="70"/><rect x="0" y="70" width="120" height="260" rx="50"/>
  </g>
</svg>`;
}

/** Write mock art for every scene, set scene.art, call onScene(scene) after each. */
export async function mockArt(sb, projectDir, onScene) {
  await fs.mkdir(path.join(projectDir, 'scenes'), { recursive: true });
  for (let i = 0; i < sb.scenes.length; i++) {
    const s = sb.scenes[i];
    s.art = `scenes/${s.id}.svg`;
    await fs.writeFile(path.join(projectDir, s.art), mockSvg(sb, i));
    await new Promise((r) => setTimeout(r, 150));
    onScene?.(s, i);
  }
  return sb;
}
