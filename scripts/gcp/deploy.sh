#!/usr/bin/env bash
# =========================================================================
# deploy.sh — Orquestador maestro de migracion a Google Cloud
# =========================================================================
# Corre la secuencia completa. Es idempotente: puedes ejecutarlo varias
# veces. Cada paso es independiente y tiene su propio script.
#
# Uso:
#   ./deploy.sh              # Full deploy (sin migrar datos)
#   ./deploy.sh --with-data  # Incluye migracion desde Termux
#   ./deploy.sh --fresh      # DB vacia (ideal para primer arranque sin datos)
#   ./deploy.sh --step 3     # Solo un paso concreto (1..7)
#   ./deploy.sh --skip-dns   # Omite paso de DNS (ya lo hiciste a mano)
#
# Orden por defecto:
#   1. 01-bootstrap-vm.sh
#   2. 02-push-to-vm.sh
#   3. 05-cutover-dns.sh (opcional con --skip-dns)
#   4. 04-start-stack.sh (bootstrap HTTP)
#   5. 03-issue-certs.sh
#   6. 04-start-stack.sh (re-apply con HTTPS)
#   7. 06-migrate-data-from-termux.sh (si --with-data o --fresh)
#   8. 07-validate.sh
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

WITH_DATA=0
FRESH=0
SKIP_DNS=0
STEP=""

while [ $# -gt 0 ]; do
    case "$1" in
        --with-data) WITH_DATA=1; shift ;;
        --fresh)     FRESH=1; shift ;;
        --skip-dns)  SKIP_DNS=1; shift ;;
        --step)      STEP="$2"; shift 2 ;;
        -h|--help)
            sed -n '1,30p' "$0"; exit 0 ;;
        *) die "Flag desconocida: $1" ;;
    esac
done

load_env

# Preflight: gcloud auth
log_step "Preflight"
if ! command -v gcloud >/dev/null 2>&1 && ! find_gcloud >/dev/null 2>&1; then
    die "gcloud CLI no encontrado. Instala: https://cloud.google.com/sdk/docs/install"
fi

ACCOUNT="$(gc auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
if [ -z "$ACCOUNT" ]; then
    log_warn "No hay sesion activa de gcloud. Corre: gcloud auth login"
    exit 1
fi
log_ok "Cuenta gcloud activa: $ACCOUNT"
log_ok "Proyecto: $GCP_PROJECT_ID"

# Validacion minima del .env.gcp
log_info "Validando .env.gcp (solo variables criticas)"
require_vars ADMIN_PASSWORD ADMIN_SECRET_KEY POSTGRES_PASSWORD ODOO_PASSWORD \
             META_SYNC_TOKEN LETSENCRYPT_EMAIL CF_API_TOKEN \
             GCP_VM_EXTERNAL_IP GCP_HOSTNAMES

run_step() {
    local n="$1"
    local script="$2"
    shift 2
    log_step "Paso $n: $script $*"
    bash "$SCRIPT_DIR/$script" "$@"
}

if [ -n "$STEP" ]; then
    case "$STEP" in
        1) run_step 1 "01-bootstrap-vm.sh" ;;
        2) run_step 2 "02-push-to-vm.sh" ;;
        3) run_step 3 "05-cutover-dns.sh" ;;
        4) run_step 4 "04-start-stack.sh" ;;
        5) run_step 5 "03-issue-certs.sh" ;;
        6)
            if [ "$FRESH" = "1" ]; then
                run_step 6 "06-migrate-data-from-termux.sh" --mode fresh
            else
                run_step 6 "06-migrate-data-from-termux.sh" --mode ssh
            fi
            ;;
        7) run_step 7 "07-validate.sh" ;;
        *) die "Step desconocido: $STEP (1..7)" ;;
    esac
    exit 0
fi

# Flujo completo
run_step 1 "01-bootstrap-vm.sh"
run_step 2 "02-push-to-vm.sh"

if [ "$SKIP_DNS" = "0" ]; then
    run_step 3 "05-cutover-dns.sh"
    log_info "Esperando 30s para propagacion DNS (TTL=300, podria tardar mas)"
    sleep 30
else
    log_warn "Saltando cutover DNS (--skip-dns). Asegurate de que DNS apunta a $GCP_VM_EXTERNAL_IP antes de 03-issue-certs."
fi

run_step 4 "04-start-stack.sh"
run_step 5 "03-issue-certs.sh"
# Re-apply: ahora los certs existen, 04-start-stack detectara y cambiara a conf.d-gcp
run_step 6 "04-start-stack.sh"

if [ "$FRESH" = "1" ]; then
    run_step 7 "06-migrate-data-from-termux.sh" --mode fresh
elif [ "$WITH_DATA" = "1" ]; then
    run_step 7 "06-migrate-data-from-termux.sh" --mode ssh
else
    log_info "Saltando migracion de datos. Usa --with-data o --fresh para incluirla."
fi

run_step 8 "07-validate.sh"

log_step "Deploy completado"
log_ok "Accede a: https://galantesjewelry.com"
log_ok "Shop:     https://shop.galantesjewelry.com"
log_ok "Admin:    https://odoo.galantesjewelry.com  (admin / \$ODOO_PASSWORD de .env.gcp)"
