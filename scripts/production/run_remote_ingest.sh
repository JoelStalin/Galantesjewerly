#!/bin/bash
set -e
cd /home/yoeli/galantesjewelry
git fetch origin feature/publish-cleanup-images
git checkout -f feature/publish-cleanup-images

if [ -f /tmp/base64-chunks.zip ]; then
  echo "Unzipping /tmp/base64-chunks.zip..."
  mkdir -p /tmp/base64-chunks
  unzip -q -o /tmp/base64-chunks.zip -d /tmp/
  echo "Copying base64-chunks to galantes_odoo container..."
  sudo docker exec galantes_odoo mkdir -p /tmp/base64-chunks
  sudo docker cp /tmp/base64-chunks/. galantes_odoo:/tmp/base64-chunks/
fi

PASS=$(sudo grep ^POSTGRES_PASSWORD= .env.gcp | cut -d= -f2 | tr -d '\r')
echo "Ingesting 100% real Base64 image data via Odoo ORM shell..."
sudo docker exec -i galantes_odoo odoo shell -d galantes_prod --no-http --db_password "$PASS" < scripts/production/ingest_catalog_direct.py
echo "Ingestion finished!"
