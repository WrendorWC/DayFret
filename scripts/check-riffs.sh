#!/bin/bash
# Sweep the riff generator and check the rules every riff must keep.
#   ./scripts/check-riffs.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
npx esbuild src/music/riffs.ts --bundle --format=esm --outfile="$TMP/riffs.mjs" --log-level=error
npx esbuild src/music/scales.ts --bundle --format=esm --outfile="$TMP/scales.mjs" --log-level=error
node scripts/check-riffs.mjs "$TMP/riffs.mjs" "$TMP/scales.mjs"
status=$?
rm -rf "$TMP"
exit $status
