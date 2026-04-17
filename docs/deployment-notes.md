# Deployment Notes — Infrastructure & Networking

## Architecture Overview

```
┌─────────────────────────────────────┐
│         Internet / Customers         │
└─────────────┬───────────────────────┘
              │ (HTTPS)
              ▼
    ┌─────────────────────┐
    │  Nginx Reverse      │
    │  Proxy (Port 80)    │
    └──┬──────┬───────┬──┘
       │      │       │
       ▼      ▼       ▼
  Next.js   Odoo    Odoo
  Port 3000 Port 8069 Port 8069
  (Web)     (Shop)    (Backend)
```

## 3-Domain Routing

Nginx routes based on `Host` header:

| Domain | Backend | Purpose |
|--------|---------|---------|
| `galantesjewelry.com` | Next.js (port 3000) | Editorial + Admin |
| `shop.galantesjewelry.com` | Odoo (port 8069) | E-commerce storefront |
| `odoo.galantesjewelry.com` | Odoo (port 8069) | ERP backend interface |

**Note**: Both Odoo routes use port 8069, but Odoo uses different URL patterns internally to distinguish shop vs. admin.

---

## Docker Network

All services run on `galante-net` (bridge network):
- **web** (Next.js): internal IP `web:3000`
- **odoo** (Odoo 19): internal IP `odoo:8069`
- **postgres** (PostgreSQL): internal IP `postgres:5432`
- **nginx** (Reverse Proxy): internal IP, external port 8080 (default) or 80 (production)

### Internal Service Communication

Services can reach each other by service name:
- Next.js can call Odoo: `http://odoo:8069/api/...`
- Odoo can call Next.js: `http://web:3000/api/...`
- Both can reach PostgreSQL: `postgres:5432`

---

## SSL/HTTPS Setup

### Option 1: Let's Encrypt (Recommended)

Auto-renewing certificates via certbot:

1. **Install Certbot**:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. **Obtain Certificate**:
```bash
sudo certbot certonly --standalone -d galantesjewelry.com \
  -d shop.galantesjewelry.com \
  -d odoo.galantesjewelry.com
```

3. **Copy to Docker Volume**:
```bash
mkdir -p infra/ssl
sudo cp /etc/letsencrypt/live/galantesjewelry.com/fullchain.pem infra/ssl/cert.pem
sudo cp /etc/letsencrypt/live/galantesjewelry.com/privkey.pem infra/ssl/key.pem
sudo chown -R $(whoami) infra/ssl
```

4. **Update Nginx Config**:
Uncomment SSL directives in `infra/nginx/conf.d/galantes.conf`:
```nginx
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name galantesjewelry.com www.galantesjewelry.com;
    return 301 https://$server_name$request_uri;
}
```

5. **Auto-Renewal**:
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab (runs daily)
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet && docker-compose reload nginx
```

### Option 2: Cloudflare Tunnel (Easier)

If using Cloudflare (recommended for this project):

1. **In Cloudflare Dashboard**:
   - Create Tunnel: Zero Trust → Access → Tunnels → Create
   - Connect Cloudflare Tunnel
   - Route domains:
     - galantesjewelry.com → localhost:80 (or your server IP)
     - shop.galantesjewelry.com → localhost:80
     - odoo.galantesjewelry.com → localhost:80

2. **In Docker Compose**:
   - Uncomment `cloudflared` service
   - Set `CF_TUNNEL_TOKEN` env var
   - Enable with: `docker-compose -f docker-compose.production.yml --profile tunnel up -d`

3. **Benefits**:
   - No certificate management
   - DDoS protection
   - Automatic HTTPS
   - Works behind NAT/firewall

---

## DNS Configuration

### Using Route53 (AWS)
```
galantesjewelry.com         A record → your.server.ip
shop.galantesjewelry.com    CNAME → galantesjewelry.com
odoo.galantesjewelry.com    CNAME → galantesjewelry.com
```

### Using Cloudflare Nameservers
1. Add your domain to Cloudflare
2. Update nameservers at your registrar
3. Create DNS records:
   - galantesjewelry.com: A record to your IP
   - shop: CNAME to galantesjewelry.com
   - odoo: CNAME to galantesjewelry.com
4. Enable Cloudflare Tunnel (replaces IP routing)

---

## Environment Variables

### Required Variables

```env
# Core Settings
NODE_ENV=production
SITE_URL=https://galantesjewelry.com
SHOP_URL=https://shop.galantesjewelry.com
ODOO_URL=https://odoo.galantesjewelry.com

# Admin Credentials (change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password-here
ADMIN_SECRET_KEY=change-me-32-chars-minimum

# Odoo Configuration
ODOO_BASE_URL=http://odoo:8069
ODOO_DB=galantes_db
ODOO_USERNAME=admin
ODOO_PASSWORD=odoo-secure-password

# PostgreSQL (for Odoo)
POSTGRES_DB=galantes_db
POSTGRES_USER=odoo
POSTGRES_PASSWORD=postgres-secure-password

# Meta Integrations (if using)
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret
META_ACCESS_TOKEN=your-access-token
META_CATALOG_ID=your-catalog-id
META_SYNC_TOKEN=secure-sync-token

# Cloudflare (if using tunnel)
CF_TUNNEL_TOKEN=your-tunnel-token
```

### How to Generate Secure Tokens

```bash
# Generate 32-character random token
openssl rand -base64 32

# Or using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Store securely (never commit to git!)
echo "ADMIN_SECRET_KEY=$(openssl rand -base64 32)" >> .env
```

---

## Performance Optimization

### Nginx Caching
- Static assets (\_next/static): 30 days cache
- Odoo assets (/web/static): 30 days cache
- Product images (/web/image): 30 days cache
- API responses: No cache (dynamic)

### Database Optimization
- Run periodic VACUUM: `docker exec galantes_db vacuumdb -U odoo galantes_db`
- Monitor slow queries: Check Odoo logs
- Backup regularly: Daily snapshots recommended

### Application Optimization
- Next.js: Image optimization via `next/image` component
- Odoo: Enable caching in odoo.conf
- Nginx: Gzip compression enabled (6 level)

---

## Monitoring & Health Checks

### Health Check Endpoints

```bash
# Next.js health
curl http://localhost:3000/api/health

# Odoo health
curl http://localhost:8069

# Nginx health
curl http://localhost:80/healthz
```

### Docker Health Status

```bash
# Check all services
docker-compose -f docker-compose.production.yml ps

# Watch health in real-time
docker-compose -f docker-compose.production.yml ps --format "table {{.Service}}\t{{.Status}}"
```

### Log Monitoring

```bash
# Tail all logs
docker-compose -f docker-compose.production.yml logs -f

# Tail specific service
docker-compose -f docker-compose.production.yml logs -f nginx
docker-compose -f docker-compose.production.yml logs -f odoo
docker-compose -f docker-compose.production.yml logs -f web

# Show last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100
```

---

## Backup & Disaster Recovery

### Database Backup (PostgreSQL)

#### Manual Backup
```bash
# Dump entire database
docker exec galantes_db pg_dump -U odoo galantes_db > backup.sql

# Dump with compression
docker exec galantes_db pg_dump -U odoo -Fc galantes_db > backup.dump

# Restore from dump
docker exec -i galantes_db psql -U odoo galantes_db < backup.sql
```

#### Automated Backup (Daily)

Create `scripts/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/backups/galantes-jewelry"
mkdir -p "$BACKUP_DIR"

# Backup database
docker exec galantes_db pg_dump -U odoo galantes_db > "$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql"

# Backup volumes (optional, very large)
# tar -czf "$BACKUP_DIR/volumes-$(date +%Y%m%d).tar.gz" odoo-data/

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "db-*.sql" -mtime +7 -delete
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /path/to/scripts/backup.sh
```

### Media Backup (Images)

```bash
# Backup Odoo media volume
docker run --rm -v galantes_jewelry_odoo-data:/data -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/odoo-data-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v galantes_jewelry_odoo-data:/data -v $(pwd)/backups:/backup \
  alpine tar -xzf /backup/odoo-data-latest.tar.gz -C /
```

---

## Scaling (Future)

### Horizontal Scaling
- Run multiple Next.js instances behind Nginx load balancer
- Use managed database (RDS) instead of Docker Postgres
- Use CDN (CloudFront, Cloudflare) for static assets

### Vertical Scaling
- Increase Docker memory limits
- Increase Odoo workers in odoo.conf
- Enable Redis caching (Odoo)

### Multi-Region
- Use Cloudflare for global CDN
- Deploy to multiple regions if needed
- Use cross-region replication for database

---

## Support & Troubleshooting

See `docs/deployment-checklist.md` for common issues and fixes.

For specific services:
- **Next.js**: Check logs, verify ODOO_BASE_URL
- **Odoo**: Check odoo/README.md, verify database connectivity
- **Nginx**: Check `infra/nginx/conf.d/galantes.conf`, verify DNS
- **PostgreSQL**: Check docker logs, verify free disk space

---

## References

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/reference/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Odoo Deployment](https://www.odoo.com/documentation/19.0/administration/install/)
