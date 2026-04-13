# Deployment Checklist — Galante's Jewelry

## Pre-Deployment (Development)

### Local Testing
- [ ] Next.js builds locally: `npm run build`
- [ ] Tests pass: `npm run ci:test` or `npm run test`
- [ ] E2E tests pass: `npm run test:e2e` (or Selenium: `npm run test:selenium`)
- [ ] No TypeScript errors: `tsc --noEmit`
- [ ] ESLint passes: `npm run lint`
- [ ] Odoo runs: `cd odoo && docker-compose up -d && docker-compose ps`
- [ ] Shop pages load: `http://localhost:3000/shop` (even without Odoo API, graceful fallback)
- [ ] Editorial pages work: `/`, `/collections`, `/bridal`, `/admin/login`, etc.

### Code Review
- [ ] All changes committed to git
- [ ] Branch rebased on main (if applicable)
- [ ] No secrets committed (`.env` should not be in repo)
- [ ] No `console.log()` or debug code left
- [ ] Comments added for non-obvious logic

---

## Pre-Production (Staging)

### Environment Setup
- [ ] Create `.env` file with all required variables (use `.env.example` template)
- [ ] Verify all secrets populated:
  - [ ] `ADMIN_PASSWORD` (change from default)
  - [ ] `ADMIN_SECRET_KEY` (32+ chars, use `openssl rand -base64 32`)
  - [ ] `ODOO_PASSWORD` (change from default)
  - [ ] `META_ACCESS_TOKEN` (if using Meta integration)
  - [ ] `META_SYNC_TOKEN` (secure random token)
  - [ ] `CF_TUNNEL_TOKEN` (if using Cloudflare)
  - [ ] All Google/SMTP credentials

### Docker Composition
- [ ] `docker-compose.production.yml` reviewed
- [ ] All services configured (web, odoo, postgres, nginx)
- [ ] Networks properly connected
- [ ] Volumes mounted correctly (data, logs)
- [ ] Health checks defined for all services
- [ ] Restart policies set (always)
- [ ] Logging configured (10m max file, 3 file rotation)

### Nginx Configuration
- [ ] `infra/nginx/nginx.conf` updated
- [ ] `infra/nginx/conf.d/galantes.conf` created with 3 domains
- [ ] Virtual hosts configured:
  - [ ] galantesjewelry.com → web:3000
  - [ ] shop.galantesjewelry.com → odoo:8069
  - [ ] odoo.galantesjewelry.com → odoo:8069
- [ ] Security headers added (X-Frame-Options, CSP, HSTS)
- [ ] Caching headers configured (static assets 30d)
- [ ] WebSocket upgrade supported (for Odoo long-polling)

### SSL/HTTPS Setup
- [ ] Decision made: Let's Encrypt vs. Cloudflare vs. manual certs
- [ ] Certificates obtained and stored securely
- [ ] Nginx config updated with SSL directives
- [ ] Redirect HTTP → HTTPS configured
- [ ] HSTS header enabled

### Odoo Configuration
- [ ] Odoo database created and initialized
- [ ] galantes_jewelry addon installed
- [ ] Sample products created with images
- [ ] Product categories configured
- [ ] available_on_website flag set on test products
- [ ] Email/SMTP configured (for order notifications)
- [ ] Base domain set to shop.galantesjewelry.com

### Next.js Configuration
- [ ] `ODOO_BASE_URL` points to correct Odoo instance
- [ ] `META_ACCESS_TOKEN` and catalog ID valid
- [ ] `SITE_URL` correctly set to galantesjewelry.com
- [ ] `SHOP_URL` correctly set to shop.galantesjewelry.com
- [ ] Analytics/tracking IDs configured (if applicable)

### Data & Backup
- [ ] Database backup strategy in place (daily snapshots)
- [ ] Backup test: can we restore from backup?
- [ ] Data migration plan (if migrating from old system)
- [ ] Media/images backed up (odoo-data volume)

---

## Launch Day

### Pre-Flight Checks
- [ ] All services running: `docker-compose -f docker-compose.production.yml ps`
- [ ] Health checks passing:
  - [ ] Next.js: `curl http://localhost:3000/api/health`
  - [ ] Odoo: `curl http://localhost:8069`
  - [ ] Nginx: `curl http://localhost:80/healthz`
- [ ] DNS records updated:
  - [ ] galantesjewelry.com → your IP or Cloudflare
  - [ ] shop.galantesjewelry.com → same
  - [ ] odoo.galantesjewelry.com → same (or different if separate)
- [ ] SSL certificate valid (if HTTPS)

### Functional Testing
- [ ] **Editorial site**: 
  - [ ] Homepage loads (/)
  - [ ] Collections page loads (/collections)
  - [ ] Bridal collection loads (/bridal)
  - [ ] About, contact, privacy pages load
  - [ ] Admin login works (/admin/login)
  
- [ ] **Shop pages**:
  - [ ] /shop loads with products (if Odoo API implemented)
  - [ ] /shop/[slug] product detail loads
  - [ ] Images load correctly
  - [ ] "Add to Cart" button links to Odoo checkout
  
- [ ] **Odoo backend**:
  - [ ] odoo.galantesjewelry.com loads (may redirect to /web)
  - [ ] Can log in as admin
  - [ ] Products visible in Product menu
  - [ ] Can create/edit products
  
- [ ] **Meta integration**:
  - [ ] Test sync: `curl -X POST http://localhost:3000/api/integrations/meta/sync -H "Authorization: Bearer YOUR_TOKEN"`
  - [ ] Check Meta Catalog (if credentials provided)
  
- [ ] **Nginx routing**:
  - [ ] galantesjewelry.com resolves correctly
  - [ ] shop.galantesjewelry.com resolves correctly
  - [ ] odoo.galantesjewelry.com resolves correctly
  - [ ] Each routes to correct backend

### Performance Testing
- [ ] Page load times < 3s (homepage, shop listing, product detail)
- [ ] Images optimized (Next.js Image component used)
- [ ] Gzip compression enabled (nginx)
- [ ] Static assets cached (30d for Next.js, 1d for Odoo)
- [ ] No console errors in browser DevTools

### Security Testing
- [ ] Admin password not default
- [ ] Odoo password not default
- [ ] All secrets in `.env`, not hardcoded
- [ ] `.env` not committed to git
- [ ] Security headers present (X-Frame-Options, CSP, etc.)
- [ ] HTTPS working (if enabled)
- [ ] CORS configured correctly (if needed)
- [ ] API endpoints require auth (if applicable)

### Monitoring & Logging
- [ ] Logs accessible: `docker-compose logs -f` works
- [ ] Log rotation working (10m max, 3 files)
- [ ] Error logs being written
- [ ] Can monitor service health via healthchecks
- [ ] Optional: Set up log aggregation (ELK, Datadog, etc.)

---

## Post-Launch (Production)

### Week 1
- [ ] Monitor logs daily for errors
- [ ] Check performance metrics (response times, errors)
- [ ] Verify backups running automatically
- [ ] Test backup restore on staging environment
- [ ] Monitor Odoo database size growth
- [ ] Check for any authentication issues
- [ ] Verify email notifications working (orders, appointments)

### Ongoing
- [ ] Daily: Review error logs
- [ ] Weekly: Check disk space (logs, database, media)
- [ ] Weekly: Review Odoo order count / shop traffic
- [ ] Monthly: Full backup test & restore
- [ ] Monthly: Update dependencies (security patches)
- [ ] Monthly: Review Meta sync logs (any failed products?)
- [ ] Quarterly: Review cost & performance metrics

---

## Rollback Plan

If something breaks after launch:

### Option 1: Rollback Services
```bash
# Stop all services
docker-compose -f docker-compose.production.yml down

# Revert to previous docker-compose version
git checkout HEAD~1 docker-compose.production.yml

# Restore from database backup
# (specific commands depend on backup tool used)

# Restart services
docker-compose -f docker-compose.production.yml up -d
```

### Option 2: Rollback Code
```bash
# If Next.js code is broken:
git revert <commit-hash>
docker-compose -f docker-compose.production.yml up -d --build web

# If Odoo addon is broken:
git revert <commit-hash>
docker-compose -f docker-compose.production.yml up -d --build odoo
```

### Option 3: Switch to Previous Release (Blue-Green)
If you run multiple instances:
1. Keep previous version running on separate port
2. Update Nginx config to point to previous version
3. `docker-compose -f docker-compose.production.yml up -d nginx` (reload config)

---

## Common Issues & Fixes

### Issue: Nginx can't reach Next.js
**Symptom**: "502 Bad Gateway" on galantesjewelry.com

**Fix**:
```bash
# Check if web service is healthy
docker-compose -f docker-compose.production.yml ps web

# Check logs
docker-compose -f docker-compose.production.yml logs web

# Ensure web service is running
docker-compose -f docker-compose.production.yml up -d web
```

### Issue: Odoo won't start
**Symptom**: "connection refused" on odoo.galantesjewelry.com

**Fix**:
```bash
# Check database is running
docker-compose -f docker-compose.production.yml ps postgres

# Check Odoo logs
docker-compose -f docker-compose.production.yml logs odoo

# Restart database first
docker-compose -f docker-compose.production.yml restart postgres

# Wait 30s, then restart Odoo
docker-compose -f docker-compose.production.yml restart odoo
```

### Issue: Meta sync failing
**Symptom**: "401 Unauthorized" or "Catalog not found"

**Fix**:
- Verify `META_ACCESS_TOKEN` is valid (not expired)
- Verify `META_CATALOG_ID` is correct
- Check token permissions (should include `catalogs_management`)
- Run test sync with dryRun=true to see actual error

### Issue: Database disk space full
**Symptom**: Postgres won't start, or app hangs

**Fix**:
```bash
# Check disk space
docker system df

# Clean up old logs (be careful!)
docker exec galantes_db psql -U odoo -d galantes_db -c "VACUUM FULL;"

# Or prune docker (removes unused images/containers)
docker system prune -a --volumes
```

---

## Support Contacts

- **Next.js Issues**: Check docs/shop-integration-plan.md, docs/shop-cms-boundary.md
- **Odoo Issues**: Check odoo/README.md, Odoo docs (odoo.com/documentation)
- **Meta Issues**: Check docs/meta-capabilities.md, docs/meta-setup.md
- **Nginx Issues**: Check Nginx docs (nginx.org), Docker logs
- **Database Issues**: PostgreSQL docs, check postgres-data volume

---

## References

- [Deployment Architecture](docs/shop-integration-plan.md)
- [Nginx Configuration](infra/nginx/conf.d/galantes.conf)
- [Meta Setup Guide](docs/meta-setup.md)
- [Odoo Installation](odoo/README.md)
- [Implementation Log](docs/implementation-log.md)
