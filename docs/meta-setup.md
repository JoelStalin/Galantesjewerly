# Meta Integration Setup Guide

## Prerequisites

### Meta Business Requirements
- Facebook Business Manager account
- Instagram Business Account (linked to Facebook)
- WhatsApp Business Account
- Meta Commerce Manager access
- Product Catalog created in Commerce Manager

### Galante's Jewelry Requirements
- Odoo running with galantes_jewelry addon
- Next.js running with meta.ts integration
- Environment variables configured (.env)

---

## Step 1: Create Meta Business Infrastructure

### 1.1 Set Up Facebook Business Manager
1. Go to [business.facebook.com](https://business.facebook.com)
2. Create Business Manager (if not already done)
3. Add your Facebook Page
4. Add your Instagram Business Account
5. Add your WhatsApp Business Account

### 1.2 Create Product Catalog
1. Go to Commerce Manager (admin.facebook.com/commerce)
2. Click **Catalogs** → **Create Catalog**
3. Choose **Product Catalog**
4. Name it: `Galantes Jewelry`
5. Currency: USD
6. Country: US
7. Industry: Fashion/Jewelry
8. Click **Create**

### 1.3 Note Your IDs
Copy these to `.env`:
- **Catalog ID**: `Meta_CATALOG_ID`
  - Location: Catalog Settings → Catalog ID
- **App ID**: `META_APP_ID`
  - Location: Settings → Apps (or Business Manager)
- **Page ID**: `FACEBOOK_PAGE_ID`
  - Location: Facebook Page Settings → Page ID
- **Instagram Business Account ID**: `INSTAGRAM_BUSINESS_ACCOUNT_ID`
  - Location: Instagram Business Settings → Account ID

---

## Step 2: Generate Access Token

### 2.1 Create an App (if needed)
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps** → **Create App**
3. Choose **Business** type
4. Fill in app details
5. Accept terms
6. Click **Create App**

### 2.2 Generate Token
1. In your app, go to **Tools** → **Graph API Explorer**
2. Select your app from dropdown
3. Select your Business Manager account
4. Generate access token:
   - Click "Generate Access Token" button
   - Select permissions: `catalogs_management`, `pages_manage_metadata`
5. Copy the token

### 2.3 Create Long-Lived Token (Production)
Short-lived tokens expire after ~1 hour. For production:

```bash
curl -i -X GET "https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}"
```

**Better**: Use App Role in Business Manager
1. Go to Business Manager Settings
2. Users → Add System User
3. Assign Business Catalog Manager role
4. Generate new token from System User

---

## Step 3: Configure Environment Variables

Update `.env.local` (or production `.env`):

```env
# Meta API
META_APP_ID=YOUR_APP_ID_HERE
META_APP_SECRET=YOUR_APP_SECRET_HERE
META_ACCESS_TOKEN=YOUR_LONG_LIVED_TOKEN_HERE
META_CATALOG_ID=YOUR_CATALOG_ID_HERE
META_VERIFY_TOKEN=random_token_for_webhook_verification

# Meta IDs (for reference / reporting)
FACEBOOK_PAGE_ID=YOUR_PAGE_ID_HERE
INSTAGRAM_BUSINESS_ACCOUNT_ID=YOUR_INSTAGRAM_ID_HERE
WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_WHATSAPP_ID_HERE

# Sync Authorization (for /api/integrations/meta/sync endpoint)
META_SYNC_TOKEN=your-secure-sync-token-change-me
```

**Never commit these secrets to git.** Use `.env.local` or CI/CD secrets management.

---

## Step 4: Test the Integration

### 4.1 Manual Sync Test (Dry Run)

```bash
# Test sync without making changes
curl -X POST http://localhost:3000/api/integrations/meta/sync \
  -H "Authorization: Bearer your-secure-sync-token-change-me" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Expected response**:
```json
{
  "success": true,
  "message": "[DRY RUN] No changes were made",
  "summary": {
    "totalProducts": 5,
    "synced": 5,
    "failed": 0,
    "timestamp": "2026-04-13T12:00:00Z"
  },
  "errors": []
}
```

### 4.2 Check Catalog Status

```bash
curl -X GET http://localhost:3000/api/integrations/meta/sync \
  -H "Authorization: Bearer your-secure-sync-token-change-me"
```

**Expected response**:
```json
{
  "catalogId": "YOUR_CATALOG_ID",
  "productCount": 0,
  "lastUpdated": null,
  "ready": true
}
```

### 4.3 Real Sync (With Changes)

```bash
# Actually sync products to Meta Catalog
curl -X POST http://localhost:3000/api/integrations/meta/sync \
  -H "Authorization: Bearer your-secure-sync-token-change-me" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

**After sync:**
1. Go to Meta Catalog (Commerce Manager)
2. Products tab
3. You should see all Odoo products (available_on_website=True)

---

## Step 5: Connect Catalog to Facebook Shop

### 5.1 Facebook Shop Setup
1. Go to your Facebook Page
2. Settings → Shops → Create Shop
3. Select Catalog: **Galantes Jewelry**
4. Upload shop banner image
5. Set shop description
6. Save & publish

### 5.2 Instagram Shopping Setup
1. Go to Instagram Business Settings
2. Shopping → Edit Catalog
3. Select: **Galantes Jewelry**
4. Save

### 5.3 WhatsApp Catalog Setup
1. Go to WhatsApp Business settings
2. Catalog → Edit
3. Select: **Galantes Jewelry**
4. Save

**Note**: WhatsApp catalog appears in Catalog tab of WhatsApp Business app (mobile-only).

---

## Step 6: Set Up Daily Sync (Cron)

### Option A: Using GitHub Actions (if deployed to Vercel)

Create `.github/workflows/meta-sync.yml`:

```yaml
name: Meta Catalog Sync
on:
  schedule:
    - cron: '0 0 * * *' # Every day at midnight UTC
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync Odoo to Meta
        run: |
          curl -X POST ${{ secrets.DEPLOYMENT_URL }}/api/integrations/meta/sync \
            -H "Authorization: Bearer ${{ secrets.META_SYNC_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"dryRun": false}'
```

### Option B: Using node-cron (self-hosted)

Install package:
```bash
npm install node-cron
```

Create `scripts/meta-sync-cron.js`:

```javascript
const cron = require('node-cron');
const fetch = require('node-fetch');

// Run daily at 00:00 UTC
cron.schedule('0 0 * * *', async () => {
  console.log('Running Meta Catalog sync...');
  try {
    const response = await fetch(
      'http://localhost:3000/api/integrations/meta/sync',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.META_SYNC_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: false }),
      }
    );
    const result = await response.json();
    console.log('Sync result:', result);
  } catch (error) {
    console.error('Sync failed:', error);
  }
});

console.log('Meta Catalog sync scheduled (daily 00:00 UTC)');
```

Add to package.json scripts:
```json
{
  "scripts": {
    "cron": "node scripts/meta-sync-cron.js"
  }
}
```

### Option C: Manual Trigger via Dashboard (Post-MVP)

Build admin panel button:
```tsx
<button onClick={async () => {
  const res = await fetch('/api/integrations/meta/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${syncToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dryRun: false }),
  });
  const result = await res.json();
  console.log(result);
}}>
  Sync to Meta Now
</button>
```

---

## Step 7: Verify Everything Works

### 7.1 Create Test Product in Odoo
1. Log in to Odoo: `http://localhost:8069`
2. Products → Create
3. Name: "Test Ring - 14K Gold"
4. Price: 999.00
5. Category: Rings
6. Material: Gold
7. Upload image
8. Set `available_on_website = True`
9. Save

### 7.2 Run Sync
```bash
curl -X POST http://localhost:3000/api/integrations/meta/sync \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

### 7.3 Verify in Meta
1. Go to Commerce Manager → Catalogs → **Galantes Jewelry** → **Products**
2. Search for "Test Ring"
3. Verify: name, price, image, description all correct

### 7.4 Verify in Facebook
1. Go to your Facebook Page
2. Visit Shop
3. Should see "Test Ring - 14K Gold"
4. Click product → verify details

### 7.5 Verify in Instagram
1. Create a post on Instagram Business Account
2. Click "Tag products"
3. Select "Test Ring - 14K Gold"
4. Post should show product tag with name & price

### 7.6 Verify in WhatsApp
1. Open WhatsApp Business app (mobile)
2. Go to Catalog tab
3. Should see "Test Ring - 14K Gold"

---

## Monitoring & Logging

### Log File Location
- Sync logs: `console` output (visible in `npm run dev` or server logs)
- Format: `[Meta Sync] { timestamp, dryRun, totalProducts, successCount, failureCount, errors }`

### Common Errors & Fixes

#### Error: "Unauthorized"
- Check `META_SYNC_TOKEN` matches request header
- Verify `META_ACCESS_TOKEN` is valid and non-expired

#### Error: "No products found to sync"
- Ensure Odoo products have `available_on_website = True`
- Check Odoo database has products
- Run Odoo at `http://localhost:8069`

#### Error: "Meta configuration incomplete"
- Missing `META_ACCESS_TOKEN`, `META_CATALOG_ID`, or `META_APP_ID`
- Check `.env` file
- Verify token is still valid (may have expired)

#### Error: "Product image URL must use HTTPS"
- Odoo images must be served over HTTPS
- Workaround: Generate signed HTTPS URLs in Odoo addon
- Verify image URLs start with `https://`

#### Partial Sync (Some products fail)
- Check error details in response
- Common causes: missing image, invalid price, name too long
- Fix in Odoo, re-run sync

---

## Post-MVP Enhancements

### 1. Real-time Sync via Webhooks
Instead of daily cron, use Odoo webhooks:
```python
# In Odoo addon galantes_jewelry
def _notify_meta_on_change(self):
    """Webhook to notify shop when product changes"""
    requests.post(
        'https://shop.galantesjewelry.com/api/integrations/meta/sync',
        headers={'Authorization': f'Bearer {SYNC_TOKEN}'},
        json={'productId': self.id, 'dryRun': False}
    )
```

### 2. Conversion Tracking
Add Facebook Pixel to shop pages:
```html
<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};...}
</script>
```

### 3. Dynamic Product Ads (DPA)
Run ads directly from catalog:
1. Go to Ads Manager
2. Create campaign → Choose objective "Catalog Sales"
3. Select **Galantes Jewelry** catalog
4. Let Meta automatically show best products to audience

### 4. Advanced Reporting
Query Meta Insights API to track:
- Which products get most clicks
- Conversion rate by product
- Traffic source (Facebook vs Instagram)

---

## Support

For issues:
1. Check `docs/meta-capabilities.md` (what's supported)
2. Check logs: `docker-compose logs` or `npm run dev` output
3. Test endpoint: `curl` the `/api/integrations/meta/sync` directly
4. Check `.env` variables
5. Review `lib/integrations/meta.ts` implementation
6. Escalate to WS-A (Orchestrator) if stuck

---

## References

- [Meta Catalog API Docs](https://developers.facebook.com/docs/marketing-api/catalog)
- [Facebook Shop Setup](https://www.facebook.com/business/help/898752960195806)
- [Instagram Shopping](https://help.instagram.com/1187859655048534)
- [WhatsApp Catalog](https://www.whatsapp.com/business/catalog)
