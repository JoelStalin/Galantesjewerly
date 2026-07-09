#!/bin/bash
set -e

echo "Galante's Jewelry: starting standalone runtime..."

pkill -f "node server.js" || true

mkdir -p data/blobs
chmod -R 775 data

if [ ! -f "server.js" ]; then
  echo "server.js not found. Extract or build the standalone bundle before running this script."
  exit 1
fi

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export APP_DATA_DIR="${APP_DATA_DIR:-$(pwd)/data}"

nohup node server.js > server.log 2>&1 &

echo "Application started. Check server.log for runtime output."
