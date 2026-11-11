# NiThan Studio (นิทาน สตูดิโอ)

สร้างวิดีโอแนวตั้ง 9:16 พากย์ไทย + ซับไทย ด้วย Claude ใน **คำสั่งเดียว**

```bash
nithan "ปลาบู่ทอง"
```

Claude เขียนบทภาษาไทย วาดภาพทุกฉากเป็น SVG ตามลายเส้นที่เลือก จากนั้นระบบพากย์เสียง ใส่ซับ
ใส่ดนตรีประกอบ และตัดต่อเป็น `video.mp4` พร้อมลง TikTok / Reels / Shorts

## แนวเรื่อง

| `--genre` | แนว | ตัวอย่าง |
|---|---|---|
| `cdrama` | ซีรีส์จีนแนวตั้ง — ดราม่า หักมุม จบค้างทุกตอน | `nithan "ประธานปลอมตัวเป็นไรเดอร์" --genre cdrama` |
| `ghost` | การ์ตูนผีเล่มละบาท — ผีไทย เวรกรรม หักมุมตอนจบ | `nithan "วินมอเตอร์ไซค์รับผู้โดยสารตีสอง" --genre ghost` |
| `folktale` | นิทานพื้นบ้านไทย — ปลาบู่ทอง หลวิชัยคาวี สังข์ทอง | `nithan "หลวิชัยคาวี" --genre folktale` |

## ลายเส้น (`--style`)

`pixar` (3D แอนิเมชัน) · `comic-us` (คอมิกอเมริกัน) · `china` (มังฮวาจีน) · `korea` (เว็บตูนเกาหลี) ·
`thai` (จิตรกรรมไทย) · `thai-retro` (การ์ตูนเล่มละบาท) · `anime` (อนิเมะญี่ปุ่น)

## ติดตั้ง

ต้องมี Node.js ≥ 20, `ffmpeg` และ Chromium (ผ่าน Playwright)

```bash
npm install
npx playwright install chromium   # ครั้งแรกครั้งเดียว
npm link                          # ให้เรียกคำสั่ง `nithan` ได้ทุกที่ (หรือใช้ `node bin/nithan.js`)
```

การเชื่อมต่อ Claude เลือกอัตโนมัติ:

1. ตั้ง `ANTHROPIC_API_KEY` → ใช้ Claude API โดยตรง
2. ไม่ได้ตั้ง → ใช้ Claude Code CLI (`claude -p`) ที่ล็อกอินไว้ในเครื่อง

## ใช้งาน

```bash
nithan "ปลาบู่ทอง" --genre folktale --style thai --length medium
nithan "ผีกระสือริมคลอง" --genre ghost --style thai-retro
nithan --continue output/<โปรเจกต์>      # สร้างตอนต่อไปของซีรีส์
nithan list                              # ดูแนวเรื่อง/ลายเส้นทั้งหมด
nithan studio                            # เปิดหน้าเว็บ Studio ที่ http://127.0.0.1:4173
```

ใน Claude Code ใช้ `/video ปลาบู่ทอง` ได้เลย

ผลลัพธ์อยู่ใน `output/<โปรเจกต์>/` — `video.mp4`, `poster.jpg`, `subtitles.srt`, `storyboard.json`, `scenes/*.svg`

## เสียงพากย์ไทย (`--tts`)

| ค่า | ผู้ให้บริการ | ต้องตั้งค่า |
|---|---|---|
| `edge` | Microsoft Edge voices (เปรมวดี / นิวัฒน์) ฟรี | ต้องต่อเน็ตได้ |
| `openai` | OpenAI TTS | `OPENAI_API_KEY` |
| `elevenlabs` | ElevenLabs multilingual | `ELEVENLABS_API_KEY` |
| `none` | ไม่พากย์ — ซับ + ดนตรีประกอบ | – |

ค่าเริ่มต้น `auto` เลือกตัวแรกที่ใช้ได้ ถ้าเรียกไม่สำเร็จจะได้วิดีโอแบบซับ + ดนตรีแทน (ไม่ล้ม)

## Studio (เว็บ UI)

`npm run studio` → พิมพ์ไอเดีย เลือกแนว เลือกลายเส้น กด **สร้างวิดีโอ** ดูภาพแต่ละฉากค่อย ๆ ขึ้นมาสด ๆ
แก้บทพากย์รายฉาก สั่งวาดใหม่ เรนเดอร์ใหม่ และกด **สร้างตอนต่อไป** สำหรับซีรีส์

## โครงสร้าง

```
bin/nithan.js      CLI (คำสั่งเดียว)
src/pipeline.js    idea → storyboard → art → voice → render
src/engine/        Claude: เขียนบท + วาด SVG
src/render/        Chromium rasterise + TTS + caption + ffmpeg
src/server/, web/  Studio
src/shared/        presets (แนว/ลายเส้น) + schema
docs/CONTRACT.md   สัญญาระหว่างโมดูล
```

เพิ่มแนวเรื่องหรือลายเส้นใหม่ได้ที่ `src/shared/presets.js`
