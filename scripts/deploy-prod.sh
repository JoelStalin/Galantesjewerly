#!/bin/bash
# Deployment script para PRODUCCIÓN (Docker Local)
# Uso: ./scripts/deploy-prod.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Galante's Jewelry — Production Deployment (Docker) ===${NC}"
echo ""

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo -e "${RED}❌ .env.prod no encontrado${NC}"
    echo "Por favor, copia .env.example a .env.prod y actualiza los valores"
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
source .env.prod

# Validate required variables
REQUIRED_VARS=(
    "CF_TUNNEL_TOKEN_PROD"
    "ADMIN_PASSWORD"
    "ODOO_PASSWORD"
    "ODOO_API_KEY"
    "POSTGRES_PASSWORD"
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

# Additional required vars by compose interpolation
EXTRA_REQUIRED_VARS=(
    "ADMIN_SECRET_KEY"
    "META_SYNC_TOKEN"
)

for var in "${EXTRA_REQUIRED_VARS[@]}"; do
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

# ============================================================================
# PASO 1: Build de Docker images
# ============================================================================
echo -e "${BLUE}PASO 1: Build de Docker images...${NC}"
docker compose --env-file .env.prod -f docker-compose.production.yml build

echo -e "${GREEN}✓ Build completado${NC}"
echo ""

# ============================================================================
# PASO 2: Iniciar servicios
# ============================================================================
echo -e "${BLUE}PASO 2: Iniciando servicios...${NC}"
docker compose --env-file .env.prod -f docker-compose.production.yml up -d

echo -e "${GREEN}✓ Servicios iniciados${NC}"
echo ""

# ============================================================================
# PASO 3: Esperar a que los servicios se levanten
# ============================================================================
echo -e "${BLUE}PASO 3: Esperando a que los servicios estén listos...${NC}"

# Wait for Nginx
echo "  Esperando Nginx..."
for i in {1..30}; do
    if docker compose --env-file .env.prod -f docker-compose.production.yml exec -T nginx wget -q -O- http://127.0.0.1/healthz > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Nginx listo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ❌ Nginx no respondió${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for Web
echo "  Esperando Next.js..."
for i in {1..30}; do
    if docker compose --env-file .env.prod -f docker-compose.production.yml exec -T web wget -q -O- http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Next.js listo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}  ⚠ Next.js aún no responde (puede estar compilando)${NC}"
    fi
    sleep 1
done

# Wait for Odoo
echo "  Esperando Odoo..."
for i in {1..60}; do
    if docker compose --env-file .env.prod -f docker-compose.production.yml exec -T odoo curl -f http://localhost:8069 > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Odoo listo${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${YELLOW}  ⚠ Odoo aún no responde (primer start puede tardar 5+ min)${NC}"
    fi
    sleep 1
done

# Wait for Cloudflared
echo "  Esperando Cloudflared tunnel..."
for i in {1..30}; do
    if docker compose --env-file .env.prod -f docker-compose.production.yml exec -T cloudflared wget -q -O- http://localhost:8768/ready > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Cloudflared listo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}  ⚠ Cloudflared aún conectando${NC}"
    fi
    sleep 1
done

echo ""

# ============================================================================
# PASO 4: Verificar conectividad
# ============================================================================
echo -e "${BLUE}PASO 4: Verificando conectividad...${NC}"

echo "  Local (Docker): http://localhost:${NGINX_PORT:-8080}"
if curl -s -L http://localhost:${NGINX_PORT:-8080}/api/health 2>&1 | grep -q "ok"; then
    echo -e "${GREEN}  ✓ Local OK${NC}"
else
    echo -e "${YELLOW}  ⚠ Local no responde${NC}"
fi

echo ""
echo "  URLs Públicas (via Cloudflare):"
echo "    https://galantesjewelry.com"
echo "    https://shop.galantesjewelry.com"
echo "    https://odoo.galantesjewelry.com"
echo ""
echo "  Esperando 30-60 segundos para que el tunnel se establezca..."
sleep 30

if curl -s -L https://galantesjewelry.com/api/health 2>&1 | grep -q "ok"; then
    echo -e "${GREEN}  ✓ Acceso público OK${NC}"
else
    echo -e "${YELLOW}  ⚠ Acceso público no disponible aún (verifica el tunnel en Cloudflare)${NC}"
fi

echo ""

# ============================================================================
# PASO 5: Mostrar logs
# ============================================================================
echo -e "${BLUE}PASO 5: Logs de servicios${NC}"
echo ""
echo "Para ver logs en tiempo real:"
echo "  docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "Para ver logs de un servicio específico:"
echo "  docker-compose -f docker-compose.production.yml logs -f web"
echo "  docker-compose -f docker-compose.production.yml logs -f odoo"
echo "  docker-compose -f docker-compose.production.yml logs -f nginx"
echo "  docker-compose -f docker-compose.production.yml logs -f cloudflared"
echo ""

# ============================================================================
# PASO 6: Verificar Odoo
# ============================================================================
echo -e "${BLUE}PASO 6: Información de Odoo${NC}"
echo ""
echo "  Admin URL: https://odoo.galantesjewelry.com"
echo "  Username: ${ODOO_USERNAME}"
echo "  Database: ${ODOO_DB}"
echo "  Appointment sync auth: ODOO_API_KEY"
echo ""

# ============================================================================
# FINAL
# ============================================================================
echo -e "${GREEN}=== Deployment completado ===${NC}"
echo ""
echo "Próximos pasos:"
echo "  1. Verifica https://galantesjewelry.com en el navegador"
echo "  2. Accede a Odoo en https://odoo.galantesjewelry.com"
echo "  3. Crea productos de prueba en Odoo"
echo "  4. Verifica que aparecen en https://shop.galantesjewelry.com"
echo ""
echo "Para detener los servicios:"
echo "  docker-compose -f docker-compose.production.yml down"
echo ""
