#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_repo
ensure_prod_db

ROOT="$(safe_backup_root)"
SHA="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$ROOT/$TS-$SHA"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log "Creating blocking predeploy backup: $BACKUP_DIR"

cp "$ENV_FILE" "$BACKUP_DIR/.env.prod"
chmod 600 "$BACKUP_DIR/.env.prod"
cp "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.production.yml"
git rev-parse HEAD > "$BACKUP_DIR/git-head.txt" 2>/dev/null || printf '%s\n' "$SHA" > "$BACKUP_DIR/git-head.txt"

POSTGRES_PASSWORD="$(env_value POSTGRES_PASSWORD)"
[ -n "$POSTGRES_PASSWORD" ] || fail "POSTGRES_PASSWORD missing in $ENV_FILE"

log "Backing up PostgreSQL database $PRODUCTION_DB"
compose exec -T db sh -lc "PGPASSWORD='$POSTGRES_PASSWORD' pg_dump -U odoo -Fc '$PRODUCTION_DB'" > "$BACKUP_DIR/$PRODUCTION_DB.dump"
[ -s "$BACKUP_DIR/$PRODUCTION_DB.dump" ] || fail "Database dump is empty"

log "Backing up app data directory"
if [ -d data ]; then
  tar -czf "$BACKUP_DIR/app-data.tgz" data
else
  tar -czf "$BACKUP_DIR/app-data.tgz" --files-from /dev/null
fi

log "Backing up Docker volume metadata and inspect output"
inspect_containers=(galantes_odoo galantes_db galantes_nginx galantes_tunnel_prod)
if docker_cmd inspect galantes_web >/dev/null 2>&1; then
  inspect_containers=(galantes_web "${inspect_containers[@]}")
elif docker_cmd inspect galantes_web_v4 >/dev/null 2>&1; then
  inspect_containers=(galantes_web_v4 "${inspect_containers[@]}")
fi
docker_cmd inspect "${inspect_containers[@]}" > "$BACKUP_DIR/docker-inspect.json"
compose config > "$BACKUP_DIR/docker-compose.resolved.yml"
docker_cmd volume ls > "$BACKUP_DIR/docker-volumes.txt"

backup_volume() {
  local volume_name="$1"
  local archive_name="$2"
  if docker_cmd volume inspect "$volume_name" >/dev/null 2>&1; then
    docker_cmd run --rm -v "${volume_name}:/volume:ro" -v "$BACKUP_DIR:/backup" alpine:3.20 \
      sh -lc "cd /volume && tar -czf /backup/${archive_name} ."
  else
    log "Volume missing, skipping: $volume_name"
  fi
}

backup_volume "galantesjewelry_postgres-data" "postgres-data.tgz"
backup_volume "galantesjewelry_odoo-data" "odoo-data.tgz"

MANIFEST="$BACKUP_DIR/backup.json"
{
  printf '{\n'
  printf '  "createdAt": "%s",\n' "$TS"
  printf '  "gitSha": "%s",\n' "$SHA"
  printf '  "database": "%s",\n' "$PRODUCTION_DB"
  printf '  "files": [\n'
  first=1
  for file in "$BACKUP_DIR"/* "$BACKUP_DIR"/.env.prod; do
    [ -f "$file" ] || continue
    name="$(basename "$file")"
    [ "$name" = "backup.json" ] && continue
    size="$(wc -c < "$file" | tr -d ' ')"
    checksum="$(backup_manifest_checksum "$file")"
    if [ "$first" -eq 0 ]; then printf ',\n'; fi
    first=0
    printf '    {"name": "%s", "bytes": %s, "sha256": "%s"}' "$name" "$size" "$checksum"
  done
  printf '\n  ]\n'
  printf '}\n'
} > "$MANIFEST"

log "Backup complete: $BACKUP_DIR"
