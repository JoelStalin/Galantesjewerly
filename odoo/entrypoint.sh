#!/bin/bash
set -e

DB_NAME="${ODOO_DB:-${POSTGRES_DB:-galantes_prod}}"
DB_USER="${POSTGRES_USER:-odoo}"
DB_PASSWORD="${POSTGRES_PASSWORD:-CHANGE_ME_LOCAL_POSTGRES_PASSWORD}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "=========================================="
echo "Starting Odoo 19 for Galante's Jewelry"
echo "Waiting for Postgres at $DB_HOST:$DB_PORT..."
echo "=========================================="

# Wait for Postgres
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "Postgres is up - starting Odoo"

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
