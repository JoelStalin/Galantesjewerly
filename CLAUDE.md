@AGENTS.md

# Galante's Jewelry - Proyecto Unificado

## Descripción del Proyecto
Sistema ERP completo para **Galante's Jewelry** basado en **Odoo 19** con integración Next.js.

## Estructura del Proyecto
```
Galantesjewerly/
├── odoo/
│   ├── addons/
│   │   └── galantes_jewelry/         ← Módulo Odoo personalizado
│   │       ├── controllers/
│   │       │   ├── __init__.py
│   │       │   └── product_api.py    ← API REST de productos
│   │       └── security/
│   │           └── ir.model.access.csv
│   ├── entrypoint.sh                 ← Script de auto-instalación Docker
│   └── initial_modules.txt           ← Lista de módulos a instalar
├── tests/
│   └── e2e/                          ← Tests end-to-end con Selenium
├── ODOO_SETUP.md                     ← Guía completa de setup
├── AGENTS.md                         ← Reglas para agentes AI
└── CLAUDE.md                         ← Este archivo
```

## Stack Tecnológico
- **Backend**: Odoo 19 (Enterprise) + Docker
- **API**: REST endpoints en `/api/products`, `/api/products/<slug>`
- **Frontend**: Next.js (integrado vía API)
- **Base de datos**: PostgreSQL (`galantes_db`)
- **Envíos**: EasyPost (FedEx, UPS, DHL)
- **Pagos**: Odoo Online Payments

## Módulos Odoo Instalados
- `account_reports`, `account_accountant` → Contabilidad
- `sale_enterprise`, `stock_enterprise` → Ventas e Inventario
- `website_enterprise`, `crm_enterprise` → Website y CRM
- `delivery_easypost` → Envíos multi-carrier
- `account_online_payment` → Pagos online
- `galantes_jewelry` → Módulo personalizado de joyería

## API Endpoints
- `GET /api/products` → Catálogo paginado (filtros: category, material)
- `GET /api/products/<slug>` → Producto por slug
- `GET /api/products/category/<category>` → Productos por categoría
- `GET /api/health` → Health check

## Docker
```bash
# Iniciar proyecto completo
docker-compose -f docker-compose.production.yml up -d --build

# Ver logs
docker-compose logs -f odoo

# URL de acceso
http://localhost:8069  (admin / admin)
```

## Enterprise Addons
Ubicación: `C:\Users\yoeli\Documents\cell_odoo\addons\enterprise`

## Reglas de Trabajo
- Siempre leer `ODOO_SETUP.md` antes de cambios de infraestructura
- Para tests E2E, seguir las reglas de `context/operations/testing_selenium_rules.md`
- Arquitectura de red documentada en `context/operations/termux_cloudflare_architecture.md`
- Hacer pruebas funcionales después de cada implementación

---

# Mega Prompt Maestro v3 - Appointment System Integration

## Current State
- **Phase**: 0 (Setup) - In Progress
- **Next**: Phase 1A (Google Calendar Core)
- **Status**: Directory structure created, memory initialized

## Key Rules for Appointments
- **API**: POST /api/v1/appointments (existing Next.js route)
- **Flow**: Validation → Odoo sync → Google Calendar → SendGrid email
- **Security**: 100% process.env, no hardcoded secrets
- **Memory**: Hot ≤200 lines, check `memory/current/now.md` first
- **Tasks**: Update `task-ledger/tasks.json` after changes
- **Testing**: ≥85% coverage, run tests after any change

## Critical Files
- `src/controllers/appointmentController.js` - Orchestrates appointment flow
- `src/services/calendarService.js` - Google Calendar integration
- `src/services/odooSyncService.js` - Odoo persistence
- `src/services/emailService.js` - SendGrid notifications
- `memory/current/now.md` - Current state (check before work)
- `task-ledger/tasks.json` - Task tracking

## CLI Orchestration
- **Providers**: Claude Code, Codex CLI, Gemini CLI
- **Fallback**: Automatic on quota/rate limit
- **Memory**: Preserve taskId across handoffs
- **Checkpoint**: Before each provider switch

## Emergency
- If blocked: Update `memory/current/blockers.md`
- If handoff needed: Use `task-ledger/handoffs.json`
- If memory corrupted: Rebuild from task-ledger + docs

See `AGENTS.md` for full rules, `memory/current/next-actions.md` for immediate tasks.
