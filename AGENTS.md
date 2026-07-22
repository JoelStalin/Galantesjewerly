<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:selenium-testing-rules -->
# Selenium & E2E Testing Mandatory Context
Cuando el asistente (tú) deba escribir, modificar o ejecutar un script de pruebas utilizando Selenium (Python), ES OBLIGATORIO que los scripts se escriban adhiriéndose al patrón de uso de perfiles locales (revisar `context/operations/testing_selenium_rules.md`). Nunca utilices una sesión vacía a menos que se te indique explícitamente y asegúrate siempre de inyectar el manejo de errores `try catch` amigable solicitando cerrar Chrome si el perfil está bloqueado ("already in use").

Además, como regla estricta: **SIEMPRE debes realizar pruebas funcionales** proactivamente después de cada implementación, cambio de infraestructura o despliegue. Asimismo, debes **aplicar todos los ajustes (settings) requeridos** de forma autónoma en el repositorio para asegurar que el ambiente quede funcionando de extremo a extremo antes de dar por concluida cualquier misión.

> 📚 **Infraestructura de Producción**: GCP VM `galantes-prod-vm` (us-central1-a, IP 136.114.48.210). Docker Compose con 5 servicios: web (Next.js), odoo, postgres, nginx, cloudflared. No usar Termux ni Android — la producción corre 100% en GCP.

## Mandatory Single-Instance & Single-Schema Architecture Rules
- **Single GCP Instance Rule:** Production MUST strictly run on EXACTLY ONE GCP VM instance (`galantes-prod-vm`, zone `us-central1-a`). No secondary VMs, external staging instances, or multi-host configurations are permitted.
- **Single Database Schema Rule:** Production MUST strictly use ONLY ONE database schema (`galantes_prod`). All services, Odoo connections, and API endpoints must point strictly to `galantes_prod`. Secondary schemas or fallback DBs are strictly forbidden.
- **1-to-1 Product-Photo Mapping Rule:** Every catalog item published must be assigned a unique title and unique SKU (`default_code`) derived from its visual cluster ID (e.g. `GAL-1093`), ensuring every single photo from Google Drive maps 1-to-1 to its exact visual image with zero generic title collisions.

## Product image safety
- Never ship client code that can surface a broken product image in shop, cart, or PDP views.
- If Odoo has no product image, the API must return a deterministic fallback asset instead of `404`, `500`, or an empty string.
- Any change to product image routing must be verified with browser evidence that `naturalWidth > 0` for representative catalog cards.
- Keep a client-side `onError` fallback to a local placeholder as a second line of defense.
- Do not remove or replace an existing image fallback until the production browser test proves the new source loads for the real catalog.

## Production change safety
- Never modify Cloudflare tunnel, reverse proxy, or service topology unless the user explicitly authorizes the exact operation and impact.
- Never delete or overwrite production images, galleries, or Odoo media unless the user explicitly requests that data operation.
- Preserve Google Calendar, Odoo sync, and checkout flows during storefront changes; if a change could affect them, validate those flows before delivery.
- Treat current production instance state as the source of truth until a browser test against the live origin confirms the change is visible.
- If the public edge is stale but the VM origin is updated, do not force risky infra changes; diagnose the propagation layer first and report the gap.
<!-- END:selenium-testing-rules -->

<!-- BEGIN:galantes-production-deployment-policy -->
# Galantes Production Deployment Policy

Galantes Jewelry production changes must be delivered through `https://github.com/JoelStalin/Galantesjewerly.git` and GitHub Actions. `GetUpSoft_Workspace` remains the operational workspace and must stay updated, but it must not become the accidental production deployment source.

## Repository source of truth
- `Galantesjewerly.git` is the canonical deploy repository for Galantes Jewelry.
- Before enabling production deployment from GitHub Actions, renew `Galantesjewerly.git` against the real production checkout on `galantes-prod-vm` because the repo and production have large differences.
- The renewal must compare local workspace, GitHub repo, and production VM versionable files.
- Never copy secrets, dumps, `.env.prod`, `.next`, `node_modules`, backups, private blobs, Odoo filestore data, or generated runtime artifacts into git.
- Keep `GetUpSoft_Workspace` updated after approved repo changes, but production deploys must reference commits from `Galantesjewerly.git`.

## No direct production changes
- No agent may deploy, patch, restart, recreate, sync, tunnel, edit remote files, run production SQL, or mutate production data directly as the normal delivery path.
- Production changes must pass local validation, CI, staging, GitHub Environment approval, backup, deployment, and post-deploy evidence.
- Emergency production actions require explicit user approval and must be documented with commands, impact, rollback path, and evidence.

## GitHub Actions only
- Production deploys must run through GitHub Actions with the `production` environment, protected branch rules, required checks, and required reviewer approval.
- Staging deploys must run from `develop` into a separate staging database and staging tunnel/domain.
- Do not use `appleboy/ssh-action@master`; pin actions to stable versions or SHAs.
- Use environment-scoped secrets. Do not rewrite `.env.prod` with hardcoded defaults such as `ODOO_DB=galantes_db`; production must preserve `galantes_prod`.

## Backup and storage
- A production deploy must fail if the predeploy backup fails.
- Required backup set: `pg_dump -Fc` for `galantes_prod`, Docker volume archives for persistent Odoo/Postgres data when available, app `data/`, `docker-compose.production.yml`, commit SHA, `docker inspect`, and a `backup.json` manifest with sizes/checksums.
- Backups must be rotated inside `/home/yoeli/deploy-backups` only. Keep the last 5 successful backups and backups newer than 72 hours.
- Never run `docker system prune --volumes` on production. Build/image pruning must be filtered and must not remove active containers or named volumes.

## Tunnel and infrastructure safety
- Keep Cloudflare tunnel `galantes_tunnel_prod` active throughout normal deploys.
- Do not stop, remove, restart, replace, recreate, disable, or reroute Cloudflare, SSH, reverse proxy, or tunnel containers unless the user approves the exact operation and impact.
- If a deploy step requires tunnel changes, pause and request permission for that step before proceeding.

## Images and customer data
- No image, Odoo media, gallery, Google Drive source image, uploaded blob, invoice, order, appointment, or customer record may be deleted or overwritten unless the user explicitly requests that data operation.
- Product image routing changes require browser evidence that representative shop cards and PDP images load with `naturalWidth > 0`.
- Preserve checkout, Odoo sync, Google Calendar, Gmail/SendGrid, customer auth, and account flows during every deploy.

## Required evidence
- Every delivery must reference backlog item, DoR, DoD, local tests, staging tests, production backup path, deployment SHA, and post-deploy checks.
- For storefront changes, include evidence for `/api/health`, `/shop`, a representative PDP, image loading, Odoo public login, and any affected checkout/calendar path.
<!-- END:galantes-production-deployment-policy -->

<!-- BEGIN:scrapling-automation-rules -->
# Scrapling Stealth Automation
Para scraping autorizado de sitios con Cloudflare/anti-bot, usar `scripts/scrapling_stealth_fetch.py` basado en Scrapling `StealthyFetcher`, no `requests` + BeautifulSoup. Instalar runtime con `pip install "scrapling[fetchers]"` y `scrapling install`. Ver `docs/automation/scrapling-stealth.md`.

Esto no reemplaza Selenium E2E: las pruebas funcionales con Selenium siguen usando el patrón obligatorio de perfiles locales.
<!-- END:scrapling-automation-rules -->

<!-- BEGIN:appointment-system-rules -->
# Appointment System Rules (Mega Prompt Maestro v3)

## Core Architecture
- **Backend**: Node.js + Express (via Next.js API routes)
- **Google Calendar**: OAuth2 + API v3 for event creation
- **Odoo**: JSON-2 API for appointment persistence
- **Email**: SendGrid for confirmations with ICS attachments
- **Orchestration**: Multi-CLI support (Claude Code, Codex CLI, Gemini CLI)
- **Memory**: Hierarchical system (hot/warm/cold) for agent continuity

## API Contract
- **Endpoint**: POST /api/v1/appointments
- **Required Fields**: name, email, date, time, duration
- **Optional Fields**: description, serviceType, notes, timezone, phone, metadata
- **Response**: { success, appointmentId, googleEventId, odooAppointmentId, message }

## Security Rules
- Zero hardcoded secrets (100% process.env)
- Input sanitization and validation (Zod schemas)
- Rate limiting: 8 requests per 15 minutes per IP
- CORS restricted to known origins
- Error responses: no stack traces in production

## Odoo Integration Rules
- Use JSON-2 API exclusively (no XML-RPC)
- Prefer bearer token authentication
- Sync flow: Next.js → Odoo (one-way for Phase 1)
- Models: res.partner (customers), galante.appointment (appointments)
- Idempotent operations (avoid duplicates)

## Memory System Rules
- Hot memory ≤200 lines (critical context only)
- Warm memory: architecture, decisions, patterns
- Cold memory: history, logs, summaries
- Never load full transcripts in agent context
- Curate sessions automatically after completion

## CLI Orchestration Rules
- Provider order: configurable via MODEL_PROVIDER_ORDER
- Automatic fallback on QUOTA_EXHAUSTED, RATE_LIMITED, etc.
- Preserve taskId across handoffs
- Checkpoint before each provider switch
- Structured output required

## Task Ledger Rules
- Every task needs evidence for completion
- States: pending → in_progress → completed (no skipping)
- No advancement without validation
- Handoffs logged with context
- Checkpoints enable resumability

## Development Rules
- Modular structure: config/, services/, controllers/, utils/
- Consistent error handling (AppError class)
- Logging: structured, level-based
- Testing: unit + integration + E2E (≥85% coverage)
- Documentation: executable and up-to-date

## Skills Available
- `calendar-oauth-recovery`: Handle OAuth2 token refresh failures
- `appointment-validation`: Validate and sanitize appointment payloads
- `provider-handoff`: Manage CLI provider switching
- `memory-curation`: Maintain memory hierarchy
- `odoo-json2-sync`: Synchronize with Odoo backend
- `odoo-webhook-verification`: Validate Odoo webhook signatures

## Critical Paths
- Check `memory/current/now.md` before any work
- Update task status in `task-ledger/tasks.json`
- Run tests after any change
- Update memory after significant decisions
- Document blockers in `memory/current/blockers.md`

## Emergency Procedures
- If CLI provider fails: fallback to next in MODEL_PROVIDER_ORDER
- If Odoo unavailable: log error, continue with Google Calendar only
- If Google quota exceeded: queue appointment for retry
- If memory corrupted: rebuild from task-ledger + docs
<!-- END:appointment-system-rules -->

<!-- BEGIN:shared-agent-memory-rule -->
# Multi-Agent Shared Memory & Task Ledger Protocol (GetUpSoft / Orca)

## Mandatory Multi-Agent Rules
1. **Identify Yourself**: Each agent session MUST have a unique `agent_id` (e.g., `antigravity-main`, `codex-worker-01`, `claude-dev-02`).
2. **Check Shared Memory & Ledger First**: At the start of every session, read `C:\Users\yoeli\.agents_shared_memory\ACTIVE_TASKS.md` and `TASKS_LEDGER.json` to see active agents and claimed tasks.
3. **Claim & Mark Active Tasks**: Never work on a task currently locked by another `agent_id`. Claim your `task_id` using `sync_memory.py start-task` or by writing to `TASKS_LEDGER.json`.
4. **Update Progress & Hand-Off**: Before ending a turn, hitting token limits, or context switching, update your task progress in `TASKS_LEDGER.json` and `ACTIVE_SESSION.md` so peer agents can collaborate smoothly on the same project without duplicating effort.
5. **Brand & Ecosystem Identity**: Remember GetUpSoft (mother company), Orca (automation engine), Galantes Jewelry (e-commerce client). Use Google AI Studio / Antigravity (never Vertex AI).
<!-- END:shared-agent-memory-rule -->
