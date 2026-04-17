#!/usr/bin/env bash
# =========================================================================
# common.sh — helpers compartidos por los scripts de deploy a GCP.
# Se sourcea, no se ejecuta directo.
# =========================================================================

# Colors (solo si TTY)
if [ -t 1 ]; then
    C_RESET='\033[0m'
    C_INFO='\033[0;34m'
    C_OK='\033[0;32m'
    C_WARN='\033[1;33m'
    C_ERR='\033[0;31m'
    C_STEP='\033[1;36m'
else
    C_RESET=''; C_INFO=''; C_OK=''; C_WARN=''; C_ERR=''; C_STEP=''
fi

log_info()  { printf "%b[INFO]%b %s\n"  "$C_INFO"  "$C_RESET" "$*"; }
log_ok()    { printf "%b[OK]%b   %s\n"  "$C_OK"    "$C_RESET" "$*"; }
log_warn()  { printf "%b[WARN]%b %s\n"  "$C_WARN"  "$C_RESET" "$*" >&2; }
log_err()   { printf "%b[ERR]%b  %s\n"  "$C_ERR"   "$C_RESET" "$*" >&2; }
log_step()  { printf "\n%b=== %s ===%b\n" "$C_STEP" "$*" "$C_RESET"; }

die() { log_err "$*"; exit 1; }

# Resuelve la raiz del repo (dos niveles arriba de este archivo)
# shellcheck disable=SC2034
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Carga .env.gcp si existe, respetando comentarios y espacios
load_env() {
    local env_file="${1:-$REPO_ROOT/.env.gcp}"
    if [ ! -f "$env_file" ]; then
        die "No se encontro $env_file. Copia .env.gcp.example y rellenalo."
    fi
    # shellcheck disable=SC1090
    set -a
    source "$env_file"
    set +a
}

# Valida que una variable no este vacia ni sea placeholder
require_var() {
    local name="$1"
    local val="${!name:-}"
    if [ -z "$val" ] \
        || [[ "$val" == CHANGE_ME* ]] \
        || [[ "$val" == change_me* ]] \
        || [[ "$val" == your_* ]] \
        || [[ "$val" == *"<placeholder>"* ]] \
        || [[ "$val" == replace_me* ]]; then
        die "Variable $name no configurada o placeholder. Edita .env.gcp."
    fi
}

require_vars() {
    for v in "$@"; do require_var "$v"; done
}

# Detecta gcloud (acepta PATH o ruta default de Windows)
find_gcloud() {
    if command -v gcloud >/dev/null 2>&1; then
        echo "gcloud"; return 0
    fi
    local win_gcloud="/c/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
    if [ -x "$win_gcloud" ]; then
        echo "$win_gcloud"; return 0
    fi
    return 1
}

# Wrapper para gcloud con el proyecto/zona correctos
gc() {
    local gcloud_cmd
    gcloud_cmd="$(find_gcloud)" || die "gcloud no encontrado en PATH. Instala Google Cloud SDK."
    "$gcloud_cmd" --project "$GCP_PROJECT_ID" "$@"
}

# Ejecuta comando remoto en la VM via gcloud ssh (con TTY)
vm_ssh() {
    local cmd="$1"
    gc compute ssh "$GCP_VM_NAME" \
        --zone "$GCP_ZONE" \
        --command "$cmd"
}

# Ejecuta comando remoto SIN tty (para streams/pipes)
vm_run() {
    local cmd="$1"
    gc compute ssh "$GCP_VM_NAME" \
        --zone "$GCP_ZONE" \
        --ssh-flag="-T" \
        --command "$cmd"
}

# Copia archivo local -> VM
vm_scp_push() {
    local local_path="$1"
    local remote_path="$2"
    gc compute scp "$local_path" \
        "${GCP_VM_NAME}:${remote_path}" \
        --zone "$GCP_ZONE"
}

# Copia archivo VM -> local
vm_scp_pull() {
    local remote_path="$1"
    local local_path="$2"
    gc compute scp \
        "${GCP_VM_NAME}:${remote_path}" \
        "$local_path" \
        --zone "$GCP_ZONE"
}

# Verifica conectividad inicial con la VM
check_vm_reachable() {
    log_info "Verificando conectividad SSH con $GCP_VM_NAME..."
    if ! vm_run "echo ok" >/dev/null 2>&1; then
        die "No se puede conectar por SSH a $GCP_VM_NAME (zone=$GCP_ZONE, proyecto=$GCP_PROJECT_ID). Verifica gcloud auth login y que la VM este RUNNING."
    fi
    log_ok "SSH OK con $GCP_VM_NAME"
}

# Llama API de Cloudflare. Requiere CF_API_TOKEN y CF_ZONE_ID.
cf_api() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    local url="https://api.cloudflare.com/client/v4${path}"
    if [ -n "$body" ]; then
        curl -fsS -X "$method" "$url" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "$body"
    else
        curl -fsS -X "$method" "$url" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json"
    fi
}
