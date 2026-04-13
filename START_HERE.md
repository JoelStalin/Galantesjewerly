# START HERE - Testing Galante's Jewelry Locally

## ⚠️ IMPORTANT: Start Docker Desktop FIRST

Your Docker Desktop is **not running yet**. Follow these steps:

---

## Step 1️⃣: Start Docker Desktop (Windows 11)

### Method 1: From Start Menu (Easiest)
1. **Open Windows Start Menu** (click Windows icon or press `Win` key)
2. **Type**: `docker`
3. **Click**: "Docker Desktop" (should appear in search results)
4. **Wait** for Docker to start (~30-60 seconds)
5. You should see a notification: **"Docker Engine started"**

### Method 2: From File Explorer
1. Open File Explorer
2. Navigate to: `C:\Program Files\Docker\Docker`
3. Double-click: `Docker Desktop.exe`
4. Wait for startup (~30-60 seconds)

### Method 3: Command Line Verification
Once Docker Desktop is running, open PowerShell or Command Prompt and run:

```powershell
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

If you see this, Docker is running ✓

---

## Step 2️⃣: Verify Docker is Ready

**Copy this command and paste into PowerShell/Command Prompt:**

```powershell
docker --version
docker ps
```

**Expected output:**
```
Docker version 29.3.0, build 5927d80
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

If you see both outputs, Docker is ready ✓

---

## Step 3️⃣: Start the Project

**Navigate to project directory:**

```powershell
cd C:\Users\yoeli\Documents\Galantesjewerly
```

**Start all services:**

```powershell
docker-compose -f docker-compose.production.yml up -d --build
```

**Expected output:**
```
[+] Building 0.1s (0/0)
[+] Running 4/4
  ✓ Container galantes_db is healthy
  ✓ Container galantes_odoo is healthy
  ✓ Container galantes_web is healthy
  ✓ Container galantes_nginx is healthy
```

**Note**: First time may take **2-3 minutes** as it downloads and builds images.

---

## Step 4️⃣: Check Services Are Running

**List all services:**

```powershell
docker-compose -f docker-compose.production.yml ps
```

**Expected output:**
```
NAME              STATUS              PORTS
galantes_db       Up (healthy)        5432/tcp
galantes_odoo     Up (healthy)        8069/tcp
galantes_web      Up (healthy)        3000/tcp
galantes_nginx    Up (healthy)        8080/tcp
```

All services should show `Up (healthy)` ✓

---

## Step 5️⃣: Test in Browser

Once all services are healthy, open your browser and test:

### Frontend Tests

| URL | Expected | Status |
|-----|----------|--------|
| http://localhost:8080 | Homepage loads | ☐ |
| http://localhost:8080/collections | Collections page | ☐ |
| http://localhost:8080/bridal | Bridal collection | ☐ |
| http://localhost:8080/shop | Shop page (no products yet) | ☐ |
| http://localhost:8080/admin/login | Admin login form | ☐ |
| http://localhost:8080/about | About page | ☐ |
| http://localhost:8080/contact | Contact page | ☐ |

### Backend Tests

| URL | Expected | Status |
|-----|----------|--------|
| http://localhost:8069 | Odoo login page | ☐ |
| http://localhost:8069/web/login | Odoo login (with credentials) | ☐ |

### Health Checks

**Copy these commands to test API health:**

```powershell
# Test Next.js
curl http://localhost:3000/api/health

# Test Nginx
curl http://localhost:8080/healthz

# Test Odoo
curl http://localhost:8069
```

**Expected**: All return `200 OK`

---

## Step 6️⃣: Create Test Product in Odoo

### Login to Odoo
1. Go to: http://localhost:8069
2. Username: `admin`
3. Password: `admin`
4. Click "Log in"

### Create Product
1. Menu → **Products** → **Products**
2. Click **Create** (blue button)
3. Fill in:
   - **Name**: `Test Ring - 14K Gold`
   - **Category**: Create "Rings" (click on field → Create)
   - **Material**: Select "Gold" (scroll in dropdown)
   - **Price**: `999.00`
   - **Upload Image** (optional): Click image field
4. Scroll to find: **Available on Website**
5. Check the checkbox ✓
6. Click **Save**

**Expected**: Product appears in list

---

## Step 7️⃣: View Logs (if something breaks)

**See what's happening:**

```powershell
# All logs
docker-compose -f docker-compose.production.yml logs -f

# Just Next.js
docker-compose -f docker-compose.production.yml logs -f web

# Just Odoo
docker-compose -f docker-compose.production.yml logs -f odoo

# Just database
docker-compose -f docker-compose.production.yml logs -f postgres

# Just Nginx
docker-compose -f docker-compose.production.yml logs -f nginx
```

**To exit logs**: Press `Ctrl+C`

---

## Troubleshooting

### Problem: Docker Desktop won't start
**Solution:**
1. Right-click taskbar → Task Manager
2. Look for Docker or similar process
3. If exists, end it
4. Try launching Docker Desktop again
5. If still fails, restart Windows

### Problem: "Port 8080 already in use"
**Solution:**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill the process (replace 1234 with actual PID)
taskkill /PID 1234 /F

# Try starting again
docker-compose -f docker-compose.production.yml up -d --build
```

### Problem: Services unhealthy or crashing
**Solution:**
```powershell
# Stop everything
docker-compose -f docker-compose.production.yml down

# Remove old volumes (fresh start)
docker-compose -f docker-compose.production.yml down -v

# Start fresh
docker-compose -f docker-compose.production.yml up -d --build

# Wait 2-3 minutes and check
docker-compose -f docker-compose.production.yml ps
```

### Problem: "Connection refused" on Odoo
**Solution:**
```powershell
# Wait longer (Odoo takes time to initialize)
# Check logs
docker-compose -f docker-compose.production.yml logs odoo

# Restart Odoo
docker-compose -f docker-compose.production.yml restart odoo

# Wait 60 seconds and try again
```

---

## ✅ Success Checklist

- [ ] Docker Desktop is running
- [ ] All 4 services show "Up (healthy)"
- [ ] Homepage loads at http://localhost:8080
- [ ] Shop page loads at http://localhost:8080/shop
- [ ] Odoo admin loads at http://localhost:8069
- [ ] Can log in to Odoo with admin/admin
- [ ] Can create a product in Odoo
- [ ] No 502 Bad Gateway errors
- [ ] No database connection errors

---

## 🎯 Next Steps

### If Everything Works ✓
1. **Test API endpoints** (see Step 5)
2. **Create more products** in Odoo
3. **Share screenshots** of working pages
4. **Proceed to deployment** (see `docs/deployment-checklist.md`)

### If Something Fails ✗
1. **Check logs** (see Step 7)
2. **Try restarting** the service
3. **Share the error message** with me
4. I'll help debug

---

## 📚 Documentation

- **Full Testing Guide**: `TESTING.md`
- **Deployment Checklist**: `docs/deployment-checklist.md`
- **Quick Start**: `QUICKSTART.md`

---

## 🚀 You're Ready!

**Run this now:**

```powershell
cd C:\Users\yoeli\Documents\Galantesjewerly
docker-compose -f docker-compose.production.yml up -d --build
```

**Then wait 2-3 minutes and visit:**
- http://localhost:8080 (Editorial site)
- http://localhost:8069 (Odoo admin)

**Let me know what you see!** 📸
