#!/bin/bash
# deploy_remote.sh
# Push current repository state to remote server via SSH using rsync.
# Note: Ensure you have loaded .env locally before running, or pass variables.

set -e

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

HOST=${REMOTE_HOST:-"0.0.0.0"}
PORT=${REMOTE_PORT:-"22"}
USER=${REMOTE_USER:-"ubuntu"}
APP_DIR=${REMOTE_APP_DIR:-"/var/www/galantesjewelry"}

echo "Deploying to $USER@$HOST:$PORT in directory $APP_DIR..."

# Sync files (excluding node_modules, git, and build outputs)
rsync -avz --delete \
  -e "ssh -p $PORT" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'tmp_app' \
  ./ $USER@$HOST:$APP_DIR/

echo "Sync complete. Run bootstrap_remote.sh on the server."
