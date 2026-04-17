#!/bin/bash
# Deployment script para TEST (Termux Android)
# Este script se ejecuta en Termux (Android) para la rama de testing
# Uso: ./scripts/deploy-test.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Galante's Jewelry — Test Deployment (Termux Android) ===${NC}"
echo ""

# Check if .env.test exists
if [ ! -f .env.test ]; then
    echo -e "${RED}❌ .env.test no encontrado${NC}"
    echo "Copia .env.example a .env.test"
    exit 1
fi

# Helper: validate placeholders
is_placeholder() {
    local value="$1"
    if [[ -z "$value" ]]; then
        return 0
    fi
    if [[ "$value" == your_* || "$value" == change_me* || "$value" == generate_with_* || "$value" == test_* || "$value" == *"replace_me"* ]]; then
        return 0
    fi
    return 1
}

# Load environment
source .env.test

# Validate required variables
REQUIRED_VARS=(
    "CF_TUNNEL_TOKEN_TEST"
    "ADMIN_PASSWORD"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Variable requerida no configurada: $var${NC}"
        exit 1
    fi
    if is_placeholder "${!var}"; then
        echo -e "${RED}❌ Variable requerida contiene placeholder: $var${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✓ Variables de entorno verificadas${NC}"
echo ""

# Ensure logs directory exists
mkdir -p logs

# ============================================================================
# PASO 1: Verificar Node.js
# ============================================================================
echo -e "${BLUE}PASO 1: Verificando Node.js...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    echo "En Termux: pkg install nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION} detectado${NC}"
echo ""

# ============================================================================
# PASO 2: Instalar dependencias
# ============================================================================
echo -e "${BLUE}PASO 2: Instalando dependencias...${NC}"

if [ ! -d "node_modules" ]; then
    npm install
else
    npm ci  # Usar lockfile si existe
fi

echo -e "${GREEN}✓ Dependencias instaladas${NC}"
echo ""

# ============================================================================
# PASO 3: Build de Next.js
# ============================================================================
echo -e "${BLUE}PASO 3: Building Next.js...${NC}"

npm run build

echo -e "${GREEN}✓ Build completado${NC}"
echo ""

# ============================================================================
# PASO 4: Iniciar Cloudflared en background
# ============================================================================
echo -e "${BLUE}PASO 4: Iniciando Cloudflared tunnel...${NC}"

# Kill any existing cloudflared process
pkill -f "cloudflared tunnel" || true

# Download cloudflared if not exists
if [ ! -f "cloudflared" ]; then
    echo "  Descargando cloudflared..."
    # Para Android/Termux, usar la versión apropiada
    wget -q https://github.com/cloudflare/cloudflared/releases/download/2024.1.0/cloudflared-linux-arm64 -O cloudflared
    chmod +x cloudflared
fi

# Start cloudflared in background with nohup
nohup ./cloudflared tunnel --no-autoupdate run --token "${CF_TUNNEL_TOKEN_TEST}" > logs/cloudflared.log 2>&1 &
TUNNEL_PID=$!
echo -e "${GREEN}✓ Cloudflared iniciado (PID: $TUNNEL_PID)${NC}"

# Wait for tunnel to connect
echo "  Esperando a que el túnel se conecte..."
sleep 5

if ps -p $TUNNEL_PID > /dev/null; then
    echo -e "${GREEN}  ✓ Tunnel activo${NC}"
else
    echo -e "${RED}  ❌ Tunnel falló${NC}"
    cat logs/cloudflared.log
    exit 1
fi
echo ""

# ============================================================================
# PASO 5: Iniciar Next.js
# ============================================================================
echo -e "${BLUE}PASO 5: Iniciando Next.js en puerto 3000...${NC}"

# Kill any existing process
pkill -f "node" || true

# Start Next.js with environment variables
NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 nohup npm start > logs/nextjs.log 2>&1 &
NEXT_PID=$!
echo -e "${GREEN}✓ Next.js iniciado (PID: $NEXT_PID)${NC}"

# Wait for startup
echo "  Esperando a que Next.js inicie..."
for i in {1..30}; do
    if curl -s -L http://127.0.0.1:3000/api/health 2>&1 | grep -q "ok"; then
        echo -e "${GREEN}  ✓ Next.js listo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}  ⚠ Next.js aún iniciando${NC}"
    fi
    sleep 1
done

echo ""

# ============================================================================
# PASO 6: Información de acceso
# ============================================================================
echo -e "${BLUE}PASO 6: URLs de acceso${NC}"
echo ""
echo "  Local (Termux):"
echo "    http://127.0.0.1:3000"
echo "    http://$(hostname -I | awk '{print $1}'):3000  (desde otra máquina en LAN)"
echo ""
echo "  Pública (via Cloudflare):"
echo "    https://test.galantesjewelry.com"
echo "    https://test-shop.galantesjewelry.com"
echo ""

echo -e "${BLUE}PASO 7: Monitorear logs${NC}"
echo ""
echo "  Logs de Next.js (tiempo real):"
echo "    tail -f logs/nextjs.log"
echo ""
echo "  Logs de Cloudflared:"
echo "    tail -f logs/cloudflared.log"
echo ""

# ============================================================================
# FINAL
# ============================================================================
echo -e "${GREEN}=== Deployment TEST completado ===${NC}"
echo ""
echo "Información de procesos:"
echo "  Next.js PID: $NEXT_PID"
echo "  Cloudflared PID: $TUNNEL_PID"
echo ""
echo "Para detener:"
echo "  kill $NEXT_PID $TUNNEL_PID"
echo "  # O simplemente: pkill -f 'node|cloudflared'"
echo ""
echo "Este es el entorno de TESTING. Los cambios aquí no afectan a PRODUCCIÓN."
echo ""
