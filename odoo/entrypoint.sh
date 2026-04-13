#!/bin/bash
set -e

# Odoo Custom Entrypoint - Galante's Jewelry
# Automatically installs required modules for complete sales workflow

echo "=========================================="
echo "Starting Odoo 19 for Galante's Jewelry"
echo "Flujo Completo: Productos → Ventas → Envíos"
echo "=========================================="

# Start Odoo in the background
echo "[INIT] Starting Odoo daemon..."
/entrypoint.sh odoo &
ODOO_PID=$!

# Wait for Odoo to start (check the web interface)
echo "[INIT] Waiting for Odoo to become responsive..."
MAX_RETRIES=120
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s http://localhost:8069 > /dev/null 2>&1; then
        echo "[INIT] ✓ Odoo is responsive!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $((RETRY_COUNT % 10)) -eq 0 ]; then
        echo "[INIT] Still waiting for Odoo... ($RETRY_COUNT/$MAX_RETRIES seconds)"
    fi
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[ERROR] Odoo failed to start after $MAX_RETRIES seconds"
    kill $ODOO_PID 2>/dev/null || true
    exit 1
fi

# Wait a bit more for Odoo to fully initialize
sleep 8

# Install modules from initial_modules.txt
echo "[INIT] Installing required modules for sales workflow..."

python3 << 'PYTHON_SCRIPT'
import xmlrpc.client
import time
import sys

try:
    # Connect to Odoo
    url = 'http://localhost:8069'
    db = 'galantes_db'
    username = 'admin'
    password = 'admin'

    print("[INIT] Authenticating with Odoo...")
    common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
    uid = common.authenticate(db, username, password, {})

    if not uid:
        print("[ERROR] Failed to authenticate with Odoo")
        sys.exit(1)

    print(f"[INIT] ✓ Authenticated as user {uid}")

    # Connect to the models API
    models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

    # Read the list of modules to install
    modules_to_install = []
    try:
        with open('/etc/odoo/initial_modules.txt', 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if line and not line.startswith('#'):
                    modules_to_install.append(line)
    except FileNotFoundError:
        print("[WARNING] initial_modules.txt not found, skipping auto-install")
        modules_to_install = []

    if not modules_to_install:
        print("[INIT] No modules to install")
    else:
        print(f"[INIT] Found {len(modules_to_install)} modules to install:")
        for mod in modules_to_install:
            print(f"       - {mod}")

        # Install each module
        for module_name in modules_to_install:
            print(f"\n[INIT] Processing module: {module_name}")

            try:
                # Search for the module
                installed_modules = models.execute_kw(db, uid, password, 'ir.module.module', 'search',
                    [['name', '=', module_name]])

                if not installed_modules:
                    print(f"       ⚠️  Module '{module_name}' not found in module list")
                    continue

                module_id = installed_modules[0]

                # Check current state
                module_state = models.execute_kw(db, uid, password, 'ir.module.module', 'read',
                    [module_id], ['state', 'name'])

                if module_state:
                    state = module_state[0]['state']
                    name = module_state[0]['name']

                    if state == 'installed':
                        print(f"       ✓ Already installed: {name}")
                    else:
                        print(f"       → Installing: {name} (current state: {state})")
                        models.execute_kw(db, uid, password, 'ir.module.module', 'button_immediate_install',
                            [module_id])
                        print(f"       ✓ Successfully installed: {name}")

                        # Wait a moment between installations
                        time.sleep(2)

            except Exception as e:
                print(f"       ✗ Error with module '{module_name}': {e}")
                continue

    print("\n[INIT] ========================================")
    print("[INIT] ✓ All modules processed successfully")
    print("[INIT] ========================================")

except Exception as e:
    print(f"[ERROR] Failed to install modules: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("[INIT] Setup complete! Odoo is running...")
PYTHON_SCRIPT

PYTHON_EXIT_CODE=$?
if [ $PYTHON_EXIT_CODE -ne 0 ]; then
    echo "[ERROR] Module installation failed with exit code $PYTHON_EXIT_CODE"
    kill $ODOO_PID 2>/dev/null || true
    exit 1
fi

echo "[INIT] =========================================="
echo "[INIT] Odoo 19 is ready!"
echo "[INIT] Access at: http://localhost:8069"
echo "[INIT] Login: admin / admin"
echo "[INIT] =========================================="

# Keep the main process in foreground
wait $ODOO_PID
