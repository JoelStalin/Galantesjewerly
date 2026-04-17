#!/usr/bin/env bash
# =========================================================================
# 04-start-stack.sh — levanta el stack completo en la VM
# =========================================================================
# Idempotente. Si es primer arranque, usa conf.d-gcp-bootstrap (HTTP only).
# Si ya hay certs emitidos, usa conf.d-gcp (HTTPS).
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_PROJECT_ID GCP_ZONE GCP_VM_NAME GCP_VM_REPO_DIR
check_vm_reachable

log_step "Start stack en $GCP_VM_NAME"

# Decidir que set de nginx config usar
log_info "Detectando si hay certs Let's Encrypt existentes en la VM"
HAS_CERTS=0
if vm_run "docker volume inspect galantesjewelry_letsencrypt-etc >/dev/null 2>&1 && docker run --rm -v galantesjewelry_letsencrypt-etc:/etc/letsencrypt alpine sh -c 'ls /etc/letsencrypt/live/ 2>/dev/null | grep -q galantesjewelry.com'"; then
    HAS_CERTS=1
fi

if [ "$HAS_CERTS" = "1" ]; then
    log_ok "Certs detectados. Usando conf.d-gcp (HTTPS)"
    ACTIVE_CONF=conf.d-gcp
else
    log_info "Sin certs. Usando conf.d-gcp-bootstrap (HTTP-only con ACME)"
    ACTIVE_CONF=conf.d-gcp-bootstrap
fi

vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR'; \
    rm -rf infra/nginx/conf.d-active; \
    ln -s '$ACTIVE_CONF' infra/nginx/conf.d-active"

log_info "Construyendo imagenes (cache-friendly)"
vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR'; \
    docker compose --env-file .env.gcp -f docker-compose.gcp.yml build web odoo"

log_info "Iniciando servicios"
vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR'; \
    docker compose --env-file .env.gcp -f docker-compose.gcp.yml up -d"

log_info "Esperando healthchecks (hasta 5 min para Odoo)"
for i in $(seq 1 30); do
    STATUS="$(vm_run "cd '$GCP_VM_REPO_DIR' && docker compose --env-file .env.gcp -f docker-compose.gcp.yml ps --format json" 2>/dev/null || echo '')"
    if echo "$STATUS" | grep -q '"Health":"healthy"'; then
        HEALTHY_COUNT="$(echo "$STATUS" | grep -c '"Health":"healthy"' || true)"
        log_info "  ${HEALTHY_COUNT} servicios healthy (iteracion $i/30)"
    fi
    # Salir temprano si todo esta arriba
    if vm_run "curl -fsS http://localhost/healthz" >/dev/null 2>&1; then
        log_ok "nginx responde healthz"
        break
    fi
    sleep 10
done

log_info "Estado final:"
vm_ssh "cd '$GCP_VM_REPO_DIR' && docker compose --env-file .env.gcp -f docker-compose.gcp.yml ps"

log_ok "Stack arriba. Proximo paso: 03-issue-certs.sh (si aun no hay TLS) o 07-validate.sh"
