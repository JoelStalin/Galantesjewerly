#!/bin/bash
set -euo pipefail

ROOT_DIR="/home/yoeli/galantesjewelry"
cd "$ROOT_DIR"

POSTGRES_PASSWORD="$(awk -F= '$1 == "POSTGRES_PASSWORD" {print substr($0, length($1) + 2)}' .env.gcp | tail -n 1 | tr -d '\r')"
if [ -z "$POSTGRES_PASSWORD" ]; then
  POSTGRES_PASSWORD="$(sudo docker inspect galantes_odoo --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '/^POSTGRES_PASSWORD=/{print $2; exit}' | tr -d '\r')"
fi

echo "Unpublishing legacy products from database galantes_prod..."
sudo docker exec -i galantes_odoo odoo shell -d galantes_prod --no-http --db_password "$POSTGRES_PASSWORD" << 'PYEOF'
products = self.env['product.template'].search([('available_on_website', '=', True)])
print(f"Found {len(products)} published products to unpublish.")
products.write({'available_on_website': False})
self.env.cr.commit()
print("Successfully unpublished legacy products in galantes_prod!")
PYEOF
