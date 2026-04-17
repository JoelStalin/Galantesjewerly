#!/bin/bash
# Cloudflare Zero Trust Configuration Setup
# Este script documenta los pasos necesarios para configurar Cloudflare Zero Trust
# NOTA: Debido a CAPTCHAs y Turnstile, los pasos finales deben hacerse MANUALMENTE en el dashboard

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Galante's Jewelry — Cloudflare Zero Trust Setup ===${NC}"
echo ""

# Load environment variables
if [ ! -f .env.prod ]; then
    echo -e "${YELLOW}AVISO: .env.prod no encontrado. Usa .env.example como referencia.${NC}"
    exit 1
fi

source .env.prod

# Verify required environment variables
if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_ZONE_ID" ]; then
    echo -e "${YELLOW}❌ Faltan variables requeridas en .env.prod:${NC}"
    echo "   - CF_API_TOKEN (obtén en: https://dash.cloudflare.com/profile/api-tokens)"
    echo "   - CF_ACCOUNT_ID (obtén en: https://dash.cloudflare.com/cgi-bin/account/overview)"
    echo "   - CF_ZONE_ID (obtén en: DNS → Nameservers)"
    exit 1
fi

echo -e "${GREEN}✓ Variables de entorno detectadas${NC}"
echo "  Account ID: ${CF_ACCOUNT_ID:0:8}..."
echo "  Zone ID: ${CF_ZONE_ID:0:8}..."
echo ""

# ============================================================================
# PASO 1: Verificar que los DNS de Cloudflare están configurados
# ============================================================================
echo -e "${BLUE}PASO 1: Verificar DNS de Cloudflare${NC}"
echo "1. Ve a: https://dash.cloudflare.com/cgi-bin/manage/domains"
echo "2. Selecciona galantesjewelry.com"
echo "3. Ve a: DNS → Nameservers"
echo "4. Verifica que los nameservers de Cloudflare están activos (dan.ns.cloudflare.com, etc.)"
echo ""
read -p "Presiona ENTER una vez que hayas confirmado los nameservers..."
echo ""

# ============================================================================
# PASO 2: Crear túneles en Cloudflare
# ============================================================================
echo -e "${BLUE}PASO 2: Crear Túneles (TEST y PROD)${NC}"
echo "Para crear los túneles, ve a:"
echo "  https://one.dash.cloudflare.com/networks/tunnels"
echo ""
echo "Crea DOS túneles:"
echo "  1. Nombre: 'galantes-test' (para Termux Android)"
echo "  2. Nombre: 'galantes-prod' (para Docker Local)"
echo ""
echo "Después de crearlos, obtén los tokens:"
echo "  - galantes-test token → CF_TUNNEL_TOKEN_TEST en .env.prod"
echo "  - galantes-prod token → CF_TUNNEL_TOKEN_PROD en .env.prod"
echo ""
read -p "Presiona ENTER una vez que hayas creado los túneles y obtenido los tokens..."
echo ""

# ============================================================================
# PASO 3: Configurar Public Hostnames (TEST)
# ============================================================================
echo -e "${BLUE}PASO 3: Configurar Public Hostnames para TEST (Termux)${NC}"
echo "Estos pasos REQUIEREN hacer clic en el dashboard de Cloudflare (no se puede automatizar):"
echo ""
echo "🟡 En Cloudflare Dashboard → Zero Trust → Tunnels → galantes-test → Public Hostname"
echo "   Crea TRES public hostnames:"
echo ""
echo "   1. Domain: test.galantesjewelry.com"
echo "      Service: http://127.0.0.1:3000"
echo ""
echo "   2. Domain: test-shop.galantesjewelry.com"
echo "      Service: http://127.0.0.1:8069"
echo ""
echo "   3. Domain: test-odoo.galantesjewelry.com"
echo "      Service: http://127.0.0.1:8069"
echo ""
echo "IMPORTANTE: En Termux, estos servicios deben estar escuchando en 127.0.0.1 (localhost)"
echo ""
read -p "Presiona ENTER una vez que hayas configurado los Public Hostnames para TEST..."
echo ""

# ============================================================================
# PASO 4: Configurar Public Hostnames (PROD)
# ============================================================================
echo -e "${BLUE}PASO 4: Configurar Public Hostnames para PROD (Docker)${NC}"
echo "En Cloudflare Dashboard → Zero Trust → Tunnels → galantes-prod → Public Hostname"
echo "   Crea TRES public hostnames:"
echo ""
echo "   1. Domain: galantesjewelry.com"
echo "      Service: http://nginx:80"
echo ""
echo "   2. Domain: www.galantesjewelry.com"
echo "      Service: http://nginx:80"
echo ""
echo "   3. Domain: shop.galantesjewelry.com"
echo "      Service: http://nginx:80"
echo ""
echo "   4. Domain: odoo.galantesjewelry.com"
echo "      Service: http://nginx:80"
echo ""
echo "IMPORTANTE: El Nginx en Docker está en el hostname 'nginx' en la red interna del Docker"
echo ""
read -p "Presiona ENTER una vez que hayas configurado los Public Hostnames para PROD..."
echo ""

# ============================================================================
# PASO 5: Crear DNS CNAME records (OPCIONAL — si no usas Cloudflare Tunnel)
# ============================================================================
echo -e "${BLUE}PASO 5: Verificar DNS Records (Opcional)${NC}"
echo "Si deseas usar solo DNS (sin Tunnel), añade estos records en DNS → Records:"
echo ""
echo "  galantesjewelry.com        CNAME  galantes-prod.cfargotunnel.com"
echo "  www.galantesjewelry.com    CNAME  galantes-prod.cfargotunnel.com"
echo "  shop.galantesjewelry.com   CNAME  galantes-prod.cfargotunnel.com"
echo "  odoo.galantesjewelry.com   CNAME  galantes-prod.cfargotunnel.com"
echo ""
echo "  test.galantesjewelry.com   CNAME  galantes-test.cfargotunnel.com"
echo "  test-shop.galantesjewelry.com CNAME galantes-test.cfargotunnel.com"
echo "  test-odoo.galantesjewelry.com CNAME galantes-test.cfargotunnel.com"
echo ""
echo "NOTA: Cloudflare Tunnel maneja esto automáticamente. Si usas Public Hostnames,"
echo "      estos records NO se necesitan."
echo ""
read -p "Presiona ENTER para continuar..."
echo ""

# ============================================================================
# PASO 6: Configuración de Zero Trust Policies (RECOMENDADO)
# ============================================================================
echo -e "${BLUE}PASO 6: Configurar Zero Trust Access Policies (Recomendado)${NC}"
echo "Para mayor seguridad, ve a: https://one.dash.cloudflare.com/access/apps"
echo ""
echo "Crea access policies para:"
echo "  - Admin pages (odoo.galantesjewelry.com): Requiere autenticación Cloudflare"
echo "  - Test domains (test.*): Acceso público o restringido"
echo "  - Shop (shop.galantesjewelry.com): Acceso público"
echo ""
read -p "Presiona ENTER una vez configuradas las políticas..."
echo ""

# ============================================================================
# PASO 7: Actualizar .env.prod con tokens
# ============================================================================
echo -e "${BLUE}PASO 7: Actualizar .env.prod${NC}"
echo "Por favor, edita .env.prod y agrega:"
echo ""
echo "  CF_TUNNEL_TOKEN_TEST=eyJhIjoiYWJjZGVmZ2hpams..."
echo "  CF_TUNNEL_TOKEN_PROD=eyJhIjoieHl6YWJjZGVmZ2..."
echo ""
echo "Luego, copia este archivo para producción:"
echo "  cp .env.prod .env"
echo ""
read -p "Presiona ENTER una vez que hayas actualizado .env.prod..."
echo ""

# ============================================================================
# PASO 8: Iniciar servicios
# ============================================================================
echo -e "${BLUE}PASO 8: Iniciar servicios${NC}"
echo ""
echo "Para PRODUCCIÓN (Docker Local):"
echo "  docker-compose -f docker-compose.production.yml up -d"
echo ""
echo "Para TEST (Termux Android):"
echo "  npm run dev"
echo "  # Cloudflared corre en background con token CF_TUNNEL_TOKEN_TEST"
echo ""
read -p "Presiona ENTER para continuar..."
echo ""

# ============================================================================
# PASO 9: Validar conectividad
# ============================================================================
echo -e "${BLUE}PASO 9: Validar conectividad${NC}"
echo ""
echo "Espera 30-60 segundos para que los túneles se establezcan..."
echo ""
sleep 5

echo "Probando PROD (Docker):"
if curl -s -L https://galantesjewelry.com/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓ PROD es accesible${NC}"
else
    echo -e "${YELLOW}⚠ No se puede acceder a PROD. Verifica el túnel en el dashboard.${NC}"
fi
echo ""

echo "Probando TEST (Termux):"
if curl -s -L https://test.galantesjewelry.com/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓ TEST es accesible${NC}"
else
    echo -e "${YELLOW}⚠ No se puede acceder a TEST. Verifica que Termux esté corriendo y el túnel activo.${NC}"
fi
echo ""

echo -e "${GREEN}=== Setup completado ===${NC}"
echo ""
echo "URLs:"
echo "  PROD (Principal): https://galantesjewelry.com"
echo "  PROD (Shop): https://shop.galantesjewelry.com"
echo "  PROD (Odoo Admin): https://odoo.galantesjewelry.com"
echo ""
echo "  TEST (Termux): https://test.galantesjewelry.com"
echo "  TEST (Shop): https://test-shop.galantesjewelry.com"
echo "  TEST (Odoo Admin): https://test-odoo.galantesjewelry.com"
echo ""
