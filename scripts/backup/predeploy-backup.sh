#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
cd "$ROOT_DIR"

TIMESTAMP="${BACKUP_TIMESTAMP:-$(date +%Y%m%d_%H%M%S)}"
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-$ROOT_DIR/backups/predeploy}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
WEB_CONTAINER="${WEB_CONTAINER:-galantes_web_v4}"
ODOO_CONTAINER="${ODOO_CONTAINER:-galantes_odoo}"
DB_CONTAINER="${DB_CONTAINER:-galantes_db}"
NGINX_CONTAINER="${NGINX_CONTAINER:-galantes_nginx}"
TUNNEL_CONTAINER="${TUNNEL_CONTAINER:-galantes_tunnel_prod}"
SERVICE_CONTAINERS=(
  "$WEB_CONTAINER"
  "$ODOO_CONTAINER"
  "$DB_CONTAINER"
  "$NGINX_CONTAINER"
  "$TUNNEL_CONTAINER"
)

mkdir -p "$BACKUP_BASE_DIR"

BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "[backup] creating predeploy backup at $BACKUP_DIR"

if [ -d "Galantesjewelry/data" ]; then
  ROOT_APP_DATA_DIR="Galantesjewelry/data"
elif [ -d "data" ]; then
  ROOT_APP_DATA_DIR="data"
else
  ROOT_APP_DATA_DIR="Galantesjewelry/data"
fi

ROOT_APP_BLOBS_DIR="$ROOT_APP_DATA_DIR/blobs"

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKUP_DIR/${ENV_FILE##*/}"
fi

if [ -f "$COMPOSE_FILE" ]; then
  cp "$COMPOSE_FILE" "$BACKUP_DIR/${COMPOSE_FILE##*/}"
fi

if [ -f "infra/nginx/nginx.conf" ]; then
  cp "infra/nginx/nginx.conf" "$BACKUP_DIR/nginx.conf"
fi

git rev-parse HEAD > "$BACKUP_DIR/git-head.txt" 2>/dev/null || true
git status --short > "$BACKUP_DIR/git-status.txt" 2>/dev/null || true

if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' > "$BACKUP_DIR/docker-ps.txt" || true
  docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' > "$BACKUP_DIR/docker-images.txt" || true

  for container in "${SERVICE_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -Fxq "$container"; then
      docker inspect "$container" > "$BACKUP_DIR/${container}-inspect.json" || true
      docker logs --timestamps --tail 5000 "$container" > "$BACKUP_DIR/${container}.log" 2>&1 || true
    fi
  done

  if docker ps --format '{{.Names}}' | grep -Fxq "$DB_CONTAINER"; then
    if docker exec "$DB_CONTAINER" sh -lc 'command -v pg_dump >/dev/null 2>&1'; then
      docker exec "$DB_CONTAINER" sh -lc \
        "PGPASSWORD=\"\${POSTGRES_PASSWORD:-}\" pg_dump -U odoo -d galantes_db --no-owner --no-privileges --clean --if-exists" \
        > "$BACKUP_DIR/galantes_db.sql" || true
    fi

    docker run --rm \
      --volumes-from "$DB_CONTAINER" \
      -v "$BACKUP_DIR:/backup" \
      alpine:3.20 \
      sh -lc 'tar -czf /backup/postgres-data.tgz -C / var/lib/postgresql/data' || true
  fi

  if docker ps --format '{{.Names}}' | grep -Fxq "$ODOO_CONTAINER"; then
    docker run --rm \
      --volumes-from "$ODOO_CONTAINER" \
      -v "$BACKUP_DIR:/backup" \
      alpine:3.20 \
      sh -lc 'tar -czf /backup/odoo-data.tgz -C / var/lib/odoo' || true
  fi
fi

tar -czf "$BACKUP_DIR/app-data.tgz" \
  --ignore-failed-read \
  data \
  "$ROOT_APP_DATA_DIR" \
  odoo \
  infra/nginx \
  "$ENV_FILE" \
  "$COMPOSE_FILE" 2>/dev/null || true

if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN=""
fi

if [ -n "$PYTHON_BIN" ]; then
"$PYTHON_BIN" - <<'PY' > "$BACKUP_DIR/managed-images-manifest.json" || true
import json
from pathlib import Path

root = Path(".")
if (root / "Galantesjewelry" / "data").exists():
    data_root = root / "Galantesjewelry" / "data"
else:
    data_root = root / "data"
blobs_root = data_root / "blobs"
cms_path = data_root / "cms.json"
integrations_path = data_root / "integrations.json"

def safe_load_json(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

manifest = {
    "cms_path": str(cms_path).replace("\\", "/"),
    "integrations_path": str(integrations_path).replace("\\", "/"),
    "blobs_path": str(blobs_root).replace("\\", "/"),
    "blob_count": 0,
    "blob_files": [],
    "cms_urls": {},
    "integrations_exists": integrations_path.exists(),
}

if blobs_root.exists():
    files = sorted(p.name for p in blobs_root.iterdir() if p.is_file())
    manifest["blob_count"] = len(files)
    manifest["blob_files"] = files

cms = safe_load_json(cms_path) or {}
settings = cms.get("settings") or {}
sections = cms.get("sections") or []
featured_items = cms.get("featured_items") or []

manifest["cms_urls"] = {
    "favicon_url": settings.get("favicon_url"),
    "logo_url": settings.get("logo_url"),
    "hero_image_url": settings.get("hero_image_url"),
    "section_image_urls": [item.get("image_url") for item in sections if item.get("image_url")],
    "featured_image_urls": [item.get("image_url") for item in featured_items if item.get("image_url")],
}

print(json.dumps(manifest, indent=2, ensure_ascii=False))
PY
fi

ls -1dt "$BACKUP_BASE_DIR"/* 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -rf --

echo "[backup] done: $BACKUP_DIR"
