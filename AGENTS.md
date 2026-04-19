<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:selenium-testing-rules -->
# Selenium & E2E Testing Mandatory Context
Cuando el asistente (tú) deba escribir, modificar o ejecutar un script de pruebas utilizando Selenium (Python), ES OBLIGATORIO que los scripts se escriban adhiriéndose al patrón de uso de perfiles locales (revisar `context/operations/testing_selenium_rules.md`). Nunca utilices una sesión vacía a menos que se te indique explícitamente y asegúrate siempre de inyectar el manejo de errores `try catch` amigable solicitando cerrar Chrome si el perfil está bloqueado ("already in use").

Además, como regla estricta: **SIEMPRE debes realizar pruebas funcionales** proactivamente después de cada implementación, cambio de infraestructura o despliegue. Asimismo, debes **aplicar todos los ajustes (settings) requeridos** de forma autónoma en el repositorio para asegurar que el ambiente quede funcionando de extremo a extremo antes de dar por concluida cualquier misión.

> 📚 **Infraestructura de Producción**: GCP VM `galantes-prod-vm` (us-central1-a, IP 136.114.48.210). Docker Compose con 5 servicios: web (Next.js), odoo, postgres, nginx, cloudflared. No usar Termux ni Android — la producción corre 100% en GCP.
<!-- END:selenium-testing-rules -->

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
