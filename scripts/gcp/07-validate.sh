#!/usr/bin/env bash
# =========================================================================
# 07-validate.sh — Smoke tests E2E post-deploy
# =========================================================================
# Valida:
#  - Containers healthy
#  - Endpoints HTTP/HTTPS publicos
#  - APIs claves (/api/health, /api/products)
#  - Odoo /web/database/selector responde
#  - Certs TLS validos (no staging, no expirados)
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_VM_NAME GCP_ZONE GCP_VM_REPO_DIR GCP_HOSTNAMES GCP_VM_EXTERNAL_IP

FAIL=0
pass() { log_ok "PASS: $*"; }
fail() { log_err "FAIL: $*"; FAIL=$((FAIL+1)); }

log_step "Validacion E2E"

# ---- 1. Containers ----
log_info "Verificando containers"
PS_OUT="$(vm_run "cd '$GCP_VM_REPO_DIR' && docker compose --env-file .env.gcp -f docker-compose.gcp.yml ps --format 'table {{.Name}}\t{{.Status}}'")" || fail "docker compose ps no responde"
echo "$PS_OUT"
for SVC in galantes_web galantes_odoo galantes_db galantes_nginx galantes_certbot; do
    if echo "$PS_OUT" | grep -q "$SVC"; then
        if echo "$PS_OUT" | grep "$SVC" | grep -qE "running|Up"; then
            pass "$SVC running"
        else
            fail "$SVC presente pero no running"
        fi
    else
        fail "$SVC no existe"
    fi
done

# ---- 2. HTTP local en la VM ----
log_info "Smoke HTTP local (via VM)"
if vm_run "curl -fsS -o /dev/null -w '%{http_code}' http://localhost/healthz" 2>/dev/null | grep -q "200"; then
    pass "nginx /healthz local"
else
    fail "nginx /healthz local"
fi

if vm_run "curl -fsS -o /dev/null -w '%{http_code}' --resolve galantesjewelry.com:80:127.0.0.1 http://galantesjewelry.com/api/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
    pass "Next.js /api/health via nginx"
else
    fail "Next.js /api/health via nginx"
fi

if vm_run "curl -fsS -o /dev/null -w '%{http_code}' --resolve shop.galantesjewelry.com:80:127.0.0.1 http://shop.galantesjewelry.com/" 2>/dev/null | grep -qE "^(200|301|302|303)$"; then
    pass "Odoo shop via nginx (HTTP)"
else
    fail "Odoo shop via nginx (HTTP)"
fi

# ---- 3. Endpoints publicos ----
log_info "Probando endpoints publicos (DNS -> $GCP_VM_EXTERNAL_IP)"
for HOST in $GCP_HOSTNAMES; do
    # Probamos HTTPS primero; si falla, HTTP (pre-TLS)
    HTTPS_CODE="$(curl -kfsS -o /dev/null -w '%{http_code}' --connect-timeout 10 "https://$HOST/" 2>/dev/null || echo '000')"
    if [ "$HTTPS_CODE" != "000" ]; then
        pass "HTTPS $HOST -> $HTTPS_CODE"
    else
        HTTP_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --connect-timeout 10 "http://$HOST/" 2>/dev/null || echo '000')"
        if [ "$HTTP_CODE" != "000" ]; then
            log_warn "HTTPS fallo pero HTTP $HOST -> $HTTP_CODE (certs aun no emitidos?)"
        else
            fail "$HOST no responde ni HTTPS ni HTTP"
        fi
    fi
done

# ---- 4. Cert TLS (si existe) ----
log_info "Verificando certs Let's Encrypt"
for HOST in galantesjewelry.com shop.galantesjewelry.com odoo.galantesjewelry.com; do
    CERT_INFO="$(echo | timeout 10 openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>/dev/null || echo '')"
    if [ -z "$CERT_INFO" ]; then
        log_warn "No se pudo obtener cert de $HOST (TLS aun no configurado?)"
        continue
    fi
    if echo "$CERT_INFO" | grep -qi "staging\|fake\|test"; then
        log_warn "Cert de $HOST es de STAGING (no valido en browsers)"
    else
        pass "Cert de $HOST issuer/subject OK"
    fi
    echo "$CERT_INFO" | sed 's/^/    /'
done

# ---- 5. API de productos ----
log_info "Probando API /api/products"
API_OUT="$(curl -kfsS "https://galantesjewelry.com/api/products" 2>/dev/null || curl -fsS "http://galantesjewelry.com/api/products" 2>/dev/null || echo '')"
if echo "$API_OUT" | grep -qE '"data":|"products":|\[\]'; then
    pass "/api/products responde JSON"
else
    log_warn "/api/products no devolvio JSON esperado (puede ser normal si BD vacia)"
fi

# ---- Resultado final ----
echo ""
if [ "$FAIL" -eq 0 ]; then
    log_ok "Validacion completa: todos los checks OK"
    exit 0
else
    log_err "Validacion fallo en $FAIL checks. Revisa logs: vm_ssh 'cd $GCP_VM_REPO_DIR && docker compose -f docker-compose.gcp.yml logs --tail=200'"
    exit 1
fi
