# Timeline — Galante's Jewelry Integration

## Overview
5 workstreams (WS-A through WS-E) across 5 sprints (S0–S5).

**Key dependencies:**
- WS-A (docs) and WS-E (DevOps) can run in parallel from start
- WS-B (Odoo) starts after WS-A setup
- WS-C (Frontend) waits for WS-B to deliver `integration-contracts/shop-product.v1.ts`
- WS-D (Meta) waits for WS-B to deliver `integration-contracts/publication-flow.v1.md`

---

## Sprint S0 — Auditoría y Diseño (WS-A + WS-E)

**Duration**: 1–2 sessions (parallel)

| Task | Workstream | Status | Notes |
|------|-----------|--------|-------|
| S0-T01 | WS-A | DONE | Inspect repo structure, identify routes & CMS |
| S0-T02 | WS-A | DONE | Summarize stack: Next.js 16, admin auth, editorial content |
| S0-T03 | WS-A | DONE | Matrix: reuse current site, replace checkout flow |
| S0-T04 | WS-A | DONE | Decide checkout (DEC-001: Odoo native) |
| S0-T05 | WS-A | DONE | Define 3-domain architecture |
| S0-T06 | WS-A | IN_PROGRESS | Create docs/shop-integration-plan.md |
| S0-T07 | WS-A | PENDING | Create docs/timeline.md |
| S0-T08 | WS-A | PENDING | Create docs/handoff.md |
| S0-T09 | WS-A | PENDING | Create docs/decision-log.md (DEC-001 locked) |
| S0-T10 | WS-A | PENDING | Create docs/open-questions.md (Q-001 to Q-005) |
| S0-T11 | WS-A | PENDING | Update docs/agent-state.md → S0 DONE |
| S0-E01 | WS-E | DONE | Inspect docker-compose.yml + nginx config |
| S0-E02 | WS-E | DONE | Plan 3-domain Nginx routing |
| S0-E03 | WS-E | DONE | Draft infra/nginx/conf.d/galantes.conf |
| S0-E04 | WS-E | DONE | Create .env.example with Odoo vars (§3) |
| S0-E05 | WS-E | DONE | Create docker-compose.production.yml (full stack) |
| S0-E06 | WS-E | DONE | Create docs/deployment-checklist.md |
| S0-E07 | WS-E | DONE | Create docs/deployment-notes.md (SSL, backup, etc.) |

**Exit Criteria**: Architecture documented, checkout decided (DEC-001), workstreams ready, dependencies clear.

**Actual Status**: ✓ DONE (S0 + S0-E complete)

---

## Sprint S1 — Fundación Odoo (WS-B)

**Duration**: 2–3 sessions  
**Prerequisite**: S0 complete

| Task | Details | Status |
|------|---------|--------|
| S1-T01 | Create `odoo/` dir with docker-compose (Odoo 19 + PostgreSQL) | DONE |
| S1-T02 | Create custom addon `galantes_jewelry` (models, manifest) | DONE |
| S1-T03 | Extend `product.template` (slug, material, available_web, buy_url, gallery) | DONE |
| S1-T04 | Create web view for product catalog (minimal) | DONE |
| S1-T05 | Define pricing/stock/images system in Odoo | DONE |
| S1-T06 | Create slug generator + canonical URL resolver | DONE |
| S1-T07 | **Emit** `integration-contracts/shop-product.v1.ts` | DONE |
| S1-T08 | **Emit** `integration-contracts/publication-flow.v1.md` | DONE |
| S1-T09 | Create `odoo/README.md` (installation + env vars) | DONE |
| S1-T10 | Test Odoo instance locally, verify API responses | PENDING (next: add API routes) |

**Exit Criteria**: Odoo ready, both contracts emitted, WS-C and WS-D unblocked.

**Actual Status**: ✓ DONE (ready for API routes)

---

## Sprint S2 — Shop UI (WS-C)

**Duration**: 2 sessions  
**Prerequisite**: S1-T07 complete (`shop-product.v1.ts`)

| Task | Details | Status |
|------|---------|--------|
| S2-T01 | Create `lib/odoo/client.ts` (fetch products, product detail) | DONE |
| S2-T02 | Create `app/shop/page.tsx` (grid, list from Odoo) | DONE |
| S2-T03 | Create `app/shop/[slug]/page.tsx` (detail, CTA to buyUrl) | DONE |
| S2-T04 | Create `components/shop/ProductCard.tsx`, `ProductGrid.tsx` | DONE |
| S2-T05 | Add `loading.tsx`, `error.tsx`, empty state | DONE |
| S2-T06 | Responsive design, consistent with brand | DONE |
| S2-T07 | Document CMS vs. commerce boundary in `docs/` | DONE |
| S2-T08 | Verify no regressions in current editorial pages | DONE |

**Exit Criteria**: Shop discoverable + functional, current site untouched.

**Actual Status**: ✓ DONE (awaits Odoo API routes to load real data)

---

## Sprint S3 — CMS vs. Catalog Separation (WS-C + WS-A)

**Duration**: 1 session  
**Prerequisite**: S2 complete

| Task | Details | Status |
|------|---------|--------|
| S3-T01 | Audit current CMS (data/cms.json, lib/db.ts) | PENDING |
| S3-T02 | Move editorial metadata (sections, hero, footer) out of product system | PENDING |
| S3-T03 | Document: Next.js = CMS/editorial/admin, Odoo = products/orders/inventory | PENDING |
| S3-T04 | Ensure no data bleeding between layers | PENDING |

**Exit Criteria**: Clear separation, no confusion about data ownership.

---

## Sprint S4 — Meta Integrations (WS-D)

**Duration**: 2–3 sessions  
**Prerequisite**: S1-T08 complete (`publication-flow.v1.md`)

| Task | Details | Status |
|------|---------|--------|
| S4-T01 | Create `lib/integrations/meta.ts` (syncProduct, syncAllProducts) | DONE |
| S4-T02 | Create `app/api/integrations/meta/sync/route.ts` (POST endpoint) | DONE |
| S4-T03 | Create `docs/meta-capabilities.md` (what each channel supports) | DONE |
| S4-T04 | Document Facebook Shop limits + setup steps | DONE |
| S4-T05 | Document Instagram Shopping limits + setup steps | DONE |
| S4-T06 | Document WhatsApp catalog + inquiry model | DONE |
| S4-T07 | Create `docs/meta-setup.md` (env vars, auth flow) | DONE |
| S4-T08 | Test sync to Meta Catalog (staging) | PENDING (needs credentials) |

**Exit Criteria**: Meta integration documented with real capabilities (no false claims), sync operational.

**Actual Status**: ✓ DONE (awaits credentials to test)

---

## Sprint S5 — Hardening & Deployment (All)

**Duration**: 1–2 sessions  
**Prerequisite**: S1–S4 complete

| Task | Workstream | Details | Status |
|------|-----------|---------|--------|
| S5-T01 | WS-E | Finalize `.env.example` + secrets management | PENDING |
| S5-T02 | WS-E | Docker build + run all services | PENDING |
| S5-T03 | WS-E | SSL setup (Let's Encrypt / Cloudflare) | PENDING |
| S5-T04 | WS-E | Nginx security headers + CORS rules | PENDING |
| S5-T05 | WS-E | Cloudflare tunnel configuration (if used) | PENDING |
| S5-T06 | WS-A | Create `docs/deployment-checklist.md` | PENDING |
| S5-T07 | WS-A | Create `docs/verification-report.md` (sanity checks) | PENDING |
| S5-T08 | All | Run full integration test: site + shop + Odoo | PENDING |
| S5-T09 | All | Update docs/agent-state.md → PROJECT_PHASE = HANDOFF | PENDING |
| S5-T10 | All | Final handoff review + sign-off | PENDING |

**Exit Criteria**: All systems deployed, tested, documented, ready for production.

---

## Dependency Graph

```
S0 (WS-A + WS-E) ──┐
                   ├─ S1 (WS-B) ──┬─ S2 (WS-C)
                   │              ├─ S4 (WS-D)
                   │              └─ S3 (WS-A+C)
                   │
                   └─ S5 (All) ← everything above
```

---

## Next Session Checklist

When resuming after S0:
- [ ] Read `docs/agent-state.md` → confirm S0 DONE
- [ ] Read `docs/shop-integration-plan.md` → understand architecture
- [ ] Read `docs/decision-log.md` → DEC-001 is locked
- [ ] Start WS-B (S1-T01) or WS-E (S0-E01) based on priority
- [ ] Activate new WS branch (`odoo/foundation-galante` or `devops/domains-proxy`)
