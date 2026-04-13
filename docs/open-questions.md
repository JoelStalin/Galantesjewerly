# Open Questions

## Q-001 — Odoo Infrastructure & Access

- **Owner WS**: WS-B (Odoo Backend)
- **Blocking**: No (can proceed with scaffolding)
- **Needed from**: User (Joel)
- **Best assumption**: Odoo 19 on-premises Docker instance, reference templates available in `C:\Users\yoeli\Documents\cell_odoo` and `C:\Users\yoeli\Documents\jabiya_test\jabiyaprod`
- **Resolution**: Pending. WS-B will confirm feasibility and create starter docker-compose for Odoo 19 + PostgreSQL.

## Q-002 — Current Admin DB / Migration Path

- **Owner WS**: WS-A (Orchestration) + WS-C (Frontend)
- **Blocking**: No (current site uses data/cms.json, not relational DB yet)
- **Needed from**: Tech review
- **Best assumption**: `lib/db.ts` likely wraps file-based CMS or simple in-memory DB. No migration to Odoo required for editorial content in MVP.
- **Resolution**: WS-C will audit current CMS pattern and document boundary (CMS = Next.js, commerce = Odoo).

## Q-003 — Meta / Facebook / Instagram / WhatsApp Scope for MVP

- **Owner WS**: WS-D (Meta Integrations)
- **Blocking**: No (can document post-MVP)
- **Needed from**: Business/marketing
- **Best assumption**: MVP focuses on basic catalog sync to Meta Catalog. Facebook Shop + Instagram Shopping documented but may require approval. WhatsApp as product inquiry channel only.
- **Resolution**: WS-D will create `docs/meta-capabilities.md` (what each channel actually supports vs. what marketing wants).

## Q-004 — SSL / Cloudflare Zero Trust Setup

- **Owner WS**: WS-E (DevOps)
- **Blocking**: No (dev environment can use HTTP)
- **Needed from**: Infrastructure/security review
- **Best assumption**: Cloudflare tunnel already configured for `galantesjewelry.com`. New subdomains require DNS + tunnel route updates.
- **Resolution**: WS-E will update `infra/nginx/conf.d/galantes.conf` and document Cloudflare routing in `docs/deployment-notes.md`.

## Q-005 — Existing Admin / Auth Persistence

- **Owner WS**: WS-C (Frontend)
- **Blocking**: No
- **Needed from**: Tech review
- **Best assumption**: Current admin auth uses JWT (jose lib). Can coexist with Odoo JWT or separate auth layer.
- **Resolution**: WS-C will document auth boundary (Next.js admin ≠ Odoo admin) and confirm no token collision.
