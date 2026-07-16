#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_repo
ensure_prod_db

POSTGRES_PASSWORD="$(awk -F= '$1 == "POSTGRES_PASSWORD" {print substr($0, length($1) + 2)}' "$ENV_FILE" | tail -n 1)"
[ -n "$POSTGRES_PASSWORD" ] || fail "POSTGRES_PASSWORD missing in $ENV_FILE"

docker_cmd cp scripts/odoo/verify_images_from_orm.py galantes_odoo:/tmp/verify_images_from_orm.py
compose exec -T odoo odoo shell -d "$PRODUCTION_DB" --no-http --db_password "$POSTGRES_PASSWORD" < scripts/odoo/verify_images_from_orm.py
