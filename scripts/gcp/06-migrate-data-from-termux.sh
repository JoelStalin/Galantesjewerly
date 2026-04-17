#!/usr/bin/env bash
# =========================================================================
# 06-migrate-data-from-termux.sh
# =========================================================================
# El handoff (2026-04-16) indica que SSH a ssh.galantesjewelry.com daba
# timeout. Este script soporta TRES estrategias de migracion:
#
#   A) SSH directo a Termux (si funciona hoy)
#      TERMUX_SSH_HOST, TERMUX_SSH_USER, TERMUX_SSH_PORT deben estar en
#      .env.gcp. Hace pg_dump remoto y tar del /data/blobs, los baja por
#      scp, y los sube a la VM de GCP via gcloud scp.
#
#   B) Backup local previo
#      Si ya tienes un archivo .sql (o .dump) y un tar.gz con /data/blobs
#      en tu PC, pasa sus paths con --sql-dump y --data-tar y los sube.
#
#   C) Fresh start (base vacia)
#      --fresh deja Odoo iniciarse con DB nueva y data/ vacio.
#
# Uso:
#   ./06-migrate-data-from-termux.sh --mode ssh
#   ./06-migrate-data-from-termux.sh --mode local --sql-dump ./backup.sql --data-tar ./blobs.tgz
#   ./06-migrate-data-from-termux.sh --mode fresh
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_PROJECT_ID GCP_ZONE GCP_VM_NAME GCP_VM_REPO_DIR ODOO_DB POSTGRES_USER

MODE="ssh"
SQL_DUMP=""
DATA_TAR=""

while [ $# -gt 0 ]; do
    case "$1" in
        --mode)       MODE="$2"; shift 2 ;;
        --sql-dump)   SQL_DUMP="$2"; shift 2 ;;
        --data-tar)   DATA_TAR="$2"; shift 2 ;;
        -h|--help)
            sed -n '1,30p' "$0"; exit 0 ;;
        *) die "Flag desconocida: $1" ;;
    esac
done

log_step "Migracion de datos (modo=$MODE)"

# ---- Modo A: SSH a Termux ----
migrate_via_ssh() {
    require_vars TERMUX_SSH_HOST TERMUX_SSH_USER TERMUX_SSH_PORT \
                 TERMUX_ODOO_DB_DUMP_PATH TERMUX_DATA_BLOBS_PATH

    log_info "Probando SSH a $TERMUX_SSH_USER@$TERMUX_SSH_HOST:$TERMUX_SSH_PORT"
    if ! ssh -o BatchMode=yes -o ConnectTimeout=10 -p "$TERMUX_SSH_PORT" \
        "$TERMUX_SSH_USER@$TERMUX_SSH_HOST" "echo ok" >/dev/null 2>&1; then
        log_err "SSH a Termux fallo. Revisa:"
        log_err "  - Que el tunnel Cloudflare a Termux este activo"
        log_err "  - Que el puerto Termux SSH este abierto"
        log_err "  - Que tu clave este en Termux ~/.ssh/authorized_keys"
        die "No se pudo conectar a Termux. Usa --mode local con backup previo."
    fi
    log_ok "SSH a Termux funciona"

    SQL_LOCAL="$(mktemp -t galantes_dump_XXXX).sql"
    DATA_LOCAL="$(mktemp -t galantes_blobs_XXXX).tgz"

    log_info "Lanzando pg_dump remoto en Termux"
    ssh -p "$TERMUX_SSH_PORT" "$TERMUX_SSH_USER@$TERMUX_SSH_HOST" \
        "docker exec galantes_db pg_dump -U $POSTGRES_USER $ODOO_DB" > "$SQL_LOCAL" \
        || die "pg_dump remoto fallo"
    log_ok "pg_dump descargado: $(du -h "$SQL_LOCAL" | awk '{print $1}')"

    log_info "Empaquetando /data/blobs remoto"
    ssh -p "$TERMUX_SSH_PORT" "$TERMUX_SSH_USER@$TERMUX_SSH_HOST" \
        "tar -czf - -C '$(dirname "$TERMUX_DATA_BLOBS_PATH")' '$(basename "$TERMUX_DATA_BLOBS_PATH")'" \
        > "$DATA_LOCAL" || die "tar remoto fallo"
    log_ok "Blobs descargados: $(du -h "$DATA_LOCAL" | awk '{print $1}')"

    SQL_DUMP="$SQL_LOCAL"
    DATA_TAR="$DATA_LOCAL"
}

# ---- Modo B/C comparten upload ----
upload_and_restore() {
    local sql="$1"
    local blobs="$2"

    if [ -n "$sql" ] && [ -f "$sql" ]; then
        log_info "Subiendo SQL dump a VM ($(du -h "$sql" | awk '{print $1}'))"
        vm_scp_push "$sql" "/tmp/galantes_dump.sql"
    fi
    if [ -n "$blobs" ] && [ -f "$blobs" ]; then
        log_info "Subiendo blobs tar a VM ($(du -h "$blobs" | awk '{print $1}'))"
        vm_scp_push "$blobs" "/tmp/galantes_blobs.tgz"
    fi

    log_info "Parando stack antes de restaurar"
    vm_ssh "cd '$GCP_VM_REPO_DIR' && docker compose --env-file .env.gcp -f docker-compose.gcp.yml stop web odoo || true"

    if [ -n "$sql" ] && [ -f "$sql" ]; then
        log_info "Restaurando DB dentro del container postgres"
        vm_ssh "set -e; \
            cd '$GCP_VM_REPO_DIR'; \
            docker compose --env-file .env.gcp -f docker-compose.gcp.yml up -d postgres; \
            sleep 10; \
            docker exec -i galantes_db psql -U '$POSTGRES_USER' -d postgres -c \"DROP DATABASE IF EXISTS $ODOO_DB WITH (FORCE);\" || true; \
            docker exec -i galantes_db psql -U '$POSTGRES_USER' -d postgres -c \"CREATE DATABASE $ODOO_DB OWNER $POSTGRES_USER;\"; \
            cat /tmp/galantes_dump.sql | docker exec -i galantes_db psql -U '$POSTGRES_USER' -d $ODOO_DB; \
            rm -f /tmp/galantes_dump.sql"
        log_ok "DB $ODOO_DB restaurada"
    fi

    if [ -n "$blobs" ] && [ -f "$blobs" ]; then
        log_info "Extrayendo blobs en $GCP_VM_REPO_DIR/data"
        vm_ssh "set -e; \
            mkdir -p '$GCP_VM_REPO_DIR/data'; \
            tar -xzf /tmp/galantes_blobs.tgz -C '$GCP_VM_REPO_DIR/data' --strip-components=1 || \
            tar -xzf /tmp/galantes_blobs.tgz -C '$GCP_VM_REPO_DIR'; \
            rm -f /tmp/galantes_blobs.tgz"
        log_ok "Blobs extraidos"
    fi

    log_info "Reiniciando stack"
    vm_ssh "cd '$GCP_VM_REPO_DIR' && docker compose --env-file .env.gcp -f docker-compose.gcp.yml up -d"
}

case "$MODE" in
    ssh)
        migrate_via_ssh
        upload_and_restore "$SQL_DUMP" "$DATA_TAR"
        rm -f "$SQL_DUMP" "$DATA_TAR"
        ;;
    local)
        [ -n "$SQL_DUMP" ] || die "--mode local requiere --sql-dump <path>"
        [ -f "$SQL_DUMP" ] || die "SQL dump no encontrado: $SQL_DUMP"
        if [ -n "$DATA_TAR" ] && [ ! -f "$DATA_TAR" ]; then
            die "Data tar no encontrado: $DATA_TAR"
        fi
        upload_and_restore "$SQL_DUMP" "$DATA_TAR"
        ;;
    fresh)
        log_warn "Modo fresh: Odoo se iniciara con DB vacia (ODOO_AUTO_INSTALL_MODULES=true)."
        vm_ssh "cd '$GCP_VM_REPO_DIR' && docker compose --env-file .env.gcp -f docker-compose.gcp.yml up -d"
        ;;
    *) die "Modo desconocido: $MODE" ;;
esac

log_ok "Migracion completada (modo=$MODE)"
log_info "Siguiente: scripts/gcp/07-validate.sh"
