// Shared presets: genres (แนวเรื่อง), art styles (ลายเส้น), voices, lengths.
// Owned by the integrator. Engine, renderer and studio UI all read from here.

/** @type {Record<string, import('./schema.js').GenrePreset>} */
export const GENRES = {
  cdrama: {
    id: 'cdrama',
    name: 'ซีรีส์จีนแนวตั้ง',
    tagline: 'ดราม่าเข้มข้น หักมุมทุกนาที จบตอนแบบค้างคา',
    emoji: '🐉',
    accent: '#E5484D',
    defaultStyle: 'china',
    captionFont: 'Kanit',
    examples: [
      'ประธานบริษัทปลอมตัวเป็นพนักงานส่งของ เพื่อทดสอบใจคู่หมั้น',
      'ลูกสาวตัวจริงที่ถูกสลับตัวตอนเกิด กลับมาทวงทุกอย่างคืน',
      'ฉันย้อนเวลากลับมาก่อนวันแต่งงาน 3 วัน ครั้งนี้ฉันจะไม่ยอมโดนหักหลังอีก',
    ],
    writing:
      'Chinese vertical short-drama (竖屏短剧) adapted for Thai audiences, fully in Thai. ' +
      'Open with a shocking hook in the first line. Fast pacing, dialogue-driven, heightened emotion: ' +
      'hidden identities, betrayal, face-slapping reversals, rebirth/revenge, rich-vs-poor. ' +
      'Each episode must end on a cliffhanger. Character names may be Chinese names transliterated to Thai ' +
      '(e.g. กู้เฉิน, หลินเสี่ยวเยว่). Dialogue is punchy spoken Thai like a Thai-dubbed Chinese drama.',
    narratorVoice: 'female',
  },
  ghost: {
    id: 'ghost',
    name: 'การ์ตูนผีเล่มละบาท',
    tagline: 'ผีไทยคลาสสิก เวรกรรมตามทัน หักมุมตอนจบ',
    emoji: '👻',
    accent: '#7C5CFF',
    defaultStyle: 'thai-retro',
    captionFont: 'Chakra Petch',
    examples: [
      'วินมอเตอร์ไซค์รับผู้โดยสารสาวตอนตีสอง ไปส่งที่ซอยวัดร้าง',
      'ผีกระสือในหมู่บ้านริมคลอง ที่แท้คือคนที่ทุกคนไว้ใจที่สุด',
      'เช่าห้องราคาถูกผิดปกติ แล้วพบว่าเพื่อนร่วมห้องไม่มีเงา',
    ],
    writing:
      'Thai pulp horror in the spirit of the old 1–5 baht ghost comics (การ์ตูนผีเล่มละบาท). ' +
      'A calm storyteller narrator, everyday Thai settings (temple, village, night road, rented room), ' +
      'classic Thai ghosts (กระสือ, ปอบ, นางรำ, ผีตายโหง, เปรต, นางตานี). Build dread slowly, one strong scare, ' +
      'and a twist ending driven by karma (เวรกรรม) with a short moral line. Spooky but not gory; no graphic violence.',
    narratorVoice: 'male',
  },
  folktale: {
    id: 'folktale',
    name: 'นิทานพื้นบ้านไทย',
    tagline: 'ปลาบู่ทอง หลวิชัยคาวี สังข์ทอง เล่าใหม่ให้สนุก',
    emoji: '🐟',
    accent: '#F5A524',
    defaultStyle: 'thai',
    captionFont: 'Charm',
    examples: ['ปลาบู่ทอง', 'หลวิชัยคาวี', 'สังข์ทอง', 'ไกรทอง', 'นางสิบสอง', 'แก้วหน้าม้า'],
    writing:
      'A faithful, warm retelling of a traditional Thai folktale (นิทานพื้นบ้าน / จักร ๆ วงศ์ ๆ). ' +
      'Keep the canonical plot, characters and names of the tale if it is a known one (e.g. ปลาบู่ทอง: เอื้อย, อ้าย, ขนิษฐา, ขนิษฐี, ต้นโพธิ์เงินโพธิ์ทอง). ' +
      'Narrated like a grandparent telling a story (“กาลครั้งหนึ่งนานมาแล้ว…”), simple vivid Thai, ' +
      'a few lines of character dialogue, and end with a clear moral (“นิทานเรื่องนี้สอนให้รู้ว่า…”). Family friendly.',
    narratorVoice: 'female',
  },
};

/** @type {Record<string, import('./schema.js').StylePreset>} */
export const STYLES = {
  realistic: {
    id: 'realistic',
    name: 'ภาพสมจริง',
    subtitle: 'Cinematic Realistic',
    swatch: ['#E8B36A', '#B5483A', '#3F6B73', '#0E1116'],
    needsImageModel: true,
    art: 'Semi-realistic cinematic digital painting with realistic proportions, detailed faces and dramatic lighting.',
    photo:
      'Photorealistic cinematic still, like a frame from a Thai feature film: real human proportions and skin texture, ' +
      'natural Thai faces, detailed fabric and environment, moody practical lighting (street lamps, candles, moonlight), ' +
      'wet reflective surfaces, volumetric haze, shallow depth of field, 35mm lens, subtle film grain, rich colour grade. ' +
      'Not a cartoon, not anime, not flat illustration.',
  },
  'dark-fantasy': {
    id: 'dark-fantasy',
    name: 'สยองสมจริง',
    subtitle: 'Dark Fantasy Realism',
    swatch: ['#F2C14E', '#7A1E1E', '#1E3A4C', '#07090D'],
    needsImageModel: true,
    art: 'Hyper-detailed dark fantasy digital painting with realistic anatomy, eerie glow and deep shadows.',
    photo:
      'Hyper-detailed dark-fantasy realism, like a high-end horror game concept render: lifelike anatomy and textures, ' +
      'ornate Thai costume and jewellery rendered bead by bead, pale or desiccated ghost skin, glowing eyes, ' +
      'night scene lit by candles, lanterns and a crescent moon, old Thai wooden houses and temple roofs in the background, ' +
      'thick atmosphere, strong rim light, deep blacks, cinematic contrast. Eerie but not gory. Not a cartoon.',
  },
  pixar: {
    id: 'pixar',
    name: '3D แอนิเมชัน',
    subtitle: 'แนว Pixar',
    swatch: ['#FFB347', '#FF6F61', '#4FC3F7', '#2D3A8C'],
    art:
      'Stylised 3D-animation-film look rendered as vector art: big expressive eyes, rounded chunky shapes, ' +
      'soft volumetric shading built from layered radial/linear gradients, warm rim light, subtle ambient-occlusion ' +
      'shadows, saturated cinematic colour, shallow-depth blurred backgrounds (feGaussianBlur).',
  },
  'comic-us': {
    id: 'comic-us',
    name: 'คอมิกอเมริกัน',
    subtitle: 'US Comic',
    swatch: ['#FFD400', '#E10600', '#0057B8', '#111111'],
    art:
      'American comic-book look: bold black ink outlines of varying weight, flat primary colours, ' +
      'Ben-Day halftone dot patterns (SVG <pattern>), dramatic foreshortening, hard cel shadows, speed lines, ' +
      'heroic anatomy, high contrast.',
  },
  china: {
    id: 'china',
    name: 'มังฮวาจีน',
    subtitle: 'China Manhua',
    swatch: ['#C8102E', '#F2C14E', '#1B1B1E', '#F7EDE2'],
    art:
      'Chinese manhua / guofeng look: elegant slender figures, flowing hair and robes or sharp modern suits, ' +
      'delicate thin linework, ink-wash (水墨) gradient backgrounds, vermilion and gold accents, ' +
      'misty mountains, lattice windows, lanterns, glossy dramatic eye highlights.',
  },
  korea: {
    id: 'korea',
    name: 'เว็บตูนเกาหลี',
    subtitle: 'Korea Webtoon',
    swatch: ['#FF8FB1', '#B79CED', '#7BDFF2', '#FDFCDC'],
    art:
      'Korean webtoon look: clean thin outlines, soft pastel cel shading with one gradient shadow layer, ' +
      'tall fashionable characters, glowing bloom highlights, sparkles/bokeh, airy modern interiors, ' +
      'soft pink-violet-mint palette.',
  },
  thai: {
    id: 'thai',
    name: 'จิตรกรรมไทย',
    subtitle: 'Thai Traditional',
    swatch: ['#B8860B', '#8B1A1A', '#1F4E3D', '#F3E3B3'],
    art:
      'Thai traditional mural painting (จิตรกรรมฝาผนัง) look: flat perspective, gold-leaf outlines, ' +
      'kranok (กระหนก) flame motifs, characters in chada crowns and sabai, earthy red / indigo / deep green / gold palette, ' +
      'stylised lotus ponds, Thai wooden houses on stilts, temple roofs with chofa, decorative borders.',
  },
  'thai-retro': {
    id: 'thai-retro',
    name: 'การ์ตูนเล่มละบาท',
    subtitle: 'Thai Retro Pulp',
    swatch: ['#E63946', '#F1C40F', '#2A9D8F', '#F4E9CD'],
    art:
      'Vintage Thai 1-baht pulp comic look: rough heavy brush-ink outlines, cross-hatching, cheap offset-print ' +
      'limited palette (red, yellow, teal, black) on yellowed newsprint paper, visible halftone dots and slight ' +
      'mis-registration, exaggerated terrified faces, lurid dramatic lighting, hand-drawn feel.',
  },
  anime: {
    id: 'anime',
    name: 'อนิเมะญี่ปุ่น',
    subtitle: 'Japan Anime',
    swatch: ['#3A86FF', '#FF006E', '#FFBE0B', '#0B132B'],
    art:
      'Japanese anime look: crisp cel shading with two tone shadows, large detailed eyes, dynamic angles, ' +
      'painted sky backgrounds with dramatic clouds and light shafts, vivid colour, lens-flare highlights.',
  },
};

/** Voice roles used in storyboard lines → mapped to concrete TTS voices by the renderer. */
export const VOICE_ROLES = ['narrator', 'male', 'female', 'child', 'elder-male', 'elder-female', 'ghost'];

export const LENGTHS = {
  short: { id: 'short', name: 'สั้น ~45 วิ', scenes: 6 },
  medium: { id: 'medium', name: 'กลาง ~90 วิ', scenes: 10 },
  long: { id: 'long', name: 'ยาว ~3 นาที', scenes: 18 },
};

export const CAMERA_MOVES = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'static'];

export const DEFAULTS = {
  genre: 'folktale',
  length: 'short',
  tts: 'auto', // auto | edge | openai | elevenlabs | none
  music: true,
  width: 1080,
  height: 1920,
  fps: 30,
};

export function resolveOptions(input = {}) {
  const genre = GENRES[input.genre] ? input.genre : DEFAULTS.genre;
  const style = STYLES[input.style] ? input.style : GENRES[genre].defaultStyle;
  const length = LENGTHS[input.length] ? input.length : DEFAULTS.length;
  const scenes = Math.max(3, Math.min(30, Number(input.scenes) || LENGTHS[length].scenes));
  return {
    prompt: String(input.prompt || '').trim(),
    genre,
    style,
    length,
    scenes,
    tts: input.tts || DEFAULTS.tts,
    music: input.music ?? DEFAULTS.music,
    outDir: input.outDir || 'output',
    mock: Boolean(input.mock),
    // series support: pass the previous episode's storyboard.series to continue the story
    series: input.series || null,
    model: input.model || null,
    image: input.image || null, // auto | claude | gemini | openai (see engine/image.js)
  };
}
