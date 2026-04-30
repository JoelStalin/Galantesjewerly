#!/bin/bash
set -Eeuo pipefail

# Scripts de blindaje para el despliegue de Galante's Jewelry
# Este script vive en el servidor y es llamado por GitHub Actions

REMOTE_DIR="$HOME/galantesjewelry"
ENV_FILE="$REMOTE_DIR/.env.prod"
TMP_ENV_FILE="$REMOTE_DIR/.env.prod.tmp"

update_env_atomic() {
    local key="$1"
    local value="$2"
    [ -z "$value" ] && return 0
    
    # Crear archivo temporal si no existe, basado en el actual
    if [ ! -f "$TMP_ENV_FILE" ]; then
        if [ -f "$ENV_FILE" ]; then
            cp "$ENV_FILE" "$TMP_ENV_FILE"
        else
            touch "$TMP_ENV_FILE"
        fi
    fi

    # Eliminar linea existente si hay duplicados o basura
    sed -i "/^${key}=/d" "$TMP_ENV_FILE"
    
    # Asegurar que termine en newline antes de añadir
    [ -s "$TMP_ENV_FILE" ] && [ -z "$(tail -c1 "$TMP_ENV_FILE")" ] || echo "" >> "$TMP_ENV_FILE"
    
    echo "${key}=${value}" >> "$TMP_ENV_FILE"
}

finalize_env() {
    if [ -f "$TMP_ENV_FILE" ]; then
        mv "$TMP_ENV_FILE" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
    fi
}

# --- Lógica de Despliegue Robusto ---

cd "$REMOTE_DIR"

# 1. Asegurar persistencia de Docker
# Si Docker no arranca al inicio, habilitarlo
sudo systemctl enable docker || true

# 2. Iniciar Tunnel de Cloudflare inmediatamente (si no está corriendo)
# Esto "blinda" el acceso SSH y HTTP
echo "Verificando Tunnel..."
docker compose -f docker-compose.production.yml up -d cloudflared

# 3. Procesar variables de entorno de forma atómica
# (Las variables deben ser pasadas como argumentos o enviadas por GH Actions)
# Este bloque es un placeholder para ser inyectado o parametrizado
