#!/bin/bash
set -e

DB_NAME="${ODOO_DB:-${POSTGRES_DB:-galantes_prod}}"
DB_USER="${ODOO_USERNAME:-admin}"
DB_PASSWORD="${ODOO_PASSWORD:-admin}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin_password_change_me}"
AUTO_INSTALL_MODULES="${ODOO_AUTO_INSTALL_MODULES:-false}"

# Odoo Custom Entrypoint - Galante's Jewelry
# Automatically installs required modules for complete sales workflow

echo "=========================================="
echo "Starting Odoo 19 for Galante's Jewelry"
echo "Flujo Completo: Productos → Ventas → Envíos"
echo "=========================================="

if [ "$AUTO_INSTALL_MODULES" != "true" ]; then
        echo "[INIT] Starting Odoo in stable mode (bootstrap skipped)..."
        exec odoo \
            -c /etc/odoo/odoo.conf \
            --database "$DB_NAME" \
            --db_host "$DB_HOST" \
            --db_port "$DB_PORT" \
            --db_user "${POSTGRES_USER:-odoo}" \
            --db_password "${POSTGRES_PASSWORD}" \
            --db-filter "^${DB_NAME}\$"
fi

# Install modules in one-shot mode before starting the long-running server
if [ -f /etc/odoo/initial_modules.txt ]; then
    MODULES_TO_INSTALL=$(grep -Ev '^\s*#|^\s*$' /etc/odoo/initial_modules.txt | tr -d '\r' | paste -sd, -)
else
    MODULES_TO_INSTALL=""
fi

if [ -n "$MODULES_TO_INSTALL" ]; then
    echo "[INIT] Installing required modules for sales workflow..."
    echo "[INIT] Modules: $MODULES_TO_INSTALL"
    odoo \
        -c /etc/odoo/odoo.conf \
        --database "$DB_NAME" \
        --db_host "$DB_HOST" \
        --db_port "$DB_PORT" \
        --db_user "${POSTGRES_USER:-odoo}" \
        --db_password "${POSTGRES_PASSWORD}" \
        --db-filter "^${DB_NAME}\$" \
        --init "$MODULES_TO_INSTALL" \
        --without-demo=all \
        --stop-after-init
else
    echo "[INIT] No modules listed in /etc/odoo/initial_modules.txt"
fi

echo "[INIT] Starting Odoo in service mode..."
exec odoo \
    -c /etc/odoo/odoo.conf \
    --database "$DB_NAME" \
    --db_host "$DB_HOST" \
    --db_port "$DB_PORT" \
    --db_user "${POSTGRES_USER:-odoo}" \
    --db_password "${POSTGRES_PASSWORD}" \
    --db-filter "^${DB_NAME}\$"
