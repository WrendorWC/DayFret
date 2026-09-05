#!/bin/bash
# DayFret — manual launcher (fallback if LaunchAgent isn't installed).
# For daily use, run:  ./scripts/dayfret-ctl.sh install
# Then DayFret starts automatically at login and you just click the Dock icon.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=5192

# Start server if it's not already running
if ! lsof -i :$PORT -sTCP:LISTEN -t &>/dev/null; then
  echo "Starting DayFret server..."

  # Auto-build if dist/ is missing
  if [ ! -d "dist" ]; then
    echo "Building first..."
    npm run build
  fi

  npm run preview &
  SERVER_PID=$!

  # Wait up to 5 seconds for it to be ready
  for i in {1..10}; do
    sleep 0.5
    curl -s "http://localhost:$PORT" > /dev/null 2>&1 && break
  done
else
  echo "Server already running."
fi

# Open the Safari web app if present, otherwise open in browser
if [ -e "$HOME/Applications/DayFret.app" ]; then
  open "$HOME/Applications/DayFret.app"
else
  open "http://localhost:$PORT"
fi

echo ""
echo "DayFret is running at http://localhost:$PORT"
echo "Press Ctrl+C (or close this window) to stop."
echo "(Tip: run ./scripts/dayfret-ctl.sh install to auto-start at login)"
echo ""

# If we started the server ourselves, wait for it
if [ -n "${SERVER_PID:-}" ]; then
  wait $SERVER_PID
fi
