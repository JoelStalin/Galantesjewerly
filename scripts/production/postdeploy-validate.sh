#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_repo
ensure_prod_db
ensure_tunnel_running

EVIDENCE_DIR="${EVIDENCE_DIR:-docs/deployment/evidence}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$EVIDENCE_DIR/postdeploy-$TS.md"
mkdir -p "$EVIDENCE_DIR"

check_http() {
  local url="$1"
  local label="$2"
  local code
  code="$(curl -k -L -sS -o /tmp/galantes-check-body -w '%{http_code}' --max-time 30 "$url" || true)"
  printf '%s %s %s\n' "$label" "$code" "$url"
  [ "$code" = "200" ] || return 1
}

{
  echo "# Galantes Postdeploy Evidence"
  echo
  echo "- Generated: $TS"
  echo "- Commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo
  echo "## Compose"
  echo '```text'
  compose ps
  echo '```'
  echo
  echo "## HTTP"
  echo '```text'
  check_http "https://galantesjewelry.com/api/health" "public-health" || true
  check_http "https://galantesjewelry.com/shop" "public-shop" || true
  if compose exec -T odoo python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8069/web/login', timeout=10)" >/dev/null 2>&1; then
    printf '%s %s %s\n' "internal-odoo" "200" "http://127.0.0.1:8069/web/login"
  else
    printf '%s %s %s\n' "internal-odoo" "FAIL" "http://127.0.0.1:8069/web/login"
  fi
  echo '```'
  echo
  echo "## Product Image Sample"
  echo '```text'
  compose exec -T db psql -U odoo -d "$PRODUCTION_DB" -Atc "select id from product_template where type <> 'service' and active = true and sale_ok = true and available_on_website = true order by id limit 3;" | while read -r product_id; do
    [ -n "$product_id" ] || continue
    curl -k -L -sS -o "/tmp/product-${product_id}.img" -w "product ${product_id}: http=%{http_code} bytes=%{size_download} content_type=%{content_type}\n" --max-time 30 "https://galantesjewelry.com/api/products/image?id=${product_id}" || true
  done
  echo '```'
  echo
  echo "## Product Counts"
  echo '```text'
  compose exec -T db psql -U odoo -d "$PRODUCTION_DB" -c "select count(*) as website_visible_non_service from product_template where type <> 'service' and active = true and sale_ok = true and available_on_website = true; select count(*) as gallery_rows from galantes_product_gallery;"
  echo '```'
} > "$OUT_FILE"

if grep -q 'public-health 200' "$OUT_FILE" && grep -q 'public-shop 200' "$OUT_FILE" && grep -q 'internal-odoo 200' "$OUT_FILE"; then
  log "Postdeploy validation written: $OUT_FILE"
else
  cat "$OUT_FILE"
  fail "Postdeploy validation failed"
fi
