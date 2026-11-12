@echo off
chcp 65001 >nul
title NiThan Studio
cd /d "%~dp0\.."
where node >nul 2>nul || (echo ยังไม่ได้ติดตั้ง Node.js  ดาวน์โหลดที่ https://nodejs.org แล้วลองใหม่ & pause & exit /b 1)
if not exist node_modules (echo กำลังติดตั้งครั้งแรก... & call npm install --omit=optional)
node bin\nithan.js studio --open
pause
