#!/usr/bin/env bash
# Usage: brand/append_outro.sh videos/004-claude-fable-52.mp4 [logo.png] [shout.mp3]
# Renders the 3.2 s logo end card (logo pop + shout) and appends it to the clip -> <name>-outro.mp4 (original kept).
set -euo pipefail
cd "$(dirname "$0")"
IN="$(realpath "${1:?input mp4}")"; LOGO="${2:-out/logo_noTone_3.png}"; SFX="${3:-sfx/saad_a_hoarse_uncle.mp3}"
OUT="${IN%.mp4}-outro.mp4"; TMP="$(mktemp -d)"
node render_outro.js "$LOGO" "$SFX" "$TMP/outro.mp4" >/dev/null
ffmpeg -v error -y -i "$IN" -i "$TMP/outro.mp4" -filter_complex \
 "[0:v]fps=30,format=yuv420p[v0];[1:v]fps=30,format=yuv420p[v1];[0:a]aresample=44100,aformat=channel_layouts=mono[a0];[1:a]aresample=44100,aformat=channel_layouts=mono[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
 -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -c:a aac -b:a 192k "$OUT"
rm -rf "$TMP"; echo "$OUT"
