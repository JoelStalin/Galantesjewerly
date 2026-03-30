#!/data/data/com.termux/files/usr/bin/sh
set -e

APP_DIR="${APP_DIR:-$HOME/galantesjewelry}"
LOG_FILE="${LOG_FILE:-$APP_DIR/server.log}"
STANDALONE_DIR="$APP_DIR/.next/standalone"

mkdir -p "$APP_DIR/data/blobs"
cd "$APP_DIR"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export APP_DATA_DIR="${APP_DATA_DIR:-$APP_DIR/data}"
export NEXT_DISABLE_IMAGE_OPTIMIZATION="${NEXT_DISABLE_IMAGE_OPTIMIZATION:-1}"

termux-wake-lock >/dev/null 2>&1 || true

if [ ! -f "$STANDALONE_DIR/server.js" ]; then
  echo "Standalone build not found at $STANDALONE_DIR/server.js"
  exit 1
fi

rm -rf "$STANDALONE_DIR/public" "$STANDALONE_DIR/.next/static"
cp -R "$APP_DIR/public" "$STANDALONE_DIR/public"
mkdir -p "$STANDALONE_DIR/.next"
cp -R "$APP_DIR/.next/static" "$STANDALONE_DIR/.next/static"

exec >>"$LOG_FILE" 2>&1
echo "[$(date -Iseconds)] Starting Galante's Jewelry service"
exec node "$STANDALONE_DIR/server.js"
