#!/bin/bash
# bootstrap_remote.sh
# To be executed on the remote Samsung/Termux/Linux server after files are synced.

set -e

echo "Starting Galante's Jewelry remote bootstrap..."

if ! command -v docker &> /dev/null; then
    echo "WARNING: Docker could not be found."
    echo "Executing Fallback mode (NextJS Static Build)..."
    
    npm install
    npm run build
    
    echo "Build completed. Serve the 'out/' directory using a local web server like Nginx or http-server."
    exit 0
fi

echo "Docker detected. Building and starting containers..."
docker compose down || true
docker compose up -d --build

echo "Services started. Verify tunnel connection using: docker logs galantes_tunnel"
