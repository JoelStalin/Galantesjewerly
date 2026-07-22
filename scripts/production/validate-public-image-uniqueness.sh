#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_repo
ACTIVE_WEB="galantes_web_v4"
if ! docker_cmd inspect "$ACTIVE_WEB" >/dev/null 2>&1; then ACTIVE_WEB="galantes_web"; fi
PRODUCTION_DB="$(docker_cmd inspect "$ACTIVE_WEB" --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '/^ODOO_DB=/{print $2; exit}' | tr -d '\r')"
test -n "$PRODUCTION_DB"

# Fail closed when the public Odoo image endpoint serves one shared fallback
# for multiple catalog products. This protects both primary images and future
# gallery work from silently publishing a broken catalog.
BASE_URL="${ODOO_PUBLIC_IMAGE_BASE_URL:-https://odoo.galantesjewelry.com}"
ids="$(compose exec -T db psql -U odoo -d "$PRODUCTION_DB" -Atc \
  "select id from product_template where type <> 'service' and active = true and sale_ok = true and available_on_website = true order by id limit 25;")"

declare -A hashes=()
checked=0
for id in $ids; do
  body="$(mktemp)"
  trap 'rm -f "$body"' RETURN
  if ! curl -fsSL --max-time 30 "$BASE_URL/web/image/product.template/$id/image_1920" -o "$body"; then
    fail "Public primary image request failed for product $id"
  fi
  hash="$(sha256sum "$body" | awk '{print $1}')"
  hashes["$hash"]+=" $id"
  checked=$((checked + 1))
done

if (( checked >= 2 && ${#hashes[@]} < 2 )); then
  fail "All $checked public product images have the same bytes; refusing deployment"
fi

log_info "Public image uniqueness gate passed: $checked products, ${#hashes[@]} distinct primary images"
