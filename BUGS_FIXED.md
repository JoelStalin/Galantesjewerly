# Bugs Found and Fixed — Galantes Jewelry Integration Audit

**Audit Date:** 2026-04-15
**Scope:** Phase 1D Odoo Integration — Appointment flow (Google Calendar → Odoo → Email)
**Files Audited:** 20+ TypeScript, Python, and configuration files

---

## Bug 1 — CRITICAL: Odoo addon fails to load (ModuleNotFoundError)

**File:** `odoo/addons/galantes_jewelry/__init__.py`
**Severity:** Critical — entire addon fails to install/load

**Root Cause:**
`from . import views` was present, but `views/` contains only XML files with no `__init__.py`. Python cannot import a directory as a module without one. This caused a `ModuleNotFoundError` at addon load time.

**Before:**
```python
from . import models
from . import views      # ← crashes on import
from . import controllers
```

**After:**
```python
from . import models
from . import controllers
# NOTE: views are XML files loaded via __manifest__.py 'data' key — no Python import needed
```

---

## Bug 2 — CRITICAL: Appointment datetime format rejected by Odoo

**File:** `odoo/addons/galantes_jewelry/models/appointment.py`
**Severity:** Critical — all appointment syncs from Next.js fail silently

**Root Cause:**
Next.js sends ISO 8601 datetimes (`"2026-04-15T14:00:00.000Z"`). Odoo's `fields.Datetime` requires `"YYYY-MM-DD HH:MM:SS"` (naive UTC). The `create_from_api` method passed the raw string directly, causing Odoo to reject the write with a validation error.

**Before:**
```python
'appointment_datetime': appointment_datetime,  # raw ISO string from API
'appointment_end': values.get('appointment_end'),
```

**After:**
Added `_parse_api_datetime()` helper that handles all ISO 8601 variants and converts to naive UTC:
```python
def _parse_api_datetime(value):
    """Convert ISO-8601 or Odoo datetime strings to naive UTC datetime for fields.Datetime."""
    ...
    for fmt in ('%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ',
                '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValidationError(f'Invalid datetime format: {value!r}')

# In create_from_api:
'appointment_datetime': _parse_api_datetime(appointment_datetime),
'appointment_end': _parse_api_datetime(values.get('appointment_end')),
```

---

## Bug 3 — CRITICAL: Product API returns JSON-RPC envelope, shop shows no products

**File:** `odoo/addons/galantes_jewelry/controllers/product_api.py`
**Severity:** Critical — shop pages always display empty product list

**Root Cause:**
All three routes used `type='json'`. In Odoo, `type='json'` wraps the return value in a JSON-RPC envelope:
```json
{"jsonrpc": "2.0", "id": null, "result": {...}}
```
`lib/odoo/client.ts` reads `response.data` and `response.data.data` directly. The actual data is at `response.result.data`, so `client.ts` always received `undefined` and returned empty arrays.

**Before:**
```python
@http.route('/api/products', auth='public', methods=['GET'], type='json', csrf=False)
def get_products(self, ...):
    return {'success': True, 'data': [...], 'pagination': {...}}
```

**After:**
```python
@http.route('/api/products', auth='public', methods=['GET'], type='http', csrf=False)
def get_products(self, ...):
    return request.make_json_response({'success': True, 'data': [...], 'pagination': {...}})
```

Applied to all three routes: `/api/products`, `/api/products/<slug>`, `/api/health`.
Error responses also upgraded to return proper HTTP status codes (404, 500).

---

## Bug 4 — Runtime: Google Calendar auth cache never expires (stale token)

**File:** `lib/google-calendar.ts`
**Severity:** High — OAuth tokens cached forever, causing auth failures after token rotation/revocation

**Root Cause:**
`authClientCache` stored raw clients with no expiry. Tokens are valid for 1 hour (OAuth) or a few hours (JWT), but the cache had no TTL, so expired tokens would be reused indefinitely causing 401 errors from Google APIs.

**Before:**
```ts
const authClientCache = new Map<string, OAuth2Client | JWT>();
// No TTL check — cached forever
```

**After:**
```ts
const OAUTH_CACHE_TTL_MS = 45 * 60 * 1000;   // 45 min (shorter than 60 min token lifetime)
const JWT_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours for service accounts

const authClientCache = new Map<string, { client: OAuth2Client | JWT; expiresAt: number }>();

// Check with expiry:
const cached = authClientCache.get(key);
if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
}

// Cache with TTL:
authClientCache.set(key, { client: oauth2Client, expiresAt: Date.now() + OAUTH_CACHE_TTL_MS });
```

Additionally: OAuth refresh failures now evict the stale cache entry before re-throwing:
```ts
} catch (err) {
    authClientCache.delete(key); // evict so next request retries fresh
    throw err;
}
```

---

## Bug 5 — Runtime: Calendar misconfiguration returns 500 instead of 503

**File:** `lib/appointment-flow.ts`
**Severity:** Medium — poor error UX when Google Calendar is not set up

**Root Cause:**
When Google Calendar integration is disabled or credentials are incomplete, the thrown error message contained phrases like "is disabled" or "not configured". This fell through to the generic 500 catch block with a misleading "We could not create the appointment" message.

**Before:**
No distinction between configuration errors and transient failures — all caught errors returned 500.

**After:**
Added `isServiceUnavailableError()` detector and a 503 return path:
```ts
function isServiceUnavailableError(message: string) {
  return (
    message.includes('not configured') ||
    message.includes('is disabled') ||
    message.includes('disabled by configuration') ||
    message.includes('configuration is incomplete') ||
    message.includes('is not connected')
  );
}

// In catch block:
if (isServiceUnavailableError(message)) {
  return {
    statusCode: 503,
    body: {
      error: 'Online booking is temporarily unavailable. Please contact the boutique directly and we will arrange your visit.',
    },
  };
}
```

---

## Bug 6 — Privacy: Hardcoded personal email in integrations.ts

**File:** `lib/integrations.ts`
**Severity:** Medium — personal email committed to source code, used as fallback sender/recipient

**Root Cause:**
Default email addresses were hardcoded strings:
```ts
const DEFAULT_GMAIL_SENDER = 'joelstalin2105@gmail.com';
const DEFAULT_GMAIL_RECIPIENT = 'ceo@galantesjewelry.com';
```

**After:**
```ts
const DEFAULT_GMAIL_SENDER = process.env.GMAIL_SMTP_USER || '';
const DEFAULT_GMAIL_RECIPIENT = process.env.GMAIL_NOTIFICATION_TO || 'appointments@galantesjewelry.com';
```

---

## Bug 7 — Privacy: Hardcoded personal email in mailer.ts

**File:** `lib/mailer.ts`
**Severity:** Medium — same personal email leaked into mailer fallback defaults

**Root Cause:**
```ts
sender: config.sender || 'joelstalin2105@gmail.com',
recipientInbox: config.recipientInbox || 'ceo@galantesjewelry.com',
```

**After:**
```ts
sender: config.sender || process.env.GMAIL_SMTP_USER || '',
recipientInbox: config.recipientInbox || process.env.GMAIL_NOTIFICATION_TO || 'appointments@galantesjewelry.com',
```

---

## Bug 8 — Maintainability: Ambiguous createOdooClient export name

**File:** `lib/odoo/client.ts`
**Severity:** Low — risk of import confusion between two `createOdooClient` functions

**Root Cause:**
`lib/odoo/client.ts` exports `createOdooClient()` for the product REST API (GET /api/products).
`src/config/odooClient.js` also exports `createOdooClient()` for appointment sync (JSON-2 API).
Both have completely different signatures and purposes. A developer importing the wrong one would silently get incorrect behavior.

**Fix:**
Added `@deprecated` JSDoc and clarifying comment in `lib/odoo/client.ts`:
```ts
/** @deprecated Use getOdooClient() for shop/product data. For appointment sync use src/config/odooClient.js */
export function createOdooClient(config?: OdooClientConfig): OdooClient { ... }
```

The preferred export is now `getOdooClient()` which has no naming ambiguity.

---

## Summary

| # | File | Severity | Category | Status |
|---|------|----------|----------|--------|
| 1 | `odoo/addons/galantes_jewelry/__init__.py` | Critical | Crash | ✅ Fixed |
| 2 | `odoo/addons/galantes_jewelry/models/appointment.py` | Critical | Data corruption | ✅ Fixed |
| 3 | `odoo/addons/galantes_jewelry/controllers/product_api.py` | Critical | Wrong response format | ✅ Fixed |
| 4 | `lib/google-calendar.ts` | High | Stale auth cache | ✅ Fixed |
| 5 | `lib/appointment-flow.ts` | Medium | Wrong HTTP status | ✅ Fixed |
| 6 | `lib/integrations.ts` | Medium | Privacy / hardcoded credentials | ✅ Fixed |
| 7 | `lib/mailer.ts` | Medium | Privacy / hardcoded credentials | ✅ Fixed |
| 8 | `lib/odoo/client.ts` | Low | Naming ambiguity | ✅ Fixed |

**3 critical bugs fixed** that would have caused complete failures:
- Addon wouldn't load at all (Bug 1)
- All appointment syncs would fail (Bug 2)
- Shop would always show zero products (Bug 3)

---

## Environment Variables Required

Ensure these are set in `.env.local` (development) and your deployment environment:

```bash
# Email
GMAIL_SMTP_USER=noreply@galantesjewelry.com
GMAIL_NOTIFICATION_TO=appointments@galantesjewelry.com

# Google Calendar
GOOGLE_CALENDAR_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...

# Odoo
ODOO_BASE_URL=http://localhost:8069
ODOO_DB=galantes_db
ODOO_USERNAME=admin
ODOO_PASSWORD=...
ODOO_API_KEY=...
```
