#!/bin/bash
set -e
cd /home/yoeli/galantesjewelry
git fetch origin feature/publish-cleanup-images
git checkout -f feature/publish-cleanup-images
sudo docker cp /tmp/odoo-dry-run.json galantes_odoo:/tmp/odoo-dry-run.json
PASS=$(sudo grep ^POSTGRES_PASSWORD= .env.gcp | cut -d= -f2 | tr -d '\r')
sudo docker exec -i galantes_odoo odoo shell -d galantes_prod --no-http --db_password "$PASS" < scripts/production/ingest_catalog_direct.py
