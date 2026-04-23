#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
BACKUP_DIR="${2:-}"
MODE="${3:-}"

if [ -z "$BACKUP_DIR" ]; then
  echo "usage: $0 <root-dir> <backup-dir>" >&2
  exit 1
fi

cd "$ROOT_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-postgres-data}"
ODOO_VOLUME="${ODOO_VOLUME:-odoo-data}"
DB_CONTAINER="${DB_CONTAINER:-galantes_db}"
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f "$COMPOSE_FILE")
DRY_RUN="${DRY_RUN:-0}"

if [ "$MODE" = "--dry-run" ]; then
  DRY_RUN=1
fi

run_cmd() {
  echo "[restore] $*"
  if [ "$DRY_RUN" = "1" ]; then
    return 0
  fi

  "$@"
}

run_bash() {
  echo "[restore] $*"
  if [ "$DRY_RUN" = "1" ]; then
    return 0
  fi

  bash -lc "$*"
}

wait_http() {
  local url="$1"
  local label="$2"
  local retries="${3:-24}"
  local delay="${4:-5}"

  for attempt in $(seq 1 "$retries"); do
    if curl -fsS --max-time 10 "$url" >/dev/null 2>&1; then
      echo "[restore] health ok: $label"
      return 0
    fi

    echo "[restore] waiting for $label ($attempt/$retries)"
    sleep "$delay"
  done

  echo "[restore] health failed: $label" >&2
  return 1
}

wait_pg() {
  local retries="${1:-24}"
  local delay="${2:-5}"

  for attempt in $(seq 1 "$retries"); do
    if docker exec "$DB_CONTAINER" sh -lc 'PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_isready -U odoo -d galantes_db' >/dev/null 2>&1; then
      echo "[restore] postgres ready"
      return 0
    fi

    echo "[restore] waiting for postgres ($attempt/$retries)"
    sleep "$delay"
  done

  echo "[restore] postgres did not become ready" >&2
  return 1
}

restore_named_volume() {
  local archive_name="$1"
  local volume_name="$2"
  local target_path="$3"
  local archive_path="$BACKUP_DIR/$archive_name"

  if [ ! -f "$archive_path" ]; then
    return 0
  fi

  run_cmd docker volume create "$volume_name" >/dev/null
  run_bash "docker run --rm -v ${volume_name}:${target_path} -v \"$BACKUP_DIR:/backup\" alpine:3.20 sh -lc 'rm -rf ${target_path%/}/* ${target_path%/}/.[!.]* ${target_path%/}/..?* 2>/dev/null || true; tar -xzf /backup/${archive_name} -C /'"
}

echo "[restore] restoring from $BACKUP_DIR"

if [ -f "$BACKUP_DIR/${ENV_FILE##*/}" ]; then
  run_cmd cp "$BACKUP_DIR/${ENV_FILE##*/}" "$ENV_FILE"
fi

if [ -f "$BACKUP_DIR/${COMPOSE_FILE##*/}" ]; then
  run_cmd cp "$BACKUP_DIR/${COMPOSE_FILE##*/}" "$COMPOSE_FILE"
fi

if [ -f "$BACKUP_DIR/nginx.conf" ]; then
  run_cmd mkdir -p infra/nginx
  run_cmd cp "$BACKUP_DIR/nginx.conf" infra/nginx/nginx.conf
fi

if [ -f "$BACKUP_DIR/git-head.txt" ]; then
  TARGET_COMMIT="$(tr -d '\r\n' < "$BACKUP_DIR/git-head.txt")"
  if [ -n "$TARGET_COMMIT" ]; then
    run_cmd git reset --hard "$TARGET_COMMIT"
  fi
fi

if [ -f "$BACKUP_DIR/app-data.tgz" ]; then
  run_cmd tar -xzf "$BACKUP_DIR/app-data.tgz" -C "$ROOT_DIR"
fi

if [ -f "$ENV_FILE" ] && [ -f "$COMPOSE_FILE" ]; then
  run_cmd docker compose "${COMPOSE_ARGS[@]}" down --remove-orphans
fi

restore_named_volume "postgres-data.tgz" "$POSTGRES_VOLUME" "/var/lib/postgresql/data"
restore_named_volume "odoo-data.tgz" "$ODOO_VOLUME" "/var/lib/odoo"

if [ -f "$ENV_FILE" ] && [ -f "$COMPOSE_FILE" ]; then
  run_cmd docker compose "${COMPOSE_ARGS[@]}" up -d --build db
  if [ "$DRY_RUN" != "1" ]; then
    wait_pg
  fi
  run_cmd docker compose "${COMPOSE_ARGS[@]}" up -d --build odoo web nginx cloudflared
fi

if [ -f "$BACKUP_DIR/galantes_db.sql" ] && [ ! -f "$BACKUP_DIR/postgres-data.tgz" ]; then
  run_bash "cat \"$BACKUP_DIR/galantes_db.sql\" | docker exec -i \"$DB_CONTAINER\" sh -lc 'PGPASSWORD=\"\${POSTGRES_PASSWORD:-}\" psql -U odoo -d galantes_db'"
fi

if [ "$DRY_RUN" != "1" ] && [ -f "$ENV_FILE" ] && [ -f "$COMPOSE_FILE" ]; then
  wait_http "http://127.0.0.1:3000/api/health" "web internal"
  wait_http "http://127.0.0.1:8080/healthz" "nginx internal"
  wait_http "http://127.0.0.1:8069/web/login" "odoo internal"
fi

echo "[restore] completed"
