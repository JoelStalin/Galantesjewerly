#!/bin/bash
set -e

DB_NAME="${ODOO_DB:-${POSTGRES_DB:-galantes_prod}}"
DB_USER="${POSTGRES_USER:-odoo}"
DB_PASSWORD="${POSTGRES_PASSWORD:-CHANGE_ME_LOCAL_POSTGRES_PASSWORD}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
INITIAL_MODULES_FILE="${INITIAL_MODULES_FILE:-/etc/odoo/initial_modules.txt}"
AUTO_INSTALL_MARKER="/var/lib/odoo/.initial_modules_installed_${DB_NAME}"

echo "=========================================="
echo "Starting Odoo 19 for Galante's Jewelry"
echo "Waiting for Postgres at $DB_HOST:$DB_PORT..."
echo "=========================================="

# Wait for Postgres.
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "Postgres is up - starting Odoo"

if [ "${ODOO_AUTO_INSTALL_MODULES:-false}" = "true" ] && [ ! -f "$AUTO_INSTALL_MARKER" ]; then
  if [ -f "$INITIAL_MODULES_FILE" ]; then
    INSTALL_MODULES="$(grep -vE '^(#|$)' "$INITIAL_MODULES_FILE" | tr '\n' ',' | sed 's/,$//')"
    if [ -n "$INSTALL_MODULES" ]; then
      echo "Auto-installing initial Odoo modules for $DB_NAME"
      odoo \
        -c /etc/odoo/odoo.conf \
        --database "$DB_NAME" \
        --db_host "$DB_HOST" \
        --db_port "$DB_PORT" \
        --db_user "$DB_USER" \
        --db_password "$DB_PASSWORD" \
        --db-filter "^${DB_NAME}\$" \
        -i "$INSTALL_MODULES" \
        --stop-after-init
      touch "$AUTO_INSTALL_MARKER"
    fi
  else
    echo "Initial modules file not found at $INITIAL_MODULES_FILE; skipping auto-install"
  fi
fi

# If the first argument starts with '-' or is empty, assume we want to run odoo.
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

exec "$@"
