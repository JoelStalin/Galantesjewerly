#!/usr/bin/env bash

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/home/yoeli/galantesjewelry}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/yoeli/deploy-backups}"
PRODUCTION_DB="${PRODUCTION_DB:-galantes_prod}"
MIN_FREE_MB="${MIN_FREE_MB:-8192}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"
KEEP_BACKUP_HOURS="${KEEP_BACKUP_HOURS:-72}"

log() {
  printf '[galantes-prod] %s\n' "$*"
}

fail() {
  printf '[galantes-prod] ERROR: %s\n' "$*" >&2
  exit 1
}

require_repo() {
  [ -d "$REPO_DIR" ] || fail "Repo directory not found: $REPO_DIR"
  cd "$REPO_DIR"
  [ -f "$ENV_FILE" ] || fail "Missing $ENV_FILE in $REPO_DIR"
  [ -f "$COMPOSE_FILE" ] || fail "Missing $COMPOSE_FILE in $REPO_DIR"
}

docker_cmd() {
  if docker ps >/dev/null 2>&1; then
    docker "$@"
  else
    sudo -n docker "$@"
  fi
}

compose() {
  docker_cmd compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key {print substr($0, length(key) + 2)}' "$ENV_FILE" | tail -n 1
}

ensure_prod_db() {
  local db
  db="$(env_value ODOO_DB)"
  [ "$db" = "$PRODUCTION_DB" ] || fail "Refusing deploy: ODOO_DB is '$db', expected '$PRODUCTION_DB'"
}

ensure_space() {
  local mount="${1:-/}"
  local free_mb
  free_mb="$(df -Pm "$mount" | awk 'NR == 2 {print $4}')"
  [ "${free_mb:-0}" -ge "$MIN_FREE_MB" ] || fail "Only ${free_mb}MB free on $mount; require ${MIN_FREE_MB}MB"
}

ensure_tunnel_running() {
  local status
  status="$(docker_cmd inspect -f '{{.State.Status}}' galantes_tunnel_prod 2>/dev/null || true)"
  [ "$status" = "running" ] || fail "Cloudflare tunnel is not running (status: ${status:-missing})"
}

safe_backup_root() {
  local resolved
  mkdir -p "$BACKUP_ROOT"
  resolved="$(realpath "$BACKUP_ROOT")"
  [ "$resolved" = "/home/yoeli/deploy-backups" ] || fail "Unsafe BACKUP_ROOT: $resolved"
  printf '%s\n' "$resolved"
}

backup_manifest_checksum() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  else
    shasum -a 256 "$path" | awk '{print $1}'
  fi
}

