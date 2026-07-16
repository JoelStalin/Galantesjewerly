#!/usr/bin/env bash
# =========================================================================
# 08-backfill-managed-images.sh — replica los blobs CMS versionados a Odoo
# =========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

load_env
require_vars GCP_PROJECT_ID GCP_ZONE GCP_VM_NAME GCP_VM_REPO_DIR
check_vm_reachable

log_step "Restauracion de imagenes gestionadas y productos a Odoo"

SOURCE_DIR="${1:-$GCP_VM_REPO_DIR/Galantesjewelry/data/blobs}"
CMS_FILE="${2:-$GCP_VM_REPO_DIR/Galantesjewelry/data/cms.json}"

vm_ssh "set -e; \
    cd '$GCP_VM_REPO_DIR'; \
    test -d '$SOURCE_DIR'; \
    node scripts/restore-images-to-odoo.mjs --source '$SOURCE_DIR' --cms '$CMS_FILE'"

log_ok "Restauracion de imagenes completada"
