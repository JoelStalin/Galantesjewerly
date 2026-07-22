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

check_image() {
  local url="$1"
  local label="$2"
  local min_bytes="${3:-500}"
  local out="/tmp/galantes-${label}.img"
  local result
  result="$(curl -k -L -sS -o "$out" -w 'http=%{http_code} bytes=%{size_download} content_type=%{content_type}' --max-time 30 "$url" || true)"
  printf '%s %s %s\n' "$label" "$result" "$url"
  local code bytes
  code="$(printf '%s\n' "$result" | sed -n 's/.*http=\([0-9][0-9][0-9]\).*/\1/p')"
  bytes="$(printf '%s\n' "$result" | sed -n 's/.*bytes=\([0-9][0-9]*\).*/\1/p')"
  [ "$code" = "200" ] || return 1
  [ "${bytes:-0}" -ge "$min_bytes" ] || return 1
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
  check_http "https://odoo.galantesjewelry.com/web/login" "public-odoo-login" || true
  check_image "https://galantesjewelry.com/api/image?id=image-1776959050826-portada.webp" "public-hero-image" 1000 || true
  check_image "https://galantesjewelry.com/api/image?id=image-1776722792843-logo.webp" "public-logo-image" 1000 || true
  check_image "https://galantesjewelry.com/api/image?id=favicon-1776722808533-favicon-32x32.png" "public-favicon-image" 500 || true
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
    check_image "https://galantesjewelry.com/api/products/image?id=${product_id}" "product-${product_id}" 500 || true
  done
  echo '```'
  echo
  echo "## Product Counts"
  echo '```text'
  compose exec -T db psql -U odoo -d "$PRODUCTION_DB" -c "select count(*) as website_visible_non_service from product_template where type <> 'service' and active = true and sale_ok = true and available_on_website = true; select count(*) as gallery_rows from galantes_product_gallery;"
  echo '```'
} > "$OUT_FILE"

if grep -q 'public-health 200' "$OUT_FILE" \
  && grep -q 'public-shop 200' "$OUT_FILE" \
  && grep -q 'public-odoo-login 200' "$OUT_FILE" \
  && grep -q 'internal-odoo 200' "$OUT_FILE" \
  && grep -q 'public-hero-image http=200' "$OUT_FILE" \
  && grep -q 'public-logo-image http=200' "$OUT_FILE" \
  && grep -q 'public-favicon-image http=200' "$OUT_FILE" \
  && grep -q 'product-.*http=200' "$OUT_FILE"; then
  log "Postdeploy validation written: $OUT_FILE"
else
  cat "$OUT_FILE"
  fail "Postdeploy validation failed"
fi
