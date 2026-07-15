# Arquitectura Final: TEST (Termux) vs PROD (Docker Local)

## 📊 Visión General

Galante's Jewelry ahora tiene dos entornos completamente separados pero sincronizados:

| Aspecto | TEST (Termux Android) | PROD (Docker Local) |
|--------|----------------------|-------------------|
| **Ubicación** | Android Termux | Docker Local (Windows/Mac/Linux) |
| **URL Principal** | https://test.galantesjewelry.com | https://galantesjewelry.com |
| **URL Shop** | https://test-shop.galantesjewelry.com | https://shop.galantesjewelry.com |
| **URL Odoo** | https://test-odoo.galantesjewelry.com | https://odoo.galantesjewelry.com |
| **Next.js** | Node.js directo (http://127.0.0.1:3000) | Docker (http://web:3000) |
| **Odoo** | Externo o Termux | Docker (http://odoo:8069) |
| **Nginx** | Cloudflared solo | Nginx + Cloudflared |
| **Cloudflare** | galantes-test túnel | galantes-prod túnel |
| **Propósito** | Experimental, cambios rápidos, testing | Producción estable |
| **Audiencia** | Desarrolladores | Usuarios finales |

---

## 🏗️ Arquitectura TEST (Termux Android)

```
┌─────────────────────────────────────────────────────────────┐
│ Android Termux (Edge Device)                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Node.js          │  │ Cloudflared      │               │
│  │ (puerto 3000)    │  │ Tunnel           │               │
│  └──────────────────┘  └──────────────────┘               │
│         ↓                      ↓                           │
│    Next.js Build          Conecta a:                      │
│    (Standalone)           CF Edge (Miami)                 │
│                                 ↓                         │
└─────────────────────────────────────────────────────────────┘
         ↓                                          ↓
    127.0.0.1:3000                    ┌───────────────────────┐
         ↓                            │ Cloudflare Dashboard  │
    ┌─────────────────────────┐       │ Zero Trust            │
    │  Cloudflare Zero Trust  │       │ (Public Hostnames)    │
    │  Tunnel: galantes-test  │──────→│                       │
    │                         │       └───────────────────────┘
    │  Public Hostnames:      │
    │  - test.*               │
    │  - test-shop.*          │
    │  - test-odoo.*          │
    └─────────────────────────┘
             ↓
    ┌──────────────────────────┐
    │ Internet Público         │
    │ https://test.*           │
    └──────────────────────────┘
```

### Características TEST:
- ✅ Cambios se despliegan rápidamente (`npm run build && npm start`)
- ✅ Sandbox separado de PROD
- ✅ Perfecto para QA y experimental features
- ✅ Bajo costo (hardware existing Termux)
- ⚠️ No ideal para alto traffic (dispositivo móvil)
- ⚠️ Requiere conexión estable (Cloudflare Tunnel)

---

## 🏗️ Arquitectura PROD (Docker Local)

```
┌─────────────────────────────────────────────────────────────┐
│ Docker Compose Local (Laptop/Server)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Next.js      │  │ Odoo 19      │  │ PostgreSQL   │     │
│  │ (web:3000)   │  │ (odoo:8069)  │  │ (db:5432)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↓                  ↓                 ↓              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Nginx Reverse Proxy (nginx:80)                      │  │
│  │ - Route /          → web:3000                       │  │
│  │ - Route /shop      → nginx → web → odoo:8069       │  │
│  │ - Route /web/*     → odoo:8069                      │  │
│  │ - WebSocket upgrade para Odoo longpolling          │  │
│  └─────────────────────────────────────────────────────┘  │
│         ↓                                                  │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Cloudflared Tunnel (cloudflared:container)       │     │
│  │ Token: CF_TUNNEL_TOKEN_PROD                      │     │
│  │ Routes:                                          │     │
│  │ - nginx:80 → galantesjewelry.com                │     │
│  │ - nginx:80 → www.galantesjewelry.com            │     │
│  │ - nginx:80 → shop.galantesjewelry.com           │     │
│  │ - nginx:80 → odoo.galantesjewelry.com           │     │
│  └──────────────────────────────────────────────────┘     │
│         ↓                                                  │
└─────────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────┐
    │  Cloudflare Zero Trust  │
    │  Tunnel: galantes-prod  │
    │                         │
    │  Public Hostnames:      │
    │  - galantesjewelry.com  │
    │  - www.*                │
    │  - shop.*               │
    │  - odoo.*               │
    └─────────────────────────┘
             ↓
    ┌──────────────────────────┐
    │ Internet Público         │
    │ https://galantesjewelry  │
    └──────────────────────────┘
```

### Características PROD:
- ✅ Completamente dockerizado (reproducible, escalable)
- ✅ Base de datos persistente (PostgreSQL en volumen Docker)
- ✅ Nginx como reverse proxy (caché, compresión, seguridad)
- ✅ Todos los servicios en red privada interna
- ✅ Ideal para producción estable
- ✅ Fácil de escalar (agregar más containers)
- ⚠️ Requiere más recursos (CPU, memoria)

---

## 🚀 Flujo de Deployment

### Deployment TEST (Termux)

```bash
# 1. Preparar entorno
cp .env.test.example .env.test
# Editar .env.test con CF_TUNNEL_TOKEN_TEST

# 2. Ejecutar script de deployment
chmod +x scripts/deploy-test.sh
./scripts/deploy-test.sh

# Output esperado:
# ✓ Node.js detectado
# ✓ Dependencias instaladas
# ✓ Build completado
# ✓ Cloudflared iniciado (PID: XXXX)
# ✓ Next.js iniciado (PID: YYYY)
# URLs:
#   Local: http://127.0.0.1:3000
#   Pública: https://test.galantesjewelry.com
```

### Deployment PROD (Docker)

```bash
# 1. Preparar entorno
cp .env.prod.example .env.prod
# Editar .env.prod con CF_TUNNEL_TOKEN_PROD y secretos

# 2. Copiar como .env para docker-compose
cp .env.prod .env

# 3. Ejecutar script de deployment
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh

# Output esperado:
# ✓ Variables verificadas
# ✓ Build completado
# ✓ Servicios iniciados
#   ✓ Nginx listo
#   ✓ Next.js listo
#   ✓ Odoo listo
#   ✓ Cloudflared listo
# URLs:
#   Local: http://localhost:8080
#   Pública: https://galantesjewelry.com
```

---

## 🔄 Sincronización entre TEST y PROD

### Código (Git)
```bash
# Ambos usan el mismo repositorio
git pull origin main  # TEST y PROD

# TEST: Cambios rápidos para experimentar
git checkout -b feature/new-component
npm run build && npm start  # Prueba en TEST

# Una vez validado, merge a main
git push origin feature/new-component
# PROD se actualiza con git pull
```

### Base de Datos (Odoo)
- **TEST**: Puede usar instancia Odoo separada (galantes_db_test)
- **PROD**: Usa galantes_db (datos reales)
- Sincronización: Manual via backup/restore si es necesario

### Secretos y Credenciales
```
.env.test       → Variables TEST (credenciales testing)
.env.prod       → Variables PROD (credenciales reales)
.env            → Symlink o copia de .env.prod (para docker-compose)

NUNCA commitear .env en Git!
```

---

## 🔐 Cloudflare Zero Trust Configuration

### Dos Túneles Independientes

#### Túnel TEST (galantes-test)
```
Origin: http://127.0.0.1:3000 (Termux localhost)
Public Hostnames:
  test.galantesjewelry.com → http://127.0.0.1:3000
  test-shop.galantesjewelry.com → http://127.0.0.1:8069 (si Odoo local)
  test-odoo.galantesjewelry.com → http://127.0.0.1:8069
```

#### Túnel PROD (galantes-prod)
```
Origin: http://nginx:80 (Docker internal)
Public Hostnames:
  galantesjewelry.com → http://nginx:80
  www.galantesjewelry.com → http://nginx:80
  shop.galantesjewelry.com → http://nginx:80
  odoo.galantesjewelry.com → http://nginx:80
```

### Ventajas de Zero Trust
- ✅ No necesitas abrir puertos en router/firewall
- ✅ Encriptación end-to-end (TLS 1.3)
- ✅ DDoS protection incluido
- ✅ Autenticación adicional (Cloudflare Teams)
- ✅ WAF (Web Application Firewall)
- ✅ Rate limiting integrado

---

## 📋 Checklist de Setup

### Requisitos Previos (Ambos)
- [ ] Cuenta Cloudflare con dominio galantesjewelry.com
- [ ] Nameservers de Cloudflare configurados en registrador
- [ ] Acceso a Cloudflare Zero Trust Dashboard

### Setup TEST (Termux)
- [ ] Node.js instalado en Termux (`pkg install nodejs`)
- [ ] Git clonado en Termux
- [ ] .env.test creado y poblado
- [ ] Token CF_TUNNEL_TOKEN_TEST generado
- [ ] `scripts/deploy-test.sh` ejecutado
- [ ] Verificar https://test.galantesjewelry.com

### Setup PROD (Docker Local)
- [ ] Docker instalado
- [ ] Docker Compose instalado
- [ ] .env.prod creado y poblado
- [ ] Token CF_TUNNEL_TOKEN_PROD generado
- [ ] `scripts/deploy-prod.sh` ejecutado
- [ ] Verificar https://galantesjewelry.com
- [ ] Odoo admin accesible en https://odoo.galantesjewelry.com

---

## 🛠️ Operaciones Comunes

### Ver logs

```bash
# TEST (Termux)
tail -f logs/nextjs.log
tail -f logs/cloudflared.log

# PROD (Docker)
docker-compose -f docker-compose.production.yml logs -f web
docker-compose -f docker-compose.production.yml logs -f odoo
docker-compose -f docker-compose.production.yml logs -f nginx
docker-compose -f docker-compose.production.yml logs -f cloudflared
```

### Actualizar código

```bash
# TEST
cd ~/galantesjewelry  # Termux
git pull
npm run build && npm start

# PROD
git pull
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

### Reiniciar servicios

```bash
# TEST
kill <PID_nextjs> <PID_cloudflared>
./scripts/deploy-test.sh

# PROD
docker-compose -f docker-compose.production.yml restart web
# o reiniciar todo:
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Backup de Odoo

```bash
# PROD (Docker)
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U odoo galantes_db > backup.sql

# Restaurar
docker-compose -f docker-compose.production.yml exec -T postgres psql -U odoo galantes_db < backup.sql
```

---

## 🚨 Troubleshooting

### Error 1016 en Cloudflare
**Causa**: Túnel no apunta a la dirección correcta
**Solución**:
- TEST: Verifica que es `http://127.0.0.1:3000`
- PROD: Verifica que es `http://nginx:80`

### NXDOMAIN
**Causa**: DNS no configurado
**Solución**: Verifica que Cloudflare nameservers están activos en registrador

### Tunnel disconnected
**Causa**: Cloudflared no está corriendo o perdió conexión
**Solución**:
- TEST: `pkill -f cloudflared && ./scripts/deploy-test.sh`
- PROD: `docker-compose -f docker-compose.production.yml restart cloudflared`

### Connection refused
**Causa**: El servicio backend (Next.js/Odoo) no está escuchando
**Solución**:
- TEST: `curl http://127.0.0.1:3000/api/health`
- PROD: `docker-compose -f docker-compose.production.yml exec web wget -O- http://127.0.0.1:3000/api/health`

---

## 📈 Escalabilidad Futura

### TEST → PROD Promotion
```bash
# Cuando TEST esté listo para producción:
git merge feature/new-component main
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

### Múltiples Instancias PROD
```bash
# Agregar Docker Compose override
docker-compose -f docker-compose.production.yml -f docker-compose.override.yml up -d

# Escalas: web, odoo, nginx
docker-compose -f docker-compose.production.yml up -d --scale web=3
```

### CI/CD Integration
```yaml
# GitHub Actions (future)
on: push to main
  - Build Docker image
  - Push a registry
  - Deploy a PROD
  - Run smoke tests
  - Notify Slack
```

---

## 📞 Contacto & Soporte

- **Preguntas sobre Cloudflare**: https://dash.cloudflare.com/support
- **Logs de deployment**: `scripts/deploy-*.sh` output
- **Documentación Odoo**: https://www.odoo.com/documentation
- **Documentación Next.js**: https://nextjs.org/docs

---

**Versión**: 1.0
**Última actualización**: Abril 2026
**Mantenedor**: Agentes IA + Admin Humano
