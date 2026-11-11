# NiThan Studio — internal contract

One command (`nithan "ปลาบู่ทอง"`) or one click in the studio turns a one-line idea into a
vertical 9:16 Thai-dubbed, Thai-captioned video. Claude writes the script **and draws every scene as SVG**.

```
idea ─► engine.generateStoryboard ─► engine.generateArt ─► render.renderVideo ─► video.mp4
        (Claude: Thai script JSON)    (Claude: 1 SVG/scene)  (Chromium raster + TTS + ffmpeg)
```

Node ≥ 20, ESM (`"type":"module"`), no build step, no TypeScript, minimal deps.

## Ownership (do not edit files outside your area)

| Area | Owner | Files |
|---|---|---|
| Contract | integrator | `package.json`, `docs/CONTRACT.md`, `src/shared/*`, `src/pipeline.js` |
| Engine | team A | `src/engine/**`, `bin/nithan.js`, `.claude/commands/**`, `test/engine*.test.js` |
| Renderer | team B | `src/render/**`, `test/render*.test.js` |
| Studio | team C | `src/server/**`, `web/**`, `test/server*.test.js` |

Need a new dependency or a change in a shared file? Do not edit `package.json`/shared files — report it in
your final message (you may `npm install --no-save --omit=optional <pkg>` to keep working).
Do not run `git add/commit/push`; the integrator commits.

## Data contract

`src/shared/schema.js` — `Storyboard`, `Scene`, `Line`, `Character`, `ProgressEvent` typedefs and
`validateStoryboard()`. `src/shared/presets.js` — `GENRES`, `STYLES`, `LENGTHS`, `VOICE_ROLES`, `resolveOptions()`.

Project directory (`output/<id>/`):

```
storyboard.json     the Storyboard (rewritten after each stage)
scenes/s01.svg      scene art, 1080×1920 viewBox (or .png/.jpg from another image provider)
frames/s01.png      (renderer) rasterised art
audio/s01-1.mp3     (renderer) one file per spoken line
captions/…          (renderer) caption overlays
video.mp4           final H.264 + AAC, 1080×1920, 30 fps
poster.jpg          cover frame with title/hook
subtitles.srt       Thai subtitles
```

## Module APIs

```js
// src/engine/index.js  (team A)
export async function generateStoryboard(opts, { onProgress }) // → Storyboard without id/art (pipeline sets id, validates)
export async function generateArt(sb, projectDir, { onProgress, model, concurrency, only }) // writes scenes/*.svg, sets scene.art
//   `only`: optional array of scene ids to (re)draw
//   onProgress({progress:0..1, message, detail:{sceneId, art}}) after each scene

// src/render/index.js  (team B)
export async function renderVideo(sb, projectDir, { tts, music, onProgress })
//   → { videoPath, posterPath, srtPath, durationSec, voiced }  (paths relative to projectDir)
//   onProgress({stage:'voice'|'render', progress:0..1 within that stage, message})
//   also fills line.audio/line.durationSec and scene.startSec/durationSec on sb

// src/pipeline.js  (integrator)
export async function createVideo(input, onProgress)   // → { projectDir, storyboard }
export async function renderProject(projectDir, input, onProgress) // re-render after edits
export async function loadStoryboard(projectDir) / saveStoryboard(sb, projectDir)
```

`onProgress` messages are Thai and user-facing. `opts.mock === true` (CLI `--mock`) skips Claude and uses
`src/shared/mock.js` (canned storyboard + simple SVGs) — use it to develop/test without the engine.

## Environment facts (this dev container)

- `claude` CLI is installed and authenticated: `claude -p --output-format json` works (≈5 s for a tiny prompt). `ANTHROPIC_API_KEY` is NOT set.
- `ffmpeg`/`ffprobe` are installed. Chromium + Playwright 1.63 are preinstalled globally:
  load with `createRequire(import.meta.url)('playwright')` (resolves via NODE_PATH); **never** run `playwright install` or `npm i playwright`.
  If `chromium.launch()` fails, retry with `executablePath:'/opt/pw-browsers/chromium'`-style fallback / env `NITHAN_CHROMIUM`.
- No Thai system fonts. Thai fonts are bundled via `@fontsource/{kanit,sarabun,charm,chakra-petch,mitr}`
  (`node_modules/@fontsource/kanit/files/kanit-thai-700-normal.woff2`, plus `-latin-` subsets).
- Network is restricted: npm registry works; TTS hosts (speech.platform.bing.com, translate.google.com) are **blocked here**,
  so TTS cannot be exercised in this container — it must degrade gracefully (timed captions + music bed, `voiced:false`).
