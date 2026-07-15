#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_repo
ensure_prod_db

OUT_DIR="${1:-docs/deployment/evidence}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/production-inventory-$TS.md"
mkdir -p "$OUT_DIR"

{
  echo "# Galantes Production Inventory"
  echo
  echo "- Generated: $TS"
  echo "- Repo: $REPO_DIR"
  echo "- Commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "- Odoo DB: $(env_value ODOO_DB)"
  echo
  echo "## Disk"
  echo '```text'
  df -h / /var/lib/docker 2>&1 || true
  echo '```'
  echo
  echo "## Docker System"
  echo '```text'
  docker_cmd system df 2>&1 || true
  echo '```'
  echo
  echo "## Compose Services"
  echo '```text'
  compose ps 2>&1 || true
  echo '```'
  echo
  echo "## Container Env Summary"
  echo '```text'
  docker_cmd inspect galantes_web_v4 --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^(NODE_ENV|ODOO_DB|ODOO_BASE_URL|APP_DATA_DIR)=' || true
  echo '```'
  echo
  echo "## Product Counts"
  echo '```text'
  compose exec -T db psql -U odoo -d "$PRODUCTION_DB" -c "select count(*) as product_templates from product_template; select count(*) as website_visible_non_service from product_template where type <> 'service' and active = true and sale_ok = true and available_on_website = true; select count(*) as gallery_rows from galantes_product_gallery;" 2>&1 || true
  echo '```'
  echo
  echo "## Tunnel Status"
  echo '```text'
  docker_cmd inspect -f 'name={{.Name}} status={{.State.Status}} restart={{.HostConfig.RestartPolicy.Name}} image={{.Config.Image}}' galantes_tunnel_prod 2>&1 || true
  echo '```'
} > "$OUT_FILE"

log "Inventory written: $OUT_FILE"
