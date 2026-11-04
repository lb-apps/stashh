#!/usr/bin/env bash
#
# The fixed dev tunnel (ig-dev.stashh.me → localhost:3002) as a macOS LaunchAgent: it starts at
# login and comes back whenever it stops. A tunnel started from a terminal or an agent session dies
# with it, and the hooks relay then answers `/env dev` with "dev cannot take this channel right now".
#
#   scripts/dev-tunnel.sh install     write the LaunchAgent and start it
#   scripts/dev-tunnel.sh status      is it running, and does the relay's probe pass through it
#   scripts/dev-tunnel.sh uninstall   stop it and remove the LaunchAgent
#
# The token stays in ~/.cloudflared/stashh-dev.token (0600) and is read with --token-file, never
# written into the plist. docs/webhook-relay.md, "Dev tunnel".

set -euo pipefail

label=me.stashh.dev-tunnel
plist="$HOME/Library/LaunchAgents/$label.plist"
token_file="$HOME/.cloudflared/stashh-dev.token"
log="$HOME/Library/Logs/stashh/dev-tunnel.log"
domain="gui/$(id -u)"
port=3002
public_url=https://ig-dev.stashh.me

die() {
  echo "dev-tunnel: $*" >&2
  exit 1
}

probe() {
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$public_url/webhooks?relay=probe" || true)
  echo "  probe: $status (204 = /env dev works; 403 = HOOKS_RELAY_SECRET missing in instagram/.env)"
}

install() {
  local cloudflared
  cloudflared=$(command -v cloudflared) || die "cloudflared is not installed (brew install cloudflared)"
  [[ -s "$token_file" ]] || die "missing $token_file (cloudflared tunnel token stashh-dev > $token_file; chmod 600)"

  # A tunnel started by hand would run beside the agent's: two connectors are allowed, but only one is wanted.
  pkill -f "cloudflared.*tunnel.*run.*stashh-dev" 2>/dev/null || true

  mkdir -p "$(dirname "$plist")" "$(dirname "$log")"
  cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$cloudflared</string>
    <string>tunnel</string>
    <string>--no-autoupdate</string>
    <string>run</string>
    <string>--url</string>
    <string>http://localhost:$port</string>
    <string>--token-file</string>
    <string>$token_file</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$log</string>
  <key>StandardErrorPath</key>
  <string>$log</string>
</dict>
</plist>
EOF
  plutil -lint "$plist" >/dev/null

  launchctl bootout "$domain/$label" 2>/dev/null || true
  launchctl bootstrap "$domain" "$plist"
  echo "Installed $label; log: $log"
  sleep 5
  status
}

status() {
  if launchctl print "$domain/$label" >/dev/null 2>&1; then
    # The first state and pid are the job's own; nested sections repeat "state".
    launchctl print "$domain/$label" | awk '/^[[:space:]]*(state|pid) =/ && !seen[$1]++ { sub(/^[[:space:]]*/, "  "); print }'
  else
    echo "  $label is not installed (npm run tunnel:install)"
  fi
  if lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  instagram: listening on :$port"
  else
    echo "  instagram: nothing on :$port (npm run dev)"
  fi
  probe
}

uninstall() {
  launchctl bootout "$domain/$label" 2>/dev/null || true
  rm -f "$plist"
  echo "Removed $label"
}

case "${1:-}" in
  install) install ;;
  status) status ;;
  uninstall) uninstall ;;
  *) die "usage: $0 <install|status|uninstall>" ;;
esac
