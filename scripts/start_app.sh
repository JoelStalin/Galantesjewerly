#!/bin/bash
# Galante's Jewelry - Termux Bootstrap Script

echo "🌿 Galante's Jewelry: Iniciando Entorno Standalone..."

# 1. Limpieza de procesos previos
echo "🧹 Limpiando procesos antiguos..."
pkill -f "node server.js" || true

# 2. Asegurar estructura de carpetas y permisos
echo "🔑 Verificando permisos..."
mkdir -p data/blobs
chmod -R 777 data
chmod -R 777 public

# 3. Iniciar servidor con logs persistentes
echo "🚀 Arrancando Servidor en Puerto 3000..."
export PORT=3000
export HOSTNAME="0.0.0.0"

# Ejecutar en segundo plano
nohup node server.js > server.log 2>&1 &

echo "✅ Aplicación iniciada. Revisa server.log para detalles."
