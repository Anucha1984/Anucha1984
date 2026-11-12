#!/bin/bash
# Linux: run to open NiThan Studio in your browser
cd "$(dirname "$0")/.."
command -v node >/dev/null 2>&1 || { echo "ยังไม่ได้ติดตั้ง Node.js  ดาวน์โหลดที่ https://nodejs.org แล้วลองใหม่"; read -r; exit 1; }
[ -d node_modules ] || { echo "กำลังติดตั้งครั้งแรก..."; npm install --omit=optional; }
exec node bin/nithan.js studio --open
