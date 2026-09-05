#!/bin/bash
# dayfret-ctl.sh — manage the DayFret background server
#
# Usage:
#   ./scripts/dayfret-ctl.sh install    — install LaunchAgent (auto-start at login)
#   ./scripts/dayfret-ctl.sh start      — start server now (without reinstalling)
#   ./scripts/dayfret-ctl.sh stop       — stop server
#   ./scripts/dayfret-ctl.sh restart    — stop + start
#   ./scripts/dayfret-ctl.sh status     — show whether server is running
#   ./scripts/dayfret-ctl.sh uninstall  — remove LaunchAgent entirely
#   ./scripts/dayfret-ctl.sh open       — open DayFret in its Dock web app

set -euo pipefail

LABEL="com.jonperry.dayfret"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_SCRIPT="$SCRIPT_DIR/server.sh"
PORT=5192
GUI_DOMAIN="gui/$(id -u)"

# ── helpers ──────────────────────────────────────────────────────────────────

is_loaded() {
  launchctl print "$GUI_DOMAIN/$LABEL" &>/dev/null
}

is_running() {
  lsof -i :$PORT -sTCP:LISTEN -t &>/dev/null
}

write_plist() {
  mkdir -p "$(dirname "$PLIST")"
  # Run npm directly with WorkingDirectory — avoids TCC restrictions on ~/Documents
  local npm_bin node_bin_dir
  npm_bin="$(command -v npm)"
  node_bin_dir="$(dirname "$npm_bin")"   # e.g. ~/.nvm/versions/node/vX/bin

  cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$npm_bin</string>
    <string>run</string>
    <string>preview</string>
  </array>

  <!-- Expose node to npm (nvm path not in launchd's default PATH) -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$node_bin_dir:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <!-- Run from the project directory -->
  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR</string>

  <!-- Start automatically at login -->
  <key>RunAtLoad</key>
  <true/>

  <!-- Restart automatically if the process exits -->
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/tmp/dayfret.log</string>

  <key>StandardErrorPath</key>
  <string>/tmp/dayfret-error.log</string>
</dict>
</plist>
EOF
  echo "  Wrote $PLIST"
}

# ── commands ─────────────────────────────────────────────────────────────────

cmd_install() {
  echo "Installing DayFret LaunchAgent..."
  chmod +x "$SERVER_SCRIPT"
  write_plist

  if is_loaded; then
    launchctl kickstart -k "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
    echo "  Agent reloaded."
  else
    launchctl bootstrap "$GUI_DOMAIN" "$PLIST"
    echo "  Agent installed and started."
  fi

  echo ""
  echo "DayFret will now start automatically at every login."
  echo "Logs: /tmp/dayfret.log  (errors: /tmp/dayfret-error.log)"
}

cmd_start() {
  if is_loaded; then
    launchctl kickstart "$GUI_DOMAIN/$LABEL"
    echo "DayFret server started."
  else
    echo "LaunchAgent not installed. Run:  ./scripts/dayfret-ctl.sh install"
    exit 1
  fi
}

cmd_stop() {
  if is_loaded; then
    launchctl kill TERM "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
    echo "DayFret server stopped."
  else
    echo "LaunchAgent is not loaded."
  fi
}

cmd_restart() {
  if is_loaded; then
    launchctl kickstart -k "$GUI_DOMAIN/$LABEL"
    echo "DayFret server restarted."
  else
    echo "LaunchAgent not installed. Run:  ./scripts/dayfret-ctl.sh install"
    exit 1
  fi
}

cmd_status() {
  if is_running; then
    echo "● DayFret is running on http://localhost:$PORT"
  else
    echo "○ DayFret server is not running."
  fi

  if is_loaded; then
    echo "  LaunchAgent: installed (auto-starts at login)"
  else
    echo "  LaunchAgent: not installed"
  fi
}

cmd_open() {
  if ! is_running; then
    echo "Server not running — waiting for it to start..."
    for i in {1..20}; do
      sleep 0.5
      is_running && break
    done
    if ! is_running; then
      echo "Server didn't start in time. Try: ./scripts/dayfret-ctl.sh restart"
      exit 1
    fi
  fi

  # Open the Safari web app if present, otherwise fall back to URL
  if [ -e "$HOME/Applications/DayFret.app" ]; then
    open "$HOME/Applications/DayFret.app"
  else
    open "http://localhost:$PORT"
  fi
}

cmd_uninstall() {
  if is_loaded; then
    launchctl bootout "$GUI_DOMAIN" "$PLIST" 2>/dev/null || true
  fi
  [ -f "$PLIST" ] && rm "$PLIST" && echo "Removed $PLIST"
  echo "DayFret LaunchAgent uninstalled."
}

# ── dispatch ──────────────────────────────────────────────────────────────────

case "${1:-status}" in
  install)   cmd_install   ;;
  start)     cmd_start     ;;
  stop)      cmd_stop      ;;
  restart)   cmd_restart   ;;
  status)    cmd_status    ;;
  open)      cmd_open      ;;
  uninstall) cmd_uninstall ;;
  *)
    echo "Usage: $0 {install|start|stop|restart|status|open|uninstall}"
    exit 1
    ;;
esac
