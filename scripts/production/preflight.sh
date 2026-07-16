#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_repo
ensure_prod_db

log "Running safe Docker cache cleanup before space validation"
docker builder prune -af --filter "until=72h" >/dev/null 2>&1 || true
docker image prune -af --filter "until=72h" >/dev/null 2>&1 || true

ensure_space /

log "Validating Docker Compose config"
compose config >/tmp/galantes-compose-config.yml

log "Validating required containers"
for service in db odoo web nginx cloudflared; do
  compose ps "$service" >/dev/null || fail "Compose service not found: $service"
done

ensure_tunnel_running

log "Checking current service health"
compose ps

if ! compose exec -T web wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  fail "Current web health check failed before deploy"
fi

if ! compose exec -T odoo python3 - <<'PY' >/dev/null 2>&1
import urllib.request
urllib.request.urlopen("http://127.0.0.1:8069/web/login", timeout=10)
PY
then
  fail "Current Odoo health check failed before deploy"
fi

log "Checking image durability in Odoo"
if ! "$SCRIPT_DIR/verify-image-durability.sh"; then
  fail "Odoo image durability check failed. Run the Restore Production Images workflow before deploying."
fi

log "Preflight OK"
