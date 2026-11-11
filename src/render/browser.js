// One headless Chromium for the whole render: rasterises scene art and draws text overlays.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RenderError, sha1 } from './util.js';
import { fontFaceCss } from './fonts.js';

const require = createRequire(import.meta.url);

function chromiumCandidates() {
  const list = [];
  if (process.env.NITHAN_CHROMIUM) list.push(process.env.NITHAN_CHROMIUM);
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root).filter((e) => e.startsWith('chromium')).sort().reverse();
    } catch {
      continue;
    }
    for (const e of entries) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome']) {
        list.push(path.join(root, e, rel));
      }
      list.push(path.join(root, e));
    }
  }
  list.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return list.filter((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

/** Launch Chromium (Playwright). Throws a Thai RenderError when it cannot start. */
export async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (err) {
    throw new RenderError(
      'ไม่พบ Playwright/Chromium สำหรับวาดภาพและคำบรรยาย — กรุณาติดตั้งด้วย `npm i playwright && npx playwright install chromium` (หรือกำหนดตัวแปร NODE_PATH ให้หา playwright เจอ)',
      err,
    );
  }
  const args = ['--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars'];
  let firstErr;
  try {
    return await chromium.launch({ args });
  } catch (err) {
    firstErr = err;
  }
  for (const executablePath of chromiumCandidates()) {
    try {
      return await chromium.launch({ args, executablePath });
    } catch {
      /* try the next candidate */
    }
  }
  throw new RenderError(
    'เปิด Chromium ไม่สำเร็จ — กรุณาติดตั้งด้วย `npx playwright install chromium` หรือกำหนดตำแหน่งไฟล์ Chromium ในตัวแปร NITHAN_CHROMIUM',
    firstErr,
  );
}

/** Context for untrusted content: no JavaScript, no network. */
async function lockedContext(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
    offline: true,
    serviceWorkers: 'block',
  });
  await context.route('**/*', (route) => route.abort());
  return context;
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const THAI = /[฀-๿]/;

/**
 * SVG drawn through <img> cannot see page fonts, and there is no Thai system font.
 * If the art contains Thai text, embed the genre font so signs/labels don't become tofu boxes.
 */
export function embedFontInSvg(svg, font) {
  if (!font || !THAI.test(svg) || !/<text[\s>]/i.test(svg)) return svg;
  const css = fontFaceCss(font);
  if (!css) return svg;
  const style = `<style>${css}text,tspan,textPath{font-family:'${font}',sans-serif !important;}</style>`;
  return svg.replace(/<svg\b[^>]*>/i, (m) => m + style);
}

function placeholderSvg(scene, palette = []) {
  const a = /^#[0-9a-f]{3,8}$/i.test(palette[0] ?? '') ? palette[0] : '#2b2d42';
  const b = /^#[0-9a-f]{3,8}$/i.test(palette[1] ?? '') ? palette[1] : '#8d99ae';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#07070c"/></linearGradient>
<radialGradient id="r" cx="50%" cy="38%" r="55%"><stop offset="0" stop-color="${b}" stop-opacity=".55"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient></defs>
<rect width="1080" height="1920" fill="url(#g)"/><rect width="1080" height="1920" fill="url(#r)"/></svg>`;
}

/**
 * Rasterise every scene's art to frames/sNN.png (width×height px, cover-fit).
 * Art is untrusted: it is only ever loaded as an <img> data URL in a JS-less, offline context.
 * @returns {Promise<string[]>} frame paths relative to projectDir, in scene order
 */
export async function rasterizeScenes(browser, sb, projectDir, { width, height, font, onScene, concurrency = 3 }) {
  const dir = path.join(projectDir, 'frames');
  await fsp.mkdir(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  let manifest = {};
  try {
    manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  } catch {
    /* first render */
  }
  const context = await lockedContext(browser, width, height);
  const out = new Array(sb.scenes.length);
  let done = 0;
  let next = 0;
  const worker = async () => {
    const page = await context.newPage();
    while (next < sb.scenes.length) {
      const i = next++;
      const scene = sb.scenes[i];
      const rel = `frames/${scene.id}.png`;
      const dest = path.join(projectDir, rel);
      let data = null;
      let mime = 'image/svg+xml';
      if (scene.art) {
        const artPath = path.resolve(projectDir, scene.art);
        // art must stay inside the project directory
        if (artPath.startsWith(path.resolve(projectDir) + path.sep)) {
          try {
            data = await fsp.readFile(artPath);
            mime = MIME[path.extname(artPath).toLowerCase()] ?? 'image/svg+xml';
          } catch {
            data = null;
          }
        }
      }
      const hash = sha1(`${width}x${height}|${font}|${mime}|`) + sha1(data ?? `placeholder:${scene.id}:${(sb.palette || []).join()}`);
      if (manifest[scene.id] === hash && fs.existsSync(dest)) {
        out[i] = rel;
        onScene?.(scene, ++done);
        continue;
      }
      const draw = async (buf, type) => {
        const body = type === 'image/svg+xml' ? Buffer.from(embedFontInSvg(buf.toString('utf8'), font)) : buf;
        const html =
          `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0b0b14;overflow:hidden}` +
          `img{display:block;width:${width}px;height:${height}px;object-fit:cover}</style>` +
          `<img id="art" src="data:${type};base64,${body.toString('base64')}">`;
        await page.setContent(html, { waitUntil: 'load' });
        const ok = await page
          .locator('#art')
          .evaluate((img) => img.complete && img.naturalWidth > 0)
          .catch(() => true);
        if (!ok) throw new Error('image failed to decode');
        await page.screenshot({ path: dest, type: 'png' });
      };
      try {
        if (!data) throw new Error('no art');
        await draw(data, mime);
      } catch {
        await draw(Buffer.from(placeholderSvg(scene, sb.palette)), 'image/svg+xml');
      }
      manifest[scene.id] = data ? hash : null;
      out[i] = rel;
      onScene?.(scene, ++done);
    }
    await page.close();
  };
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, sb.scenes.length) }, worker));
  } finally {
    await context.close().catch(() => {});
  }
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return out;
}

/**
 * Draw HTML overlay items as transparent PNGs.
 * `stages` is HTML made of `<section class="stage" data-id="…">` blocks (1080×1920 each) that contain
 * one `.item` element; every item is screenshotted on its own and its position inside the stage returned.
 * @returns {Promise<Record<string,{file:string,x:number,y:number,w:number,h:number}>>}
 */
export async function renderOverlayItems(browser, { css, stages, ids, outDir, relDir, width, height, concurrency = 3 }) {
  await fsp.mkdir(outDir, { recursive: true });
  const context = await lockedContext(browser, width, height);
  const result = {};
  try {
    const html =
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}` +
      `.stage{position:relative;width:${width}px;height:${height}px;overflow:hidden}${css}</style>${stages}`;
    let next = 0;
    const worker = async () => {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      while (next < ids.length) {
        const id = ids[next++];
        const stage = page.locator(`.stage[data-id="${id}"]`);
        const item = stage.locator('.item');
        await item.scrollIntoViewIfNeeded();
        const [sb, ib] = await Promise.all([stage.boundingBox(), item.boundingBox()]);
        if (!sb || !ib) continue;
        const file = `${id}.png`;
        const png = await item.screenshot({ path: path.join(outDir, file), type: 'png', omitBackground: true });
        const x = Math.max(0, Math.round(ib.x - sb.x));
        const y = Math.max(0, Math.round(ib.y - sb.y));
        const w = png.readUInt32BE(16);
        const h = png.readUInt32BE(20);
        result[id] = { file: `${relDir}/${file}`, x, y, w, h };
      }
      await page.close();
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) || 1 }, worker));
  } finally {
    await context.close().catch(() => {});
  }
  return result;
}

/** Full-page screenshot of trusted HTML (poster). */
export async function screenshotHtml(browser, html, dest, { width, height, type = 'jpeg', quality = 88 }) {
  const context = await lockedContext(browser, width, height);
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: dest, type, ...(type === 'jpeg' ? { quality } : {}) });
  } finally {
    await context.close().catch(() => {});
  }
}
