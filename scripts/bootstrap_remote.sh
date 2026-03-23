#!/bin/bash
set -e

echo "Starting Galante's Jewelry remote bootstrap..."

if ! command -v docker &> /dev/null; then
    echo "WARNING: Docker could not be found."
    echo "Executing fallback mode..."
    npm install
    npm run build
    echo "Build completed."
    exit 0
fi

docker compose down || true
docker compose up -d --build

echo "Services started."
echo "Check tunnel logs with: docker logs galantes_tunnel"
echo "Check nginx logs with: docker logs galantes_nginx"
