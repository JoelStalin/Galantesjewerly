#!/usr/bin/env bash
# =========================================================================
# 05-cutover-dns.sh — actualiza DNS en Cloudflare (registrar Squarespace,
# nameservers = Cloudflare) para apuntar a la IP de GCP.
# =========================================================================
# Usa la Cloudflare API con CF_API_TOKEN. Para cada hostname:
#  - Si existe A record, lo actualiza a GCP_VM_EXTERNAL_IP (proxied=false).
#  - Si no existe, lo crea.
#
# IMPORTANTE: proxied=false (DNS only / grey cloud) para que Let's Encrypt
# HTTP-01 funcione. Despues de que certs esten emitidos, puedes activar
# proxied=true manualmente si quieres aprovechar el CDN de Cloudflare.
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars CF_API_TOKEN CF_ZONE_NAME GCP_VM_EXTERNAL_IP GCP_HOSTNAMES

log_step "Cutover DNS en Cloudflare -> $GCP_VM_EXTERNAL_IP"

# ---- Resolver CF_ZONE_ID si esta vacio ----
if [ -z "${CF_ZONE_ID:-}" ] || [[ "$CF_ZONE_ID" == CHANGE_ME* ]]; then
    log_info "CF_ZONE_ID no seteado. Lo resuelvo por nombre ($CF_ZONE_NAME)"
    ZONE_RESP="$(cf_api GET "/zones?name=$CF_ZONE_NAME")"
    CF_ZONE_ID="$(echo "$ZONE_RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["result"][0]["id"] if d.get("result") else "")')"
    if [ -z "$CF_ZONE_ID" ]; then
        die "No se pudo resolver CF_ZONE_ID para $CF_ZONE_NAME. Verifica CF_API_TOKEN tiene Zone:Read."
    fi
    log_ok "CF_ZONE_ID resuelto: $CF_ZONE_ID"
fi

# ---- Helper: upsert A record ----
upsert_a_record() {
    local host="$1"
    local ip="$2"
    local record_name="$host"

    log_info "Procesando $host -> $ip"
    LIST_RESP="$(cf_api GET "/zones/$CF_ZONE_ID/dns_records?type=A&name=$record_name")"
    EXISTING_ID="$(echo "$LIST_RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["id"] if r else "")')"

    BODY=$(python3 -c "
import json
print(json.dumps({
    'type': 'A',
    'name': '$record_name',
    'content': '$ip',
    'ttl': 300,
    'proxied': False,
    'comment': 'GCP VM migration 2026-04-17'
}))")

    if [ -n "$EXISTING_ID" ]; then
        log_info "  update existing record $EXISTING_ID"
        cf_api PUT "/zones/$CF_ZONE_ID/dns_records/$EXISTING_ID" "$BODY" >/dev/null
    else
        log_info "  creating new A record"
        cf_api POST "/zones/$CF_ZONE_ID/dns_records" "$BODY" >/dev/null
    fi
    log_ok "  $host listo"
}

for HOST in $GCP_HOSTNAMES; do
    upsert_a_record "$HOST" "$GCP_VM_EXTERNAL_IP"
done

# ---- Purgar record 'ssh.galantesjewelry.com' si existe y apunta a Termux ----
# Esto rompia el tunnel viejo; el handoff decia que fallaba timeout.
log_info "Buscando records obsoletos (ssh.*, test.*, cloudflared tunnel CNAMEs)"
for OBSOLETE in ssh.galantesjewelry.com test.galantesjewelry.com test-shop.galantesjewelry.com test-odoo.galantesjewelry.com; do
    OBS_RESP="$(cf_api GET "/zones/$CF_ZONE_ID/dns_records?name=$OBSOLETE")"
    OBS_ID="$(echo "$OBS_RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["id"] if r else "")')"
    if [ -n "$OBS_ID" ]; then
        log_warn "  encontrado $OBSOLETE (id=$OBS_ID). NO lo borro por seguridad."
        log_warn "  Revisalo manualmente si quieres limpiarlo."
    fi
done

log_ok "DNS actualizado en Cloudflare"
log_info "Propagacion TTL=300s. Verifica con: dig +short galantesjewelry.com"
log_info "Luego ejecuta: scripts/gcp/03-issue-certs.sh"
