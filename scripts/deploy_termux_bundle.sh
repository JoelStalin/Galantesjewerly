#!/data/data/com.termux/files/usr/bin/sh
set -e

PREFIX_PATH="${PREFIX:-/data/data/com.termux/files/usr}"
HOME_PATH="${HOME:-/data/data/com.termux/files/home}"
APP_DIR="${APP_DIR:-$HOME_PATH/galantesjewelry}"
BUNDLE_PATH="${BUNDLE_PATH:-$HOME_PATH/galantesjewelry_bundle.tar.gz}"
ENV_SOURCE="${ENV_SOURCE:-$HOME_PATH/galantesjewelry.env}"
STAGING_DIR="${STAGING_DIR:-$HOME_PATH/galantesjewelry_ci}"

if [ ! -f "$BUNDLE_PATH" ]; then
  echo "Deploy bundle not found at $BUNDLE_PATH"
  exit 1
fi

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR" "$APP_DIR/data/blobs"
tar -xzf "$BUNDLE_PATH" -C "$STAGING_DIR"

find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'data' -exec rm -rf {} +
cp -R "$STAGING_DIR"/. "$APP_DIR"/

if [ -f "$ENV_SOURCE" ]; then
  cp "$ENV_SOURCE" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

if [ ! -s "$APP_DIR/data/cms.json" ] && [ -f "$APP_DIR/data/cms_master.json" ]; then
  cp "$APP_DIR/data/cms_master.json" "$APP_DIR/data/cms.json"
fi

cd "$APP_DIR"
npm ci

if [ "$(node -p 'process.platform')" = "android" ]; then
  npm run build:android
else
  npm run build
fi

sh "$APP_DIR/scripts/install_termux_service.sh"

if [ -f "$PREFIX_PATH/etc/profile.d/start-services.sh" ]; then
  . "$PREFIX_PATH/etc/profile.d/start-services.sh"
fi

sv up sshd >/dev/null 2>&1 || true
sv up galantesjewelry >/dev/null 2>&1 || true
if [ -d "$PREFIX_PATH/var/service/cloudflared" ]; then
  sv up cloudflared >/dev/null 2>&1 || true
fi

sleep 2
curl -fsS http://127.0.0.1:3000/api/health

rm -rf "$STAGING_DIR"
rm -f "$BUNDLE_PATH"
