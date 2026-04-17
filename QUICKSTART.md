# Quick Start — Local Testing

## 🚀 Get Started in 5 Minutes

### Step 1: Start Docker Desktop (1 minute)

**Windows 11:**
1. Open Windows Start Menu
2. Type "Docker Desktop"
3. Click to launch
4. Wait for notification: "Docker Engine started"

**Verify:**
```bash
docker ps
```

### Step 2: Run the Test Script (3 minutes)

**Option A: Windows Batch Script (Easiest)**
```bash
cd C:\Users\yoeli\Documents\Galantesjewrely
scripts\test-localhost.bat
```

**Option B: PowerShell**
```powershell
cd C:\Users\yoeli\Documents\Galantesjewrely
bash scripts/test-localhost.sh
```

**Option C: Manual (Full Control)**
```bash
docker-compose -f docker-compose.production.yml up -d --build

# Wait 60-90 seconds for startup
# Then continue below
```

### Step 3: Access the Sites

Once services are running, open your browser:

| Site | URL | What to Test |
|------|-----|--------------|
| **Editorial** | http://localhost:8080 | Homepage, collections, admin panel |
| **Shop** | http://localhost:8080/shop | Shop pages (empty until API added) |
| **Odoo Admin** | http://localhost:8069 | ERP backend, create test product |

---

## ✅ Testing Checklist

### Frontend (Should All Load ✓)
- [ ] Homepage: http://localhost:8080
- [ ] Collections: http://localhost:8080/collections
- [ ] Bridal: http://localhost:8080/bridal
- [ ] Shop: http://localhost:8080/shop
- [ ] Admin Login: http://localhost:8080/admin/login
- [ ] About: http://localhost:8080/about
- [ ] Contact: http://localhost:8080/contact

**Expected**: All pages load without errors, responsive design works

### Backend (Odoo)
- [ ] Odoo loads: http://localhost:8069
- [ ] Can log in with `admin` / `admin`
- [ ] Products menu exists
- [ ] Can create a new product
- [ ] Can upload images
- [ ] Can set `available_on_website = True`

**Expected**: Odoo ERP fully functional

### Health Checks
```bash
# All should return 200 OK

curl http://localhost:3000/api/health          # Next.js
curl http://localhost:8080/healthz             # Nginx
curl http://localhost:8069                     # Odoo
```

---

## 🧪 What's Being Tested

### Architecture ✓
- Next.js running on port 3000
- Odoo running on port 8069
- PostgreSQL database initialized
- Nginx routing 3 domains (localhost acts as all 3)

### Frontend ✓
- Editorial pages load correctly
- Shop pages load (with graceful fallback)
- Navigation works
- Images load
- No console errors
- Responsive design

### Backend ✓
- Odoo database initialized
- Admin login works
- Product creation works
- All services stay healthy (no crashes)

### Integration (Partial)
- ⚠️ Odoo API endpoints not yet implemented
- ⚠️ Shop pages show "No Products Available" (expected)
- ⚠️ Meta sync awaits credentials

---

## 📊 Expected Results

### ✓ Success Indicators
- All 4 services healthy: `docker-compose ps` shows all "Up"
- Editorial site loads without errors
- Shop pages load (even if empty)
- Odoo admin panel accessible
- No 502 Bad Gateway errors
- No database connection errors

### ⚠️ Known Limitations (Expected)
- Shop pages show "No Products Available" — Odoo API routes not yet added
- Meta sync endpoint requires auth token — will return 401 without it
- Admin pages may show some test data — this is normal for first run

---

## 🛠️ Common Problems & Fixes

### Docker Desktop Not Running
```
❌ Error: "docker daemon not running"
✓ Fix: Open Windows Start Menu → Docker Desktop → Launch
```

### Port Already in Use
```
❌ Error: "bind: address already in use"
✓ Fix: Change port in docker-compose.production.yml or kill existing process:
   taskkill /PID <process_id> /F
```

### Services Not Starting
```
❌ Error: "docker build failed"
✓ Fix: Check Docker logs and disk space:
   docker-compose logs
   docker system df
```

### Connection Refused
```
❌ Error: "connection refused" on localhost:8069
✓ Fix: Wait longer (up to 2 minutes) or check logs:
   docker-compose logs odoo
```

---

## 🎯 Next Steps After Testing

### If Everything Works:
1. **Add Odoo API Routes** ← Shop will load real products
   ```
   Create: odoo/addons/galantes_jewelry/controllers/product_api.py
   ```

2. **Set Up Credentials** for Meta integration
   ```
   Edit .env: META_ACCESS_TOKEN, META_CATALOG_ID, META_APP_ID
   ```

3. **Deploy** to production
   ```
   See: docs/deployment-checklist.md
   ```

### If Something Fails:
1. Check logs: `docker-compose logs -f`
2. Restart service: `docker-compose restart <service>`
3. Review `TESTING.md` for detailed troubleshooting
4. Check `docs/deployment-notes.md` for infrastructure help

---

## 📖 Documentation

- **Full Testing Guide**: `TESTING.md`
- **Deployment Checklist**: `docs/deployment-checklist.md`
- **Infrastructure Notes**: `docs/deployment-notes.md`
- **Testing Script Source**: `scripts/test-localhost.sh` (bash) or `scripts/test-localhost.bat` (Windows)

---

## ⏱️ Time Estimates

| Task | Time |
|------|------|
| Start Docker Desktop | 30–60 sec |
| Run test script | 1–2 min |
| Wait for services | 60–90 sec |
| Total | **3–4 minutes** |

---

## 🎉 You're Ready!

Run the test script and let me know what you see:

```bash
# Windows
scripts\test-localhost.bat

# macOS/Linux
bash scripts/test-localhost.sh
```

I'll help debug any issues that come up! 🚀
