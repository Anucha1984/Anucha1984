#!/usr/bin/env bash
# Usage: GEMINI_API_KEY=... ./build.sh episodes/<slug>   -> videos/<slug>.mp4
set -euo pipefail
cd "$(dirname "$0")"; EP="${1:?episode dir}"; SLUG="$(basename "$EP")"; W="out/$SLUG"
[ -d node_modules ] || npm install --silent
mkdir -p "$W" videos; cp template/* "$W/"; cp "$EP/scenes.js" "$W/"; ln -sfn "$PWD/node_modules" "$W/node_modules"
printf 'window.STYLE_SEED="%s";%s\n' "$SLUG" "${PRESET:+window.STYLE_PRESET=\"$PRESET\";}" > "$W/style.js"
cd "$W"; python3 tts.py; TEMPO="${TEMPO:-0.95}" python3 assemble.py | head -1; node render.js | tail -1
ffmpeg -v error -y -i video.mp4 -i audio.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v copy -c:a aac -b:a 192k -shortest "../../videos/$SLUG.mp4"
ffmpeg -v error -y -i "../../videos/$SLUG.mp4" -vf "fps=1/3.5,scale=240:-1,tile=10x3" -frames:v 1 check.jpg
echo "done: videos/$SLUG.mp4 (inspect $W/check.jpg before delivering)"
