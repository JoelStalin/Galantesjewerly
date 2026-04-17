#!/bin/bash
set -e

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

HOST=${REMOTE_HOST:-"0.0.0.0"}
PORT=${REMOTE_PORT:-"22"}
USER=${REMOTE_USER:-"ubuntu"}
APP_DIR=${REMOTE_APP_DIR:-"/var/www/galantesjewelry"}

is_placeholder() {
  local value="$1"
  [[ -z "$value" || "$value" == "0.0.0.0" || "$value" == "your.server.ip" || "$value" == your_* || "$value" == change_me* ]]
}

if is_placeholder "$HOST"; then
  echo "REMOTE_HOST is not configured with a real remote host."
  exit 1
fi

if is_placeholder "$USER"; then
  echo "REMOTE_USER is not configured with a real remote user."
  exit 1
fi

echo "Deploying to $USER@$HOST:$PORT in directory $APP_DIR..."

rsync -avz --delete \
  -e "ssh -p $PORT" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'out' \
  ./ $USER@$HOST:$APP_DIR/

echo "Sync complete. Run bootstrap_remote.sh on the server."
