#!/usr/bin/env bash
# generate-icons.sh
# Usage: ./scripts/generate-icons.sh /path/to/source.png
# Produces: icons/*.png and icons/icon.icns

set -euo pipefail
SRC="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ICONS_DIR="$ROOT_DIR/icons"
ICONSET_DIR="$ROOT_DIR/icons/icon.iconset"

if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "Usage: $0 /path/to/source.png"
  echo "Make sure the source is a square PNG (1024x1024 recommended)."
  exit 1
fi

mkdir -p "$ICONS_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# sizes required by macOS iconset
# name -> size
sizes=(
  "icon_16x16.png:16"
  "icon_16x16@2x.png:32"
  "icon_32x32.png:32"
  "icon_32x32@2x.png:64"
  "icon_128x128.png:128"
  "icon_128x128@2x.png:256"
  "icon_256x256.png:256"
  "icon_256x256@2x.png:512"
  "icon_512x512.png:512"
  "icon_512x512@2x.png:1024"
)

for entry in "${sizes[@]}"; do
  name="${entry%%:*}"
  px="${entry##*:}"
  out="$ICONSET_DIR/$name"
  sips -z "$px" "$px" "$SRC" --out "$out" >/dev/null
done

# also produce standalone PNGs in icons/ at common sizes
png_sizes=(1024 512 256 128 64 32)
for s in "${png_sizes[@]}"; do
  out="$ICONS_DIR/icon_${s}.png"
  sips -z "$s" "$s" "$SRC" --out "$out" >/dev/null
done

# generate icns
if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"
  echo "Created $ICONS_DIR/icon.icns"
else
  echo "iconutil not found. Skipping .icns creation. You can run on macOS: iconutil -c icns $ICONSET_DIR -o $ICONS_DIR/icon.icns"
fi

# cleanup iconset directory
rm -rf "$ICONSET_DIR"

echo "Generated icons in $ICONS_DIR"
