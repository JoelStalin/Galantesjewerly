# 🏪 Galante's Jewelry — Integración Odoo Completa

## ✅ Estado: COMPLETADO

La integración de **Odoo 19 + Next.js + Cloudflare Zero Trust** está completamente configurada con dos entornos independientes:

- **PRODUCCIÓN** (Docker Local): https://galantesjewelry.com
- **TESTING** (Termux Android): https://test.galantesjewelry.com

---

## 📚 Documentación Completa

Para entender la arquitectura completa y configurar el sistema, lee los siguientes archivos en orden:

1. **`QUICKSTART-DEPLOYMENT.md`** ⭐ COMIENZA AQUI
   - Guía rápida en 5 minutos
   - Pasos para iniciar ambos entornos
   - Checklist de configuración

2. **`docs/ARCHITECTURE.md`** 📊 Diagrama completo
   - Visión general de TEST vs PROD
   - Arquitecturas detalladas de ambos entornos
   - Flujos de deployment
   - Sincronización entre entornos

3. **`infra/cloudflare/setup.sh`** 🔧 Setup automático
   - Script interactivo para Cloudflare Zero Trust
   - Instrucciones paso a paso (requiere UI manual)
   - Validación de conectividad

4. **`infra/cloudflare/config.json`** 📋 Configuración de referencia
   - Especificación de todos los públic hostnames
   - Políticas de seguridad
   - Reglas WAF
   - DNS records opcionales

---

## 🚀 Comenzar Ahora

### Opción 1: PRODUCCIÓN (Recomendado)

```bash
# 1. Preparar
cp .env.prod.example .env.prod
# Editar .env.prod con tus valores (tokens, secretos, etc.)
cp .env.prod .env

# 2. Ejecutar
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh

# 3. Esperar 2-3 minutos
# 4. Visitar: https://galantesjewelry.com
```

### Opción 2: TESTING (Termux Android)

```bash
# 1. En Termux:
chmod +x scripts/deploy-test.sh
cp .env.test.example .env.test
# Editar .env.test

# 2. Ejecutar
./scripts/deploy-test.sh

# 3. Esperar 1 minuto
# 4. Visitar: https://test.galantesjewelry.com
```

---

## 🎯 Qué Está Incluido

### Backend Odoo 19
- ✅ Módulo personalizado `galantes_jewelry`
- ✅ 4 endpoints REST para productos:
  - `GET /api/products` - Catálogo con paginación y filtros
  - `GET /api/products/<slug>` - Detalle de producto
  - `GET /api/products/featured` - Productos destacados
  - `GET /api/health` - Health check
- ✅ Modelos extendidos: material, slug, categorías
- ✅ Imágenes con URLs absolutas (Cloudflare ready)
- ✅ Sincronización automática de inventario

### Frontend Next.js 16
- ✅ Páginas estáticas: `/`, `/about`, `/collections`, `/contact`, etc.
- ✅ Shop dinámico:
  - `/shop` - Catálogo con filtros por categoría
  - `/shop/[slug]` - Detalle con galería de imágenes
  - `/collections` - Productos destacados
  - `/cart` - Redirect a checkout de Odoo
- ✅ Componentes reutilizables (ProductCard, ProductGrid)
- ✅ Error boundaries y fallbacks elegantes
- ✅ 31 tests: 2 unit + 19 functional + 10 E2E

### Infraestructura
- ✅ Nginx como reverse proxy (3 dominios)
- ✅ PostgreSQL para persistencia
- ✅ Cloudflare Zero Trust (2 túneles)
- ✅ Scripts de deployment automatizados
- ✅ Health checks en todos los servicios
- ✅ Logging estructurado (json-file, rotación)

### Seguridad
- ✅ TLS 1.2+ (Cloudflare automático)
- ✅ HSTS headers
- ✅ X-Frame-Options (SAMEORIGIN)
- ✅ Content-Type-Options (nosniff)
- ✅ Rate limiting (8 req/15min por IP)
- ✅ CORS configurado
- ✅ Headers de seguridad en Nginx

---

## 📈 Arquitetura Resumida

```
┌──────────────────────────────────────┐
│ Git Repository (Single Source)       │
│ - app/ (Next.js pages)               │
│ - odoo/addons/ (Módulo Odoo)        │
│ - infra/ (Config Nginx/Cloudflare)  │
└──────────────────────────────────────┘
          ↓
    ┌─────────────────┐
    │ Dos Entornos    │
    └─────────────────┘
          ↙       ↘
    ┌─────────┐  ┌──────────────┐
    │  TEST   │  │   PROD       │
    │(Termux) │  │  (Docker)    │
    └─────────┘  └──────────────┘
         ↓             ↓
    [Cloudflare Zero Trust — 2 Túneles]
         ↓             ↓
    [test.*]      [galantesjewelry.com]
         ↓             ↓
    [Pública]     [Pública Estable]
```

---

## 🔧 Stack Tecnológico

| Componente | Versión | Rol |
|-----------|---------|-----|
| **Next.js** | 16.2.3 | Frontend editorial + admin |
| **React** | 19.2.4 | UI framework |
| **TypeScript** | 5.x | Type safety |
| **Odoo** | 19 Enterprise | ERP backend |
| **PostgreSQL** | 15 Alpine | Database |
| **Nginx** | 1.27 Alpine | Reverse proxy |
| **Cloudflare** | Zero Trust | Tunneling + DNS |
| **Docker** | 25+ | Containerización |
| **Node.js** | 20+ (Termux: 18+) | Runtime |

---

## 📋 Archivos de Configuración

### Archivos Clave
- `.env.prod` - Variables para PROD (no en Git)
- `.env.test` - Variables para TEST (no en Git)
- `docker-compose.production.yml` - Composición Docker completa
- `infra/nginx/conf.d/galantes.conf` - Configuración Nginx (3 dominios)
- `infra/cloudflare/setup.sh` - Script de setup interactivo
- `infra/cloudflare/config.json` - Especificación de configuración

### Scripts de Deployment
- `scripts/deploy-prod.sh` - Deploy PROD (Docker)
- `scripts/deploy-test.sh` - Deploy TEST (Termux)

### Documentación
- `QUICKSTART-DEPLOYMENT.md` - Comienza aquí ⭐
- `docs/ARCHITECTURE.md` - Arquitectura detallada
- `ODOO_SETUP.md` - Setup Odoo desde cero
- `TESTING.md` - Cobertura de tests

---

## 🌍 URLs por Entorno

### PRODUCCIÓN (galantesjewelry.com)
```
Principal:  https://galantesjewelry.com
Shop:       https://shop.galantesjewelry.com
Odoo Admin: https://odoo.galantesjewelry.com
Local:      http://localhost:8080
```

### TESTING (test.galantesjewelry.com)
```
Principal:  https://test.galantesjewelry.com
Shop:       https://test-shop.galantesjewelry.com
Odoo Admin: https://test-odoo.galantesjewelry.com
Local:      http://127.0.0.1:3000 (Termux)
```

---

## 🔐 Requisitos de Configuración

Para que el sistema funcione, necesitas:

1. **Cloudflare Account**
   - Cuenta gratuita o Premium
   - Dominio verificado en Cloudflare
   - Nameservers actualizados en registrador

2. **Tokens Cloudflare**
   - `CF_TUNNEL_TOKEN_PROD` - Para Docker
   - `CF_TUNNEL_TOKEN_TEST` - Para Termux
   - `CF_API_TOKEN` (opcional - para automatización)

3. **Secretos y Credenciales**
    - `ADMIN_PASSWORD` - Panel de admin Next.js
    - `ODOO_PASSWORD` - Usuario admin de Odoo / bootstrap del contenedor
    - `ODOO_API_KEY` - API key JSON-2 usada por Next.js para sincronizar citas
    - `POSTGRES_PASSWORD` - Base de datos
    - Otros secretos generados con `openssl rand -base64 32`

4. **Integraciones Opcionales**
   - Google OAuth (para calendar/auth)
   - SendGrid (para emails)
   - Meta/Facebook (para sincronización de catálogo)

---

## 🧪 Testing

### Todos los Tests Incluidos

```bash
# Unit tests (2 tests)
npm run test

# E2E tests con Playwright (10 tests)
npx playwright test tests/playwright/shop-e2e.spec.ts

# Functional tests de API (19 tests)
pytest tests/functional/test_sales_flow.py

# Total: 31 tests
```

### Validar Setup

```bash
# PROD (Docker)
curl http://localhost:8080/api/health
curl http://localhost:8080/api/products | jq

# TEST (Termux)
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/products | jq
```

---

## 🛠️ Operaciones Comunes

### Ver Logs

```bash
# PROD
docker-compose -f docker-compose.production.yml logs -f web

# TEST
tail -f logs/nextjs.log
tail -f logs/cloudflared.log
```

### Actualizar Código

```bash
# Ambos entornos
git pull origin main

# PROD: Rebuild Docker
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# TEST: Rebuild Node.js
npm run build && npm start
```

### Backup de Base de Datos (PROD)

```bash
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U odoo galantes_db > backup.sql
```

---

## 🚨 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| `Connection refused` | Verifica que servicios están corriendo: `docker ps` |
| `Error 1016 Cloudflare` | Edita Public Hostnames en Cloudflare Dashboard |
| `NXDOMAIN` | Verifica nameservers del dominio |
| `Tunnel desconectado` | Reinicia con `scripts/deploy-*.sh` |
| `Odoo no inicia` | Espera 5+ min (primer boot es lento), revisa logs |
| `Productos no aparecen` | Verifica que `available_on_website` está checked en Odoo |

---

## 📞 Próximos Pasos

### Fase S5 (Hardening)
1. [ ] SSL/TLS certificates (Let's Encrypt integration)
2. [ ] WAF rules avanzadas
3. [ ] Rate limiting adicional
4. [ ] Backup automático diario
5. [ ] Monitoreo con Datadog/New Relic

### Fase S6 (Scale)
1. [ ] Load balancing (Nginx upstream)
2. [ ] Redis para caché
3. [ ] CDN para assets estáticos
4. [ ] Database replication

### Fase S7 (Automation)
1. [ ] GitHub Actions CI/CD
2. [ ] Automated deployments
3. [ ] Blue-green deployment strategy

---

## 📚 Referencias

- **Next.js Docs**: https://nextjs.org/docs
- **Odoo Docs**: https://www.odoo.com/documentation
- **Cloudflare Zero Trust**: https://developers.cloudflare.com/cloudflare-one/
- **Docker**: https://docs.docker.com/compose/
- **PostgreSQL**: https://www.postgresql.org/docs/

---

## ✨ Resumen Final

✅ **Integración Odoo**: Completada con REST API completa
✅ **Frontend**: Shop funcional con Next.js
✅ **Infraestructura**: Docker + Nginx + Cloudflare
✅ **Dual Ambiente**: TEST (Termux) y PROD (Docker)
✅ **Seguridad**: Zero Trust, TLS, headers, rate limiting
✅ **Testing**: 31 tests (unit + functional + E2E)
✅ **Documentación**: Completa y detallada

🚀 **Listo para producción!**

---

**Versión**: 2.0
**Fecha**: Abril 2026
**Responsable**: Agentes IA + Admin Manual
**Próxima revisión**: Después de primera semana en PROD
