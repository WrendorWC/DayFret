#!/bin/bash
# DayFret preview server — run by launchd, auto-starts at login.
# Logs go to /tmp/dayfret.log

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Auto-build dist/ if it's missing (e.g. first run after a fresh clone)
if [ ! -d "dist" ]; then
  echo "[dayfret] dist/ not found — building..." >&2
  npm run build
fi

# Hand control to vite preview (exec replaces this shell so launchd tracks it correctly)
exec npm run preview
