#!/bin/bash
# Renders public/dayfret-icon.svg to the PNG sizes the app needs, using the
# Chrome already on this Mac (no extra dependencies).
#   ./scripts/icon/render.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
# Safari and iOS round the touch icon themselves, so that one is drawn as a
# full square: transparent corners would show up as black.
sed 's/rx="228"/rx="0"/g' public/dayfret-icon.svg > "$TMP/square.svg"
render() { # size outfile svg
  cat > "$TMP/r.html" <<HTML
<html><body style="margin:0;background:transparent"><img src="file://$3" width="$1" height="$1" style="display:block"></body></html>
HTML
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size="$1,$1" --screenshot="$2" "file://$TMP/r.html" 2>/dev/null
}
render 180 public/apple-touch-icon.png "$TMP/square.svg"
render 1024 scripts/icon/dayfret-icon-1024.png "$PWD/public/dayfret-icon.svg"
rm -rf "$TMP"
echo "Rendered public/apple-touch-icon.png and scripts/icon/dayfret-icon-1024.png"
