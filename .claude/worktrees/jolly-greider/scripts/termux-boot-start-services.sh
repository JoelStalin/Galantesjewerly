#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock >/dev/null 2>&1 || true

if [ -f /data/data/com.termux/files/usr/etc/profile.d/start-services.sh ]; then
  . /data/data/com.termux/files/usr/etc/profile.d/start-services.sh
fi

if command -v sv >/dev/null 2>&1; then
  sv up sshd >/dev/null 2>&1 || true
  sv up galantesjewelry >/dev/null 2>&1 || true
  sv up cloudflared >/dev/null 2>&1 || true
fi
