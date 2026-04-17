# Local Testing Guide — Galante's Jewelry

## Prerequisites

### 1. Start Docker Desktop
**Windows 11:**
- Open Windows Start Menu
- Search for "Docker Desktop"
- Click to launch it
- Wait for "Docker Engine started" message (usually 30–60 seconds)

**Verify Docker is running:**
```bash
docker --version
docker ps
```

### 2. Check Node.js (for Next.js development server)
```bash
node --version
npm --version
```

If not installed, download from [nodejs.org](https://nodejs.org) (v18+).

---

## Testing Strategy

### Option A: Full Stack (Docker Compose) — Recommended for MVP
Runs everything containerized:
- Next.js (port 3000)
- Odoo (port 8069)
- PostgreSQL (port 5432)
- Nginx proxy (port 8080)

**Advantage**: Closest to production  
**Time**: ~2–3 minutes to start

### Option B: Local Development
Run Next.js locally, docker services in containers:
- Next.js (port 3000) — `npm run dev`
- Odoo (port 8069) — `docker-compose -f odoo/docker-compose.yml up`
- Nginx (optional) — skip in dev

**Advantage**: Faster iteration, hot reload  
**Time**: ~1–2 minutes to start

---

## Option A: Full Stack Testing (Recommended)

### Step 1: Start All Services

```bash
# In project root directory
cd C:\Users\yoeli\Documents\Galantesjewerly

# Build and start all services
docker-compose -f docker-compose.production.yml up -d --build

# Wait 30–60 seconds for services to start
# Check status:
docker-compose -f docker-compose.production.yml ps
```

**Expected output:**
```
NAME              STATUS
galantes_web      Up (healthy)
galantes_odoo     Up (healthy)
galantes_db       Up (healthy)
galantes_nginx    Up (healthy)
```

### Step 2: Test Health Checks

```bash
# Test Next.js health
curl http://localhost:3000/api/health

# Test Nginx health
curl http://localhost:8080/healthz

# Test Odoo
curl http://localhost:8069
```

### Step 3: Test Frontend (Editorial Site)

**Open browser** and visit:

| URL | Expected | Purpose |
|-----|----------|---------|
| `http://localhost:8080` | Hero + sections | Homepage (editorial) |
| `http://localhost:8080/collections` | Collection list | Collections page |
| `http://localhost:8080/bridal` | Bridal items | Bridal collection |
| `http://localhost:8080/admin/login` | Login form | Admin login |

**Verification:**
- ✓ Page loads without 502 errors
- ✓ Images load
- ✓ Navigation links work
- ✓ No console errors (F12 → Console tab)

### Step 4: Test Shop Pages

**Open browser:**

| URL | Expected | Purpose |
|-----|----------|---------|
| `http://localhost:8080/shop` | "No Products Available" or grid | Shop listing |
| `http://localhost:8080/shop/test-product` | Product detail or 404 | Product detail |

**Expected behavior:**
- ✓ `/shop` loads (may show "No Products Available" until Odoo API is added)
- ✓ Loading skeleton visible for 1–2 seconds
- ✓ Responsive on mobile (F12 → toggle device toolbar)

### Step 5: Test Odoo Backend

**Open browser:**

`http://localhost:8069`

**Expected:**
- ✓ Odoo login page loads
- ✓ Default credentials work: `admin` / `admin`
- ✓ Can navigate to Products menu
- ✓ Database initialized (tables created)

**Create test product in Odoo:**
1. Log in: `admin` / `admin`
2. Menu → Products → Products
3. Click Create
4. Fill:
   - Name: "Test Ring - 14K Gold"
   - Category: Rings (or create)
   - Material: Gold
   - Price: 999.00
   - Upload image (optional)
   - Set `available_on_website = True`
5. Save

### Step 6: Test Next.js API Endpoints

```bash
# Test Odoo client (should return empty until API routes added)
curl http://localhost:3000/api/products 2>/dev/null || echo "Endpoint not yet implemented"

# Test Meta sync endpoint (should return auth error without token)
curl -X POST http://localhost:3000/api/integrations/meta/sync \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Expected: 401 Unauthorized (correct — requires valid token)
```

### Step 7: Check Logs

```bash
# View all logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service
docker-compose -f docker-compose.production.yml logs -f web
docker-compose -f docker-compose.production.yml logs -f odoo

# Exit: Ctrl+C
```

### Step 8: Stop Services

```bash
docker-compose -f docker-compose.production.yml down

# Remove volumes (clean slate):
docker-compose -f docker-compose.production.yml down -v
```

---

## Option B: Local Development Testing

### Step 1: Start Odoo Only

```bash
cd odoo
docker-compose up -d --build
docker-compose ps

# Wait for healthy status
```

### Step 2: Start Next.js Locally

```bash
# In project root
npm install  # if first time
npm run dev

# Output: "▲ Next.js X.X.X"
# Listen on http://localhost:3000
```

### Step 3: Test Frontend

Open `http://localhost:3000` (NOT through Nginx)

| URL | Expected |
|-----|----------|
| `http://localhost:3000` | Homepage loads |
| `http://localhost:3000/shop` | Shop listing (no products) |
| `http://localhost:3000/api/health` | `{"status":"ok"}` |

### Step 4: Update Odoo API Client

Edit `lib/odoo/client.ts`:
```ts
// Change line 37 from:
this.baseUrl = config.baseUrl || process.env.ODOO_BASE_URL || 'http://localhost:8069';

// To:
this.baseUrl = 'http://localhost:8069';  // Direct connection in dev
```

Then products will load from Odoo.

---

## Testing Checklist

### Frontend (Editorial + Shop)

- [ ] Homepage loads (`/`)
- [ ] Collections page loads (`/collections`)
- [ ] Bridal page loads (`/bridal`)
- [ ] About page loads (`/about`)
- [ ] Contact form visible (`/contact`)
- [ ] Admin login page loads (`/admin/login`)
- [ ] Shop page loads (`/shop`)
- [ ] Shop responsive (mobile viewport)
- [ ] Product cards visible (if products exist in Odoo)
- [ ] No 404 errors
- [ ] No 502 Bad Gateway errors
- [ ] Images load without issues
- [ ] Navigation links work
- [ ] Console shows no errors (F12)

### Backend (Odoo)

- [ ] Odoo admin loads (`http://localhost:8069`)
- [ ] Can log in with `admin` / `admin`
- [ ] Products menu accessible
- [ ] Can create product
- [ ] Can set `available_on_website = True`
- [ ] Product slug auto-generates
- [ ] Gallery images can be uploaded
- [ ] Database is initialized

### APIs

- [ ] Next.js health check: `curl http://localhost:3000/api/health`
- [ ] Nginx health check: `curl http://localhost:8080/healthz`
- [ ] Odoo responds: `curl http://localhost:8069`
- [ ] Odoo client (when API routes added): `curl http://localhost:3000/api/products`

### Docker

- [ ] All services healthy: `docker-compose ps`
- [ ] No critical errors in logs
- [ ] Services restart correctly: `docker-compose restart`
- [ ] Volumes persist data: Create product in Odoo, restart, product still there

---

## Common Issues & Fixes

### Issue: Docker not running
**Fix**: Start Docker Desktop (Windows Start Menu → Docker Desktop)

### Issue: "Port 3000 already in use"
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in docker-compose.production.yml
```

### Issue: "Connection refused" on Odoo
```bash
# Check if odoo service is healthy
docker-compose -f docker-compose.production.yml ps odoo

# View logs
docker-compose -f docker-compose.production.yml logs odoo

# Restart
docker-compose -f docker-compose.production.yml restart odoo
```

### Issue: Shop shows "No Products Available"
**This is normal!** Odoo API routes not yet implemented. Expected behavior:
- Shop pages load ✓
- Graceful fallback "No Products Available" ✓
- Once `/api/products` endpoint is added to Odoo, products will appear ✓

### Issue: Nginx 502 Bad Gateway
```bash
# Check Next.js is healthy
curl http://localhost:3000/api/health

# Check Odoo is running
curl http://localhost:8069

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

### Issue: Database won't initialize
```bash
# Remove old database volume
docker-compose -f docker-compose.production.yml down -v

# Restart fresh
docker-compose -f docker-compose.production.yml up -d --build
```

---

## Success Criteria

**You know testing is successful when:**

✓ Editorial site loads without errors  
✓ Shop pages load (with graceful "No Products" fallback)  
✓ Odoo admin panel loads  
✓ Can create/edit products in Odoo  
✓ Docker services stay healthy (no crashes)  
✓ No 502 errors  
✓ No console errors  
✓ All services communicate correctly  

---

## Next Steps After Testing

1. **Add Odoo API routes** (odoo/addons/galantes_jewelry/controllers/product_api.py)
   - Expose `/api/products` and `/api/products/{slug}`
   - Shop pages will immediately start loading real products

2. **Run Meta sync** (once API routes are ready)
   ```bash
   curl -X POST http://localhost:3000/api/integrations/meta/sync \
     -H "Authorization: Bearer your-sync-token" \
     -H "Content-Type: application/json" \
     -d '{"dryRun": true}'
   ```

3. **S5 Hardening** (SSL, final security checks)

---

## Support

If tests fail:
1. Check `docker-compose logs -f` for errors
2. Verify ports are not in use: `netstat -ano`
3. Ensure Docker Desktop is running and healthy
4. Check `.env` file has all required variables
5. Review `docs/deployment-notes.md` for troubleshooting

**Good luck! 🚀**
