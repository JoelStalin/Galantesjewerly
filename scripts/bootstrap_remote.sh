#!/bin/bash
set -e

echo "Starting Galante's Jewelry remote bootstrap..."

if command -v docker >/dev/null 2>&1; then
  docker compose down || true
  docker compose up -d --build
  echo "Docker services started."
  echo "Check tunnel logs with: docker logs galantes_tunnel"
  echo "Check nginx logs with: docker logs galantes_nginx"
  exit 0
fi

echo "Docker is not installed. Falling back to standalone Node runtime."
npm ci

if [ "$(node -p 'process.platform')" = "android" ]; then
  npm run build:android
  sh scripts/install_termux_service.sh
  echo "Android Termux service installed. Check server.log and sv status."
  exit 0
fi

npm run build
export APP_DATA_DIR="${APP_DATA_DIR:-$(pwd)/data}"
nohup npm run start > server.log 2>&1 &
echo "Standalone server started. Check server.log for details."
