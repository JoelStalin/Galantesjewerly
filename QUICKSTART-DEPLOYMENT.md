# Guía Rápida: Comienza Aquí

## 🎯 En 5 minutos

### Para PRODUCCIÓN (Docker Local)

```bash
# 1. Preparar archivos
cp .env.prod.example .env.prod
# Editar .env.prod y agregar:
#   - CF_TUNNEL_TOKEN_PROD (obtén de Cloudflare Dashboard)
#   - ADMIN_PASSWORD (algo seguro)
#   - ODOO_PASSWORD (admin de Odoo / bootstrap)
#   - ODOO_API_KEY (JSON-2 para sync de citas desde Next.js)
#   - POSTGRES_PASSWORD (algo seguro)

# 2. Copiar como .env para docker-compose
cp .env.prod .env

# 3. Iniciar
docker-compose -f docker-compose.production.yml up -d

# 4. Esperar 2-3 minutos
docker-compose -f docker-compose.production.yml logs -f

# 5. Acceder
# Local: http://localhost:8080
# Público: https://galantesjewelry.com (después de 30-60s)
```

### Para TESTING (Termux Android)

```bash
# 1. En Termux:
pkg install nodejs git

# 2. Clonar repo
git clone https://github.com/JoelStalin/galantesjewelry.git
cd galantesjewelry

# 3. Preparar archivo
cp .env.test.example .env.test
# Editar .env.test:
#   - CF_TUNNEL_TOKEN_TEST (obtén de Cloudflare Dashboard)
#   - ADMIN_PASSWORD

# 4. Ejecutar
chmod +x scripts/deploy-test.sh
./scripts/deploy-test.sh

# 5. Acceder
# Local: http://127.0.0.1:3000
# Público: https://test.galantesjewelry.com
```

---

## 🔧 Configurar Cloudflare (Pasos Manuales)

### 1️⃣ Login a Cloudflare Dashboard
- https://dash.cloudflare.com
- Selecciona dominio: galantesjewelry.com

### 2️⃣ Crear Túneles
Ir a: **Zero Trust → Networks → Tunnels**

Crear 2 túneles:

**Túnel 1: galantes-test**
- Click "Create a tunnel"
- Name: `galantes-test`
- Connector: Cloudflared
- Copy token to `.env.test`: `CF_TUNNEL_TOKEN_TEST=eyJhIjo...`

**Túnel 2: galantes-prod**
- Click "Create a tunnel"
- Name: `galantes-prod`
- Connector: Cloudflared
- Copy token to `.env.prod`: `CF_TUNNEL_TOKEN_PROD=eyJhIjo...`

### 3️⃣ Configurar Public Hostnames

#### Para galantes-test:
Click en "galantes-test" → "Public Hostname" tab → "Create public hostname"

| Subdomain | Domain | Service |
|-----------|--------|---------|
| test | galantesjewelry.com | http://127.0.0.1:3000 |
| test-shop | galantesjewelry.com | http://127.0.0.1:8069 |
| test-odoo | galantesjewelry.com | http://127.0.0.1:8069 |

#### Para galantes-prod:
Click en "galantes-prod" → "Public Hostname" tab → "Create public hostname"

| Subdomain | Domain | Service |
|-----------|--------|---------|
| (empty/apex) | galantesjewelry.com | http://nginx:80 |
| www | galantesjewelry.com | http://nginx:80 |
| shop | galantesjewelry.com | http://nginx:80 |
| odoo | galantesjewelry.com | http://nginx:80 |

### 4️⃣ Verificar Conexión
Espera 30-60 segundos, luego visita:
- https://galantesjewelry.com (PROD)
- https://test.galantesjewelry.com (TEST)

---

## 🔑 Generar Secretos

```bash
# ADMIN_SECRET_KEY, INTEGRATIONS_SECRET_KEY, etc.
openssl rand -base64 32
# Output: xR9pL2kM4vN8qA...

# Copiar a .env.prod y .env.test
```

---

## 📊 Verificar Estado

### PROD (Docker)
```bash
docker-compose -f docker-compose.production.yml ps
# Debería mostrar:
# galantes_web      running
# galantes_odoo     running
# galantes_db       running
# galantes_nginx    running
# galantes_tunnel_prod running

# Ver logs
docker-compose -f docker-compose.production.yml logs web
```

### TEST (Termux)
```bash
ps aux | grep -E 'node|cloudflared'
# Debería mostrar procesos Node.js y cloudflared

# Ver logs
tail -f logs/nextjs.log
tail -f logs/cloudflared.log
```

---

## 🧪 Testing Rápido

### Verificar APIs localmente

```bash
# PROD
curl http://localhost:8080/api/health
# { "status": "ok" }

# TEST
curl http://127.0.0.1:3000/api/health
# { "status": "ok" }
```

### Verificar Odoo API

```bash
# PROD
curl http://localhost:8080/api/products | jq
curl http://localhost:8080/api/products/featured | jq

# TEST (si Odoo local)
curl http://127.0.0.1:8069/api/products | jq
```

### Acceder a Odoo Admin

```
https://odoo.galantesjewelry.com (PROD)
https://test-odoo.galantesjewelry.com (TEST)

Username: admin
Password: (la configuraste en .env)
```

---

## ⚠️ Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Connection refused` | Servicio no está corriendo | Verifica `docker ps` o `ps aux` |
| `Error 1016` | Túnel apunta a dirección incorrecta | Edita Public Hostname en Cloudflare |
| `NXDOMAIN` | DNS no está configurado | Verifica nameservers en registrador |
| `504 Bad Gateway` | Nginx no puede alcanzar backend | Verifica salud de `docker ps` |
| `Tunnel disconnected` | Cloudflared perdió conexión | Reinicia: `./scripts/deploy-test.sh` |

---

## 📝 Workflow Típico

### 1️⃣ Hacer cambios en TEST
```bash
# En Termux
git checkout -b feature/my-feature
# Editar código
npm run build && npm start

# Probar en https://test.galantesjewelry.com
```

### 2️⃣ Validar cambios
```bash
# Run tests
npm run test
npm run test:e2e

# Verificar en navegador
```

### 3️⃣ Merge a PROD
```bash
git checkout main
git merge feature/my-feature
git push origin main

# En máquina PROD
git pull
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

### 4️⃣ Comunicar deployment
```bash
# Notificar a stakeholders
# https://galantesjewelry.com está actualizado ✅
```

---

## 🆘 Soporte Rápido

### Si nada funciona
```bash
# 1. Verificar si los servicios están corriendo
docker ps  # PROD
ps aux | grep node  # TEST

# 2. Ver logs
docker-compose -f docker-compose.production.yml logs  # PROD
tail -f logs/*.log  # TEST

# 3. Reiniciar todo
./scripts/deploy-prod.sh  # PROD
./scripts/deploy-test.sh  # TEST

# 4. Verificar variables de entorno
cat .env.prod | grep CF_TUNNEL  # PROD
cat .env.test | grep CF_TUNNEL  # TEST
```

### Documentación
- Arquitectura completa: `docs/ARCHITECTURE.md`
- Setup Cloudflare: `infra/cloudflare/setup.sh`
- Docker Compose: `docker-compose.production.yml`
- Env variables: `.env.prod`, `.env.test`

---

## ✅ Checklist Inicial

- [ ] Cloudflare nameservers activos
- [ ] 2 túneles creados (test, prod)
- [ ] Tokens obtendos y guardados en .env
- [ ] `.env.prod` y `.env.test` completados
- [ ] Docker iniciado (PROD)
- [ ] Node.js instalado (TEST)
- [ ] `scripts/deploy-*.sh` ejecutados
- [ ] URLs públicas accesibles
- [ ] Odoo admin funciona
- [ ] Shop muestra productos

---

**¿Necesitas ayuda?** Revisa:
1. `docs/ARCHITECTURE.md` - Arquitectura detallada
2. `infra/cloudflare/setup.sh` - Setup Cloudflare paso a paso
3. Logs: `docker-compose logs` o `tail -f logs/*.log`
