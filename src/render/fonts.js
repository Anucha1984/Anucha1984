// Bundled Thai fonts (@fontsource/*) → @font-face CSS with inlined woff2 data URLs,
// so Chromium can draw Thai text without any system font.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FONT_FAMILIES = ['Kanit', 'Sarabun', 'Charm', 'Chakra Petch', 'Mitr'];
export const DEFAULT_FONT = 'Kanit';

// Same unicode-range split that fontsource ships in its own CSS.
const RANGES = {
  thai: 'U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC',
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};

// Optical size correction so every genre font reads equally big (Charm is a small, light script face).
const SCALE = { Charm: 1.2, Sarabun: 1.04, 'Chakra Petch': 1.0, Kanit: 1.0, Mitr: 1.0 };

export const fontSlug = (family) => String(family).trim().toLowerCase().replace(/\s+/g, '-');
export const fontScale = (family) => SCALE[family] ?? 1;

function fontDir(slug) {
  const candidates = [];
  try {
    candidates.push(path.join(path.dirname(require.resolve(`@fontsource/${slug}/package.json`)), 'files'));
  } catch {
    /* fall through to path guesses */
  }
  candidates.push(
    path.resolve(HERE, '../../node_modules/@fontsource', slug, 'files'),
    path.resolve(process.cwd(), 'node_modules/@fontsource', slug, 'files'),
  );
  return candidates.find((d) => fs.existsSync(d)) ?? null;
}

const cache = new Map();

/** Resolve a family name to one we actually have on disk (falls back to Kanit). */
export function resolveFont(family) {
  const wanted = FONT_FAMILIES.find((f) => fontSlug(f) === fontSlug(family || '')) ?? DEFAULT_FONT;
  if (fontDir(fontSlug(wanted))) return wanted;
  return FONT_FAMILIES.find((f) => fontDir(fontSlug(f))) ?? wanted;
}

/**
 * @font-face rules for a family (thai + latin subsets, weights 400 and 700).
 * Returns '' when the font package is missing (text then falls back to system fonts).
 */
export function fontFaceCss(family, weights = [400, 700]) {
  const key = `${family}|${weights.join(',')}`;
  if (cache.has(key)) return cache.get(key);
  const slug = fontSlug(family);
  const dir = fontDir(slug);
  let css = '';
  if (dir) {
    for (const weight of weights) {
      for (const subset of ['latin', 'thai']) {
        const file = path.join(dir, `${slug}-${subset}-${weight}-normal.woff2`);
        if (!fs.existsSync(file)) continue;
        const b64 = fs.readFileSync(file).toString('base64');
        css +=
          `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;` +
          `src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${RANGES[subset]};}\n`;
      }
    }
  }
  cache.set(key, css);
  return css;
}
