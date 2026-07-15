#!/usr/bin/env bash
# =========================================================================
# 02-push-to-vm.sh
# =========================================================================
# Sincroniza el repositorio al path GCP_VM_REPO_DIR de la VM.
# Estrategia preferente: git pull dentro de la VM (si el repo tiene remoto).
# Fallback: rsync via gcloud scp con exclusiones.
# Despues copia .env.gcp (fuera del git history) y ejecuta npm ci si hay
# cambios en package.json.
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_PROJECT_ID GCP_ZONE GCP_VM_NAME GCP_VM_REPO_DIR
check_vm_reachable

log_step "Push codigo + .env.gcp a la VM"

# ---- Detectar remoto git ----
REPO_URL="${GIT_REMOTE_URL:-}"
if [ -z "$REPO_URL" ] && [ -d "$REPO_ROOT/.git" ]; then
    REPO_URL="$(cd "$REPO_ROOT" && git config --get remote.origin.url || true)"
fi
REPO_BRANCH="${GIT_BRANCH:-main}"

USE_GIT=0
if [ -n "$REPO_URL" ]; then
    USE_GIT=1
    log_info "Remoto git detectado: $REPO_URL (branch=$REPO_BRANCH)"
else
    log_warn "Sin remoto git. Usare rsync para enviar el arbol actual."
fi

# ---- Estrategia A: git pull ----
if [ "$USE_GIT" = "1" ]; then
    log_info "Clonando / actualizando repo en la VM"
    vm_ssh "set -e; \
        if [ ! -d '$GCP_VM_REPO_DIR/.git' ]; then \
            git clone '$REPO_URL' '$GCP_VM_REPO_DIR'; \
        fi; \
        cd '$GCP_VM_REPO_DIR'; \
        git remote set-url origin '$REPO_URL'; \
        git fetch --all --prune; \
        git checkout '$REPO_BRANCH'; \
        git reset --hard 'origin/$REPO_BRANCH'"
fi

# ---- Estrategia B: rsync via gcloud scp ----
# Usamos tar pipe para evitar dependencia de rsync en la VM.
if [ "$USE_GIT" = "0" ]; then
    log_info "Empaquetando arbol actual (excluyendo node_modules, .next, etc)"
    local_tar="$(mktemp -t galantes_push_XXXX).tgz"
    tar \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='data' \
        --exclude='test-results' \
        --exclude='.pytest_cache' \
        --exclude='galante_deploy.zip' \
        --exclude='standalone_*.zip' \
        --exclude='next_standalone_*.tar.gz' \
        --exclude='*.tar.gz' \
        --exclude='temp_image_b64.txt' \
        --exclude='.env' \
        --exclude='.env.gcp' \
        -czf "$local_tar" -C "$REPO_ROOT" .
    log_info "Enviando tarball a la VM ($(du -h "$local_tar" | awk '{print $1}'))"
    vm_scp_push "$local_tar" "/tmp/galantes_push.tgz"
    vm_ssh "set -e; \
        mkdir -p '$GCP_VM_REPO_DIR'; \
        tar -xzf /tmp/galantes_push.tgz -C '$GCP_VM_REPO_DIR'; \
        rm -f /tmp/galantes_push.tgz"
    rm -f "$local_tar"
fi

# ---- .env.gcp (fuera de git) ----
if [ ! -f "$REPO_ROOT/.env.gcp" ]; then
    die "Falta $REPO_ROOT/.env.gcp. Copia .env.gcp.example y rellenalo."
fi
log_info "Subiendo .env.gcp a la VM"
vm_scp_push "$REPO_ROOT/.env.gcp" "$GCP_VM_REPO_DIR/.env.gcp"

log_info "Creando symlink conf.d-active -> conf.d-gcp-bootstrap (primer arranque)"
vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR/infra/nginx'; \
    rm -rf conf.d-active; \
    ln -s conf.d-gcp-bootstrap conf.d-active"

log_info "Aplicando permisos en .env.gcp (600)"
vm_ssh "chmod 600 '$GCP_VM_REPO_DIR/.env.gcp'"

log_ok "Repo + .env.gcp sincronizados en la VM"
log_info "Siguiente paso: scripts/gcp/04-start-stack.sh (o 03-issue-certs.sh si DNS ya apunta)"
