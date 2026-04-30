#!/bin/bash
set -e

echo "Galante's Jewelry: starting standalone runtime..."

ENTRYPOINT="server.js"
if [ ! -f "server.js" ] && [ -f "app/server.js" ]; then
  ENTRYPOINT="app/server.js"
fi

if [ ! -f "$ENTRYPOINT" ]; then
  echo "Standalone entrypoint not found. Run npm run build before starting."
  exit 1
fi

pkill -f "node ${ENTRYPOINT}" || true

mkdir -p data/blobs
chmod -R 775 data

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export APP_DATA_DIR="${APP_DATA_DIR:-$(pwd)/data}"

nohup node "$ENTRYPOINT" > server.log 2>&1 &

echo "Application started. Check server.log for runtime output."
