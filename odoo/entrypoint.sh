#!/bin/bash
set -e

DB_NAME="${ODOO_DB:-${POSTGRES_DB:-galantes_prod}}"
DB_USER="${POSTGRES_USER:-odoo}"
DB_PASSWORD="${POSTGRES_PASSWORD:-admin}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

# Odoo Custom Entrypoint - Galante's Jewelry
echo "=========================================="
echo "Starting Odoo 19 for Galante's Jewelry"
echo "=========================================="

# If the first argument starts with '-' or is empty, assume we want to run odoo
if [ "${1:0:1}" = '-' ] || [ -z "$1" ]; then
    set -- odoo "$@" \
        -c /etc/odoo/odoo.conf \
        --database "$DB_NAME" \
        --db_host "$DB_HOST" \
        --db_port "$DB_PORT" \
        --db_user "$DB_USER" \
        --db_password "$DB_PASSWORD" \
        --db-filter "^${DB_NAME}\$"
fi

# Run the command
exec "$@"
