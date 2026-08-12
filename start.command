#!/bin/bash
# Double-click launcher (macOS): serves the game locally and opens the host panel.
# Only needed because some browsers block reading local JSON files from file:// pages.
cd "$(dirname "$0")"
PORT=8765
# Reuse the server if it's already running.
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  (python3 -m http.server $PORT >/dev/null 2>&1 &)
  sleep 1
fi
open "http://localhost:$PORT/index.html"
