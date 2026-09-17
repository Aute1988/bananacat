#!/usr/bin/env bash
# 一次性脚本:把 SVG 转成 PNG(192 / 512)
# 依赖 ImageMagick (macOS: brew install imagemagick)

set -e
cd "$(dirname "$0")"

if command -v convert >/dev/null 2>&1; then
  convert icons/icon.svg -resize 192x192 icons/icon-192.png
  convert icons/icon.svg -resize 512x512 icons/icon-512.png
  echo "✅ Iconos generated via ImageMagick"
elif command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w 192 -h 192 icons/icon.svg -o icons/icon-192.png
  rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png
  echo "✅ Icons generated via rsvg-convert"
else
  echo "⚠️  No SVG→PNG tool found. Install ImageMagick or rsvg-convert"
  echo "   brew install imagemagick   # macOS"
  exit 1
fi

ls -lh icons/
