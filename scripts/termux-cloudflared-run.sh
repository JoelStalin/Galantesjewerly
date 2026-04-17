#!/data/data/com.termux/files/usr/bin/sh
set -e

APP_DIR="${APP_DIR:-$HOME/galantesjewelry}"
LOG_FILE="${LOG_FILE:-$HOME/cloudflared.log}"

if [ -f "$APP_DIR/.env" ]; then
  set -a
  . "$APP_DIR/.env"
  set +a
fi

if [ -z "$CF_TUNNEL_TOKEN" ]; then
  echo "CF_TUNNEL_TOKEN is missing in $APP_DIR/.env"
  exit 1
fi

termux-wake-lock >/dev/null 2>&1 || true

exec >>"$LOG_FILE" 2>&1
echo "[$(date -Iseconds)] Starting Cloudflare tunnel"
exec cloudflared tunnel run --token "$CF_TUNNEL_TOKEN"
