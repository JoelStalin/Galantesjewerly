#!/bin/bash
set -e

APP_DIR="$HOME/galantesjewelry"
DATA_DIR="$APP_DIR/data"
BLOBS_DIR="$DATA_DIR/blobs"

echo "Starting Termux deployment refresh..."

pkill -f "node server.js" || true

mkdir -p "$APP_DIR" "$DATA_DIR" "$BLOBS_DIR"

if [ -d "$DATA_DIR" ]; then
  backup_dir="$HOME/galantes_data_backup_$(date +%Y%m%d_%H%M%S)"
  echo "Backing up persistent data to $backup_dir"
  cp -r "$DATA_DIR" "$backup_dir"
fi

echo "Cleaning old application files while preserving /data..."
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'data' -exec rm -rf {} +

if [ -f "$HOME/standalone.tar.gz" ]; then
  echo "Extracting standalone bundle..."
  tar -xzf "$HOME/standalone.tar.gz" -C "$APP_DIR"
  rm "$HOME/standalone.tar.gz"
fi

mkdir -p "$BLOBS_DIR"
chmod -R 775 "$DATA_DIR"

cd "$APP_DIR"
if [ ! -f "server.js" ]; then
  echo "server.js not found after extraction."
  exit 1
fi

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export APP_DATA_DIR="${APP_DATA_DIR:-$DATA_DIR}"
nohup node server.js > server.log 2>&1 &

echo "Deployment complete. Check server.log for details."
