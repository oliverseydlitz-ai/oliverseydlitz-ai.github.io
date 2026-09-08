#!/bin/sh
# Convenience wrapper for the per-task redesign check on this Windows box:
# sync the mirror, (re)start the local server, run render-scan with the
# system Chrome. See test/browser/README.md for the manual form.
set -e
DIR="$(dirname "$0")"
bash "$DIR/sync.sh"
if ! curl -s -o /dev/null "http://127.0.0.1:8766/index.html" 2>/dev/null; then
  ( cd "$DIR/site" && python -m http.server 8766 >/tmp/shotlab-srv.log 2>&1 & )
  sleep 2
fi
PW_CHROME="${PW_CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}" \
PW_URL="${PW_URL:-http://127.0.0.1:8766}" \
  node "$DIR/render-scan.js"
