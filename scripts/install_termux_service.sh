#!/data/data/com.termux/files/usr/bin/sh
set -e

PREFIX_PATH="${PREFIX:-/data/data/com.termux/files/usr}"
HOME_PATH="${HOME:-/data/data/com.termux/files/home}"
APP_DIR="${APP_DIR:-$HOME_PATH/galantesjewelry}"
SERVICE_DIR="$PREFIX_PATH/var/service/galantesjewelry"
TUNNEL_SERVICE_DIR="$PREFIX_PATH/var/service/cloudflared"
SSHD_SERVICE_DIR="$PREFIX_PATH/var/service/sshd"
BOOT_DIR="$HOME_PATH/.termux/boot"

if ! pkg list-installed 2>/dev/null | grep -q '^termux-services/'; then
  yes | pkg install termux-services
fi

if ! pkg list-installed 2>/dev/null | grep -q '^openssh/'; then
  yes | pkg install openssh
fi

if [ -f "$APP_DIR/.env" ] && grep -q '^CF_TUNNEL_TOKEN=' "$APP_DIR/.env" && ! command -v cloudflared >/dev/null 2>&1; then
  yes | pkg install cloudflared
fi

mkdir -p "$SERVICE_DIR" "$BOOT_DIR" "$APP_DIR/data/blobs"
cp "$APP_DIR/scripts/termux-service-run.sh" "$SERVICE_DIR/run"
chmod 700 "$SERVICE_DIR/run"

if [ -f "$APP_DIR/.env" ] && grep -q '^CF_TUNNEL_TOKEN=' "$APP_DIR/.env"; then
  mkdir -p "$TUNNEL_SERVICE_DIR"
  cp "$APP_DIR/scripts/termux-cloudflared-run.sh" "$TUNNEL_SERVICE_DIR/run"
  chmod 700 "$TUNNEL_SERVICE_DIR/run"
fi

cp "$APP_DIR/scripts/termux-boot-start-services.sh" "$BOOT_DIR/00-start-services"
chmod 700 "$BOOT_DIR/00-start-services"

if [ -f "$BOOT_DIR/start-galantes.sh" ]; then
  mv -f "$BOOT_DIR/start-galantes.sh" "$BOOT_DIR/start-galantes.sh.disabled"
fi

termux-wake-lock >/dev/null 2>&1 || true

if [ -f "$PREFIX_PATH/etc/profile.d/start-services.sh" ]; then
  . "$PREFIX_PATH/etc/profile.d/start-services.sh"
fi

if command -v sv >/dev/null 2>&1; then
  if [ -d "$SSHD_SERVICE_DIR" ]; then
    rm -f "$SSHD_SERVICE_DIR/down"
    sv up sshd >/dev/null 2>&1 || true
  fi
  sv up galantesjewelry >/dev/null 2>&1 || true
  if [ -d "$TUNNEL_SERVICE_DIR" ]; then
    sv up cloudflared >/dev/null 2>&1 || true
  fi
fi

TERMUX_INSTALLER="$(pm list packages -i 2>/dev/null | grep '^package:com.termux ' || true)"

if printf '%s' "$TERMUX_INSTALLER" | grep -q 'installer=com.android.vending'; then
  echo "Google Play Termux build detected. Boot support is integrated into the main Termux app; ~/.termux/boot/00-start-services is ready."
elif pm list packages | grep -q '^package:com.termux.boot$'; then
  echo "Termux:Boot detected."
else
  echo "Termux:Boot is not installed. Install the matching Termux:Boot add-on from the same source as Termux and open it once to activate boot scripts."
fi

if dumpsys deviceidle whitelist 2>/dev/null | grep -qi 'com.termux'; then
  echo "com.termux is already exempt from device idle restrictions."
else
  echo "com.termux is not whitelisted from device idle restrictions. Disable battery optimization for Termux in Android settings."
fi
