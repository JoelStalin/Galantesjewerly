#!/usr/bin/env bash
# =========================================================================
# 03-issue-certs.sh — Let's Encrypt HTTP-01 via webroot
# =========================================================================
# Precondicion: DNS A-records para los hostnames apuntan a la IP publica
# de la VM (sin proxy de Cloudflare / orange cloud = OFF).
# Ejecuta este script DESPUES de 05-cutover-dns.sh o tras cambiar DNS manual.
#
# Flujo:
#  1. Asegura nginx corriendo en modo bootstrap (HTTP-only con /acme)
#  2. Por cada hostname, emite un cert via certbot --webroot
#  3. Cambia symlink conf.d-active a conf.d-gcp (con TLS)
#  4. Recarga nginx
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_PROJECT_ID GCP_ZONE GCP_VM_NAME GCP_VM_REPO_DIR \
             LETSENCRYPT_EMAIL GCP_HOSTNAMES
check_vm_reachable

log_step "Emitir certs Let's Encrypt"

STAGING_FLAG=""
if [ "${LETSENCRYPT_STAGING:-0}" = "1" ]; then
    STAGING_FLAG="--staging"
    log_warn "LETSENCRYPT_STAGING=1 => emitiendo certs de STAGING (no validos)"
fi

# ---- 1. Asegurar nginx en modo bootstrap ----
log_info "Asegurando stack basico (nginx+web+odoo+postgres) en modo bootstrap"
vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR'; \
    rm -rf infra/nginx/conf.d-active; \
    ln -s conf.d-gcp-bootstrap infra/nginx/conf.d-active; \
    docker compose --env-file .env.gcp -f docker-compose.gcp.yml up -d postgres odoo web nginx; \
    sleep 8; \
    docker compose --env-file .env.gcp -f docker-compose.gcp.yml ps"

# ---- 2. Verificar alcance HTTP publico ----
log_info "Verificando que los hostnames responden por HTTP (ACME challenge)"
for HOST in $GCP_HOSTNAMES; do
    log_info "  probando http://$HOST/.well-known/acme-challenge/_test_"
    if ! curl -fsS -o /dev/null -w "%{http_code}" "http://$HOST/.well-known/acme-challenge/_test_" 2>/dev/null | grep -qE '^(200|404)$'; then
        log_warn "  $HOST no responde correctamente por HTTP publico."
        log_warn "  Asegurate de que DNS apunta a $GCP_VM_EXTERNAL_IP y proxy Cloudflare esta DNS-only (grey cloud)."
    fi
done

# ---- 3. Emitir cert por hostname ----
# Se emite un cert por hostname para flexibilidad (ok para Let's Encrypt free tier).
for HOST in $GCP_HOSTNAMES; do
    log_info "Emitir cert para $HOST"
    vm_ssh "set -e; \
        cd '$GCP_VM_REPO_DIR'; \
        docker compose --env-file .env.gcp -f docker-compose.gcp.yml run --rm --entrypoint='' certbot \
            certbot certonly --webroot --webroot-path=/var/www/certbot \
            --non-interactive --agree-tos \
            --email '$LETSENCRYPT_EMAIL' \
            $STAGING_FLAG \
            --cert-name '$HOST' \
            -d '$HOST'"
done

# ---- 4. Activar config con TLS ----
log_info "Cambiando symlink conf.d-active -> conf.d-gcp (TLS)"
vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR'; \
    rm -rf infra/nginx/conf.d-active; \
    ln -s conf.d-gcp infra/nginx/conf.d-active"

log_info "Recargando nginx"
vm_ssh "docker exec galantes_nginx nginx -t && docker exec galantes_nginx nginx -s reload"

log_ok "Certs emitidos y nginx con TLS activo"
log_info "Prueba: curl -I https://galantesjewelry.com"
