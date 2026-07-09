#!/usr/bin/env bash
# =========================================================================
# 01-bootstrap-vm.sh
# =========================================================================
# Idempotente. Valida que la VM exista (galantes-prod-vm en
# deft-haven-493016-m4 us-central1-a) y que tenga Docker + firewall listos.
# Si no existe, la crea con vm-startup.sh. Si ya existe, solo valida.
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_PROJECT_ID GCP_REGION GCP_ZONE GCP_VM_NAME

log_step "Bootstrap VM $GCP_VM_NAME"

log_info "Proyecto activo: $GCP_PROJECT_ID"
gc config set project "$GCP_PROJECT_ID" >/dev/null

log_info "Habilitando APIs requeridas (idempotente)"
gc services enable \
    compute.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    serviceusage.googleapis.com \
    dns.googleapis.com

# ---- Firewall HTTP/HTTPS ----
if ! gc compute firewall-rules describe galantes-allow-web >/dev/null 2>&1; then
    log_info "Creando firewall rule galantes-allow-web (80,443)"
    gc compute firewall-rules create galantes-allow-web \
        --allow=tcp:80,tcp:443 \
        --target-tags=galantes-web \
        --source-ranges=0.0.0.0/0 \
        --description="HTTP/HTTPS publico para Galante's Jewelry"
else
    log_ok "Firewall galantes-allow-web ya existe"
fi

# ---- IP estatica ----
STATIC_IP_NAME="${GCP_STATIC_IP_NAME:-galantes-prod-ip}"
if ! gc compute addresses describe "$STATIC_IP_NAME" --region="$GCP_REGION" >/dev/null 2>&1; then
    log_info "Creando IP estatica $STATIC_IP_NAME en $GCP_REGION"
    gc compute addresses create "$STATIC_IP_NAME" --region="$GCP_REGION"
fi

STATIC_IP="$(gc compute addresses describe "$STATIC_IP_NAME" --region="$GCP_REGION" --format='value(address)')"
log_ok "IP estatica reservada: $STATIC_IP"

if [ -n "${GCP_VM_EXTERNAL_IP:-}" ] && [ "$GCP_VM_EXTERNAL_IP" != "$STATIC_IP" ]; then
    log_warn "GCP_VM_EXTERNAL_IP en .env.gcp ($GCP_VM_EXTERNAL_IP) NO coincide con la IP estatica ($STATIC_IP)."
    log_warn "Actualiza .env.gcp si este script va a promoverla como fuente de verdad."
fi

# ---- VM ----
if ! gc compute instances describe "$GCP_VM_NAME" --zone="$GCP_ZONE" >/dev/null 2>&1; then
    log_info "La VM $GCP_VM_NAME no existe. Creandola..."
    gc compute instances create "$GCP_VM_NAME" \
        --zone="$GCP_ZONE" \
        --machine-type="${GCP_VM_MACHINE_TYPE:-e2-medium}" \
        --boot-disk-size="${GCP_VM_DISK_GB:-30}GB" \
        --boot-disk-type=pd-balanced \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --address="$STATIC_IP_NAME" \
        --tags=galantes-web \
        --metadata-from-file=startup-script="$REPO_ROOT/scripts/gcp/vm-startup.sh"
    log_ok "VM creada. Esperando 30s para primer boot + startup-script..."
    sleep 30
else
    log_ok "VM $GCP_VM_NAME ya existe"
fi

# ---- Verificar Docker + ajustar tags si hace falta ----
check_vm_reachable

log_info "Verificando Docker en la VM"
if ! vm_run "docker --version && docker compose version" >/dev/null 2>&1; then
    log_warn "Docker no detectado en la VM. Aplicando vm-startup.sh manualmente..."
    vm_scp_push "$REPO_ROOT/scripts/gcp/vm-startup.sh" "/tmp/vm-startup.sh"
    vm_ssh "sudo bash /tmp/vm-startup.sh"
fi
log_ok "Docker instalado en la VM"

log_info "Asegurando que la VM tiene tag galantes-web (para firewall)"
CURRENT_TAGS="$(gc compute instances describe "$GCP_VM_NAME" --zone="$GCP_ZONE" --format='value(tags.items)')"
if ! echo "$CURRENT_TAGS" | grep -q "galantes-web"; then
    gc compute instances add-tags "$GCP_VM_NAME" --zone="$GCP_ZONE" --tags=galantes-web
    log_ok "Tag galantes-web agregado"
fi

log_info "Verificando que la VM tiene acceso al usuario ubuntu en docker group"
vm_ssh "sudo usermod -aG docker \$(whoami) || true; getent group docker" >/dev/null

log_ok "VM $GCP_VM_NAME lista. IP publica: $STATIC_IP"
log_info "Siguiente paso: scripts/gcp/02-push-to-vm.sh"
