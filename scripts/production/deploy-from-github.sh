#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

TARGET_SHA="${1:-${GITHUB_SHA:-}}"
FORCE_REBUILD="${FORCE_REBUILD:-false}"

[ -n "$TARGET_SHA" ] || fail "Target SHA is required"

require_repo
ensure_prod_db
ensure_space /
ensure_tunnel_running



PREV_HEAD="$(git rev-parse HEAD)"
log "Fetching GitHub source"
git fetch origin main --tags
git fetch origin "$TARGET_SHA" || true

log "Checking out $TARGET_SHA"
git checkout --detach "$TARGET_SHA"

ensure_prod_db
CHANGES="$(git diff --name-only "$PREV_HEAD" "$TARGET_SHA" || true)"

needs_web=false
needs_odoo=false
needs_nginx=false

if [ "$FORCE_REBUILD" = "true" ]; then
  needs_web=true
  needs_odoo=true
fi

if printf '%s\n' "$CHANGES" | grep -qE '^(app|components|lib|src|public|server|context|controllers|package.json|package-lock.json|Dockerfile|next.config|postcss.config|tsconfig|proxy.ts)'; then
  needs_web=true
fi

if printf '%s\n' "$CHANGES" | grep -qE '^(odoo|docker-compose.production.yml)'; then
  needs_odoo=true
fi

if printf '%s\n' "$CHANGES" | grep -qE '^(infra/nginx/|docker-compose.production.yml)'; then
  needs_nginx=true
fi

log "Verifying critical CMS/product images are durable in Odoo"
"$SCRIPT_DIR/verify-image-durability.sh"

if [ "$needs_web" = "true" ]; then
  log "Building web image"
  compose build web
  log "Recreating web only"
  compose up -d --no-deps web
fi

if [ "$needs_odoo" = "true" ]; then
  log "Updating Odoo addon in $PRODUCTION_DB"
  POSTGRES_PASSWORD="$(awk -F= '$1 == "POSTGRES_PASSWORD" {print substr($0, length($1) + 2)}' .env.gcp | tail -n 1)"
  [ -n "$POSTGRES_PASSWORD" ] || fail "POSTGRES_PASSWORD is required for Odoo addon update"
  compose exec -T odoo odoo -c /etc/odoo/odoo.conf -d "$PRODUCTION_DB" -u galantes_jewelry --stop-after-init --no-http --db_password "$POSTGRES_PASSWORD"
  compose up -d --no-deps odoo
fi

if [ "$needs_nginx" = "true" ]; then
  log "Validating and recreating Nginx for versioned routing changes"
  compose run --rm --no-deps nginx nginx -t
  compose up -d --no-deps nginx
fi

ensure_tunnel_running

"$SCRIPT_DIR/postdeploy-validate.sh"
"$SCRIPT_DIR/rotate-backups.sh"

docker_cmd builder prune -af --filter until=72h || true
docker_cmd image prune -af --filter until=168h || true

log "Production deploy complete for $TARGET_SHA"
