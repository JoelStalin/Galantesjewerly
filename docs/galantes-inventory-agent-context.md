# Galantes Inventory Publishing Agent Context

Date: 2026-07-16
Workspace: `C:\Users\yoeli\Documents\GetUpSoft_Workspace\06_E_Commerce_Lux\Galantesjewelry`
Goal: clean production inventory, ingest new Google Drive product photos, group photos by product, generate edited images/descriptions, require user price/cost/stock approval, and publish to Galantes/Odoo through a local Orca-orchestrated workflow.

## User Requirements

- Orca must be the primary orchestrator.
- n8n must be the workflow core.
- Hermes, Ollama/local LLMs, Gemini, and ChatGPT act as decision brains/tools.
- A worker agent must watch/process the Drive folder and answer Orca questions.
- The worker must keep local copies of all photos.
- The worker must inventory, organize, compare images, identify photos of the same product, generate descriptions, edit photos, and publish content to Galantes Jewelry.
- Stock, price, and cost must always be provided/approved by the user.
- Google Sheets is only a human review interface; Odoo remains the production system of record for product price, cost, and stock.
- Intake trigger: a new or modified image in Google Drive folder `Products` (`1JzM1wpBtvM8ILEnYu0t5qBtG8pMYht6u`) starts the safe intake/review workflow.
- Post-review trigger: a modification in the linked Google Sheet starts the post-review dry-run workflow.
- Reprocessing guard: unchanged Drive images are skipped using `processed-images.json` keyed by Drive file id plus checksum/modified-time/size signature.
- Mass comparison index: image features, vectors, and nearest-neighbor comparisons are stored in Parquet/NPY under `data/inventory-agent/vectors/` for large-batch clustering.
- Production inventory cleanup must not delete/overwrite data without explicit approval.
- Product-image safety remains mandatory: no broken shop/cart/PDP images.
- Publication tests must be 100% real against production using Selenium with Chrome `Profile 9`.
- Any required API keys must be read from `.env.local`; if a required key is missing, stop and request it from the user instead of inventing or bypassing it.
- Every Orca/n8n workflow node must call a local deterministic script first to minimize LLM/API token usage; LLM calls are allowed only in explicitly marked decision, vision, image-editing, or copy QA nodes.

## Target Google Drive Folder

URL: `https://drive.google.com/drive/folders/1JzM1wpBtvM8ILEnYu0t5qBtG8pMYht6u?usp=sharing`
Observed via Google Drive connector:
- Direct folder children are image files, not subfolders.
- First 100 scanned entries are JPEG photos named like `20260716_082909.jpg`.
- Sizes are roughly 0.9 MB to 5.9 MB.
- Created/modified time cluster: `2026-07-16T16:41:25Z` through `2026-07-16T16:41:34Z` for sampled files.

## Existing Local Infrastructure Inventory

### Running Docker Containers

- `hermes-b45db635`: `nikolaik/python-nodejs:python3.11-nodejs20`, running.
- `hermes-8f805968`: `nikolaik/python-nodejs:python3.11-nodejs20`, running.
- `firecrawl-api-1`: `firecrawl-api`, running on `3002`.
- `firecrawl-rabbitmq-1`, `firecrawl-redis-1`, `firecrawl-nuq-postgres-1`, `firecrawl-foundationdb-1`, `firecrawl-playwright-service-1`: running.
- `odoo18-odoo-1`: `odoo:18.0`, running on `8069`, observed on this PC but explicitly not part of the Galantes inventory publishing project.

### Stopped/Available Containers

- `orca`: `deploy-app`, exited.
- `dgii-n8n`: `n8nio/n8n:1.98.1`, exited.
- `dgii-n8n-postgres`: `postgres:16`, exited.
- `open-webui`: exited.
- `ollama-server`: `ollama/ollama:latest`, exited.
- `orca-gateway-postgres`, `orca-gateway-redis`: exited.

### Compose Projects

- `firecrawl`: running, config at `C:\Users\yoeli\OneDrive\Documents\firecrawl\docker-compose.yaml`.
- `odoo18`: running partially, configs under `02_Odoo_ERP\Odoo_Consolidated_Library\v18\Projects\odoo18`; exclude from this project.
- `03_ai_automation`: exited, config `03_AI_Automation\docker-compose.llm-memory.yml`.
- `deploy`: exited, config `apps\orca\deploy\docker-compose.yml`.
- `n8n`: exited, config `apps\easycount\automation\n8n\docker-compose.n8n.yml`.
- `orca-client-gateway`: exited, config `apps\orca-client-gateway\docker-compose.dev.yml`.

### Relevant Local Paths

- Orca app: `C:\Users\yoeli\Documents\GetUpSoft_Workspace\apps\orca`
- Orca workflow editor: `apps\orca\workflow-editor`
- Orca data: `apps\orca\data\workflow_blueprints.json`, `n8n_workflows.json`, `workflows.db`
- Orca Hermes integration docs: `apps\orca\docs\HERMES_CORE_INTEGRATION.md`
- Hermes config: `apps\orca\config\hermes.yaml`
- Shared memory: `C:\Users\yoeli\Documents\GetUpSoft_Workspace\.agents\memory`
- Existing ORCA/Odoo memory examples:
  - `.agents\memory\orca-odoo-intent-research-worker.md`
  - `.agents\memory\odoo-orca-invoice-workflow-inventory.md`

### Existing Selenium/Profile 9 Evidence Scripts

- `context/operations/testing_selenium_rules.md`
  - Mandatory Selenium pattern: host Chrome user data directory, local profile, non-headless by default, automation flags disabled, friendly locked-profile error.
- `scripts/verify_production_profile9.py`
  - Existing production verification script using `Profile 9`.
- `scripts/verify_production_branding_and_images_profile9.py`
  - Existing production branding/image validation script using `Profile 9`.
- `scripts/verify_production_shop_gallery_profile9.py`
  - Existing shop/gallery production image validation script using `Profile 9`.

### Runtime Secrets Policy

- Runtime secrets for this worker must live in `.env.local` only and must not be committed.
- If `.env.local` is missing any required key, the worker/orchestration must stop and request the missing value from the user.

## Existing Galantes Scripts/Modules To Reuse

- `scripts/gemini-classify-drive-clusters.mjs`
  - Reads a manifest of product clusters.
  - Downloads Drive/local images.
  - Calls Gemini text/vision to produce product classification JSON.
  - Outputs enriched classified manifest.

- `scripts/gemini-nano-banana-enhance.mjs`
  - Calls Gemini image generation/editing API.
  - Preserves jewelry item while improving catalog lighting/background.
  - Needs `GEMINI_API_KEY`.

- `scripts/backfill-managed-images-to-odoo.mjs`
  - Uploads local managed images as Odoo `ir.attachment` records.
  - Useful pattern for image-to-Odoo attachment sync.

- `scripts/odoo-xmlrpc-bridge.py`
  - Minimal JSON stdin to Odoo XML-RPC bridge.
  - Can be wrapped by n8n Execute Command or an Orca tool.

- `lib/odoo/client.ts`, `lib/odoo/services.ts`, `lib/odoo-image-store.ts`, `lib/odoo-sync.ts`
  - Existing app-side Odoo and product/image integration surfaces.

- `scripts/production/inventory.sh`
  - Production inventory report and database/product counts.

- `scripts/production/predeploy-backup.sh`, `deploy-from-github.sh`, `postdeploy-validate.sh`
  - Required production-safe backup/deploy/evidence workflow.

## External Research Summary

### n8n / Google Drive / Product Image Workflows

- n8n has a current template for “Enhance product photos with Google Gemini AI for e-commerce catalog” that watches a Google Drive folder, processes new/updated images using a configured prompt, saves output images to Drive, and logs to Google Sheets.
- n8n has a background-removal workflow template using Google Drive and PhotoRoom API, with upload of processed outputs back to Drive.
- Public GitHub mirrors contain importable JSON workflows for:
  - Google Drive -> Gemini product photo enhancement.
  - Google Drive -> background removal.
  - Advanced background removal with error handling and multiple nodes.
- n8n Google Drive Trigger uses polling and can miss or skip files depending on modified timestamps/checkpoints; production workflow should not rely only on trigger events. It needs an idempotent scanner/manifest checkpoint.
- n8n Execute Command may be disabled by default in Docker for security. If used, configure an isolated worker container and expose commands via allowlisted scripts, not arbitrary shell.
- n8n AI Agent node now works as a Tools Agent; it must be connected to tool subnodes/workflows.
- n8n can expose/call workflows as tools and supports MCP-style workflow invocation patterns.

### Image Comparison / Deduplication

- Recommended technical pattern: produce image embeddings with CLIP/SigLIP, store vectors in Parquet/SQLite, then cluster by cosine similarity.
- NVIDIA NeMo Curator image dedup workflow uses CLIP embeddings and writes to Parquet before duplicate removal.
- Faiss is a strong local option for dense vector similarity search/clustering.
- For a smaller jewelry batch, Python with pandas + pillow + imagehash + OpenCV + sklearn clustering is sufficient; Faiss can be added if image volume grows.

### Gemini / Nano Banana

- Gemini image generation/editing supports text + image prompts and iterative image edits.
- Nano Banana is Google/Gemini native image generation/editing branding and is appropriate for preserving product while improving catalog image quality.
- Use Gemini/Nano Banana only after identity grouping, so each product’s images get consistent editing instructions.

## Proposed Architecture

### Control Plane

1. Orca is the main orchestrator and user-facing decision layer.
2. Orca calls n8n workflow webhooks for concrete workflow execution.
3. Orca calls Hermes for worker reasoning, memory, audit, and answer generation.
4. n8n executes deterministic workflow steps and calls local scripts/services.
5. A dedicated local worker container/process performs heavy image processing and prepares controlled publication calls to the Galantes production Odoo endpoint.
6. Ollama/local models are first-pass brains for local classification/descriptions.
7. Gemini/ChatGPT are escalation brains/tools for image editing, uncertain classification, and polished descriptions.

### Data Plane

Recommended local data root:

- `data/inventory-agent/raw/`: raw Drive photo copies.
- `data/inventory-agent/edited/`: enhanced catalog images.
- `data/inventory-agent/thumbs/`: thumbnails/contact sheets.
- `data/inventory-agent/manifests/`: JSON/CSV/Parquet manifests.
- `data/inventory-agent/vectors/`: embeddings, FAISS index, sklearn outputs.
- `data/inventory-agent/review/`: user review sheets/forms.
- `data/inventory-agent/logs/`: worker logs and n8n run evidence.

Core DB tables or SQLite collections:

- `drive_files`: Drive id, title, mime, size, timestamps, sha256, phash, local path, status.
- `image_features`: file id, perceptual hash, CLIP/SigLIP vector path, quality metrics.
- `product_clusters`: cluster id, confidence, representative image, review state.
- `product_drafts`: generated name/category/material/descriptions/tags, price, stock, approval status.
- `publication_jobs`: draft id, Odoo ids, attachment ids, gallery ids, publish status, rollback metadata.
- `agent_events`: every decision, prompt, model, and action with redacted secrets.

## Required Nodes / Workflow Components

Script-first rule:

- Canonical script entrypoint: `node scripts/inventory-agent/nodes.mjs <command>`.
- Generated node manifest: `scripts/inventory-agent/node-manifest.generated.json`.
- Operational guide: `scripts/inventory-agent/README.md`.
- n8n should call scripts through Execute Command or an isolated worker HTTP wrapper.
- Orca should ask/answer/status through the script-backed worker, not by free-form LLM execution.
- `llmAllowed=false` nodes must never call Gemini, OpenAI, Hermes, or Ollama.
- `llmAllowed=true` nodes should use local Ollama/Hermes first, then Gemini/OpenAI only when needed.

### Orca Nodes

1. `orca.trigger.inventory-command`
   - User starts or queries workflow from Orca.
   - Commands: scan, status, review cluster, approve product, publish approved, cleanup proposal.

2. `orca.inventory-controller`
   - Decides next action and sends commands to n8n.
   - Enforces no price/stock automation.

3. `orca.hermes-reasoning`
   - Uses Hermes `/api/hermes/run` or workflow-node endpoint.
   - Produces structured decisions.

4. `orca.memory-context`
   - Reads/writes inventory context and product decisions.
   - Similar to existing ORCA invoice memory pattern.

5. `orca.review-ui`
   - Presents product clusters, generated descriptions, edited images, and asks for stock/price.

6. `orca.production-gate`
   - Blocks destructive production cleanup unless user explicitly approves exact operation.

### n8n Core Nodes

1. Google Drive Trigger or Schedule Trigger
   - Prefer Schedule Trigger + idempotent scanner to avoid Drive polling edge cases.

2. HTTP Request / Google Drive List
   - List Drive folder and fetch file metadata.

3. Execute Workflow: `drive_incremental_ingest`
   - Delegates Drive scan/download to worker script.

4. Execute Workflow: `image_feature_extract`
   - Generates hashes, quality metrics, embeddings.

5. Execute Workflow: `product_cluster`
   - Runs clustering and creates/updates draft products.

6. AI Agent / HTTP Request to Orca-Hermes
   - Asks decision questions: merge/split cluster, publish readiness, uncertain material/category.

7. Execute Workflow: `image_enhance`
   - Calls local enhancement first, Gemini Nano Banana if configured.

8. Execute Workflow: `description_generate`
   - Uses local LLM first, Gemini/ChatGPT escalation for uncertain or premium copy.

9. Google Sheets / local CSV Review Output
   - Stores review queue with editable price/cost/stock/approval fields.

10. Webhook: `review_callback`
   - Orca/UI submits approval, price, stock, final title.

11. Execute Workflow: `publish_odoo_draft`
   - Creates/updates Odoo product draft and galleries.

12. Execute Workflow: `publish_website_visible`
   - Makes approved product visible only after image checks pass.

13. Error Trigger / Error Handler
   - Logs failures, sets item status to `failed`, notifies Orca.

### Worker Agent Services

1. `inventory-drive-worker`
   - Lists/downloads Drive images.
   - Maintains manifest.

2. `inventory-vision-worker`
   - Hashing, embeddings, clustering.
   - Python stack: pandas, pillow, imagehash, opencv-python, numpy, scikit-learn, optional sentence-transformers/open_clip/faiss-cpu.

3. `inventory-copy-worker`
   - Description generation and metadata normalization.
   - Providers: Ollama/Hermes first, Gemini/ChatGPT escalation.

4. `inventory-image-edit-worker`
   - Calls `scripts/gemini-nano-banana-enhance.mjs` or local image cleanup.

5. `inventory-odoo-publisher`
   - Uses XML-RPC/JSON-2 safe operations against Galantes production Odoo only after approval gates pass.
   - Creates draft products, uploads images, updates gallery, sets website visibility after validation.

6. `inventory-qa-worker`
   - Browser/Selenium/Playwright evidence for shop, PDP, naturalWidth, cart basic checks.

## Model Routing Policy

- Orca: orchestration, user dialogue, approval gates.
- Hermes: memory-aware local reasoning, worker answers, run audit.
- Ollama/local LLM: first-pass classification/descriptions to reduce API cost.
- Gemini text/vision: visual classification escalation and cluster validation.
- Gemini Nano Banana: image enhancement/editing.
- ChatGPT/OpenAI: final copy QA, schema validation, uncertain decisions, fallback reasoning.

Every model call should emit:

```json
{
  "provider": "ollama|hermes|gemini|openai",
  "model": "...",
  "input_refs": ["driveFileId/localPath/clusterId"],
  "output_schema": "...",
  "confidence": 0.0,
  "review_required": true
}
```

## Publication Safety Rules

- Never set stock, price, or cost from AI.
- Never publish if `price`, `cost`, `stock`, `userApproved`, `primaryImageOk`, and `galleryImagesOk` are not true.
- Never delete production products/images automatically.
- Cleanup must produce a proposed action plan first: archive/hide candidates, current Odoo ids, rollback path, expected impact.
- Do not use the unrelated local `odoo18` container for this workflow.
- Publication target is the real Galantes production Odoo environment.
- Production publication must use backup, approval, idempotency, and evidence gates.
- Production publication tests must be real browser tests with Selenium `Profile 9`; mocks are acceptable only for local unit tests, never as final publication evidence.
- Evidence must include: product created/updated in production Odoo, product visible on Galantes storefront if approved for website, all uploaded images loading with `naturalWidth > 0`, and screenshots/logs saved locally.
- If Chrome `Profile 9` is locked, the Selenium script must ask the user to close Chrome manually and exit cleanly.
- Product image validation must prove representative `/shop` cards and PDP images load with `naturalWidth > 0`.

## Workflow Sequence

### Flow A: Initial Backfill

1. Orca command: `inventory scan drive folder`.
2. n8n schedule/manual trigger calls worker scanner.
3. Worker downloads new images to `raw/` and writes `drive_files` manifest.
4. Vision worker calculates sha256, pHash, image quality, embeddings.
5. Cluster worker groups likely same-product photos.
6. Hermes/Gemini reviews uncertain clusters.
7. Contact sheets and review JSON/CSV are generated.
8. User supplies stock/price and approves/splits/merges clusters.
9. Image edit worker enhances approved cluster images.
10. Copy worker generates final product draft.
11. Publisher creates Odoo draft products with gallery in Galantes production Odoo after explicit user approval for price and stock.
12. QA worker verifies local/staging shop/PDP image rendering.
13. Orca asks for production publish approval.

### Flow B: Continuous New Photo Watch

1. n8n Schedule Trigger every 5-15 minutes, or Google Drive Trigger plus scheduled reconciliation.
2. Scanner checks folder by Drive IDs and modified times.
3. New photos are downloaded and processed.
4. If photo matches an existing product cluster, attach as candidate gallery image.
5. If photo starts a new cluster, create draft product requiring user price/stock.
6. Orca notifies user with questions/status.
7. Only approved products are published.

### Flow C: Production Inventory Cleanup

1. Export current production inventory via `scripts/production/inventory.sh` and Odoo product/gallery queries.
2. Compare production products to newly approved inventory.
3. Generate cleanup proposal: keep, hide/archive, needs manual review.
4. User explicitly approves exact cleanup operation.
5. GitHub Actions/controlled workflow runs backup and applies cleanup.
6. Post-deploy validates `/api/health`, `/shop`, PDP images, Odoo sync, checkout path if affected.

## Implementation Plan

1. Create `docs/galantes-inventory-agent-context.md` and keep this file as living context.
2. Add `scripts/inventory-agent/` with Python worker modules and Node wrappers.
3. Add `docker/inventory-agent/` or compose service for the worker with mounted workspace data.
4. Add n8n workflow JSON under `workflows/n8n/galantes-inventory-publisher.workflow.json`.
5. Add Orca blueprint under `apps/orca/data/workflow_blueprints.json` or import-compatible separate JSON.
6. Add Hermes memory file under `.agents/memory/galantes-inventory-publishing-agent.md`.
7. Add review UI/export: CSV first, then Orca panel if needed.
8. Add a dry-run publication mode that validates payloads locally without writing to Odoo.
9. Add production-safe publication workflow for Galantes production Odoo using backup, approval, idempotency, and evidence policy.
10. Add Selenium/Profile 9 publication evidence script for the worker: verify Odoo product record, storefront PDP, gallery images, and publication audit trail.

## Required `.env.local` Secrets

The implementation must load these from `.env.local` and request any missing value before production publication:

- `GOOGLE_APPLICATION_CREDENTIALS` or Google OAuth/client credentials for Drive access.
- `GEMINI_API_KEY` for image classification/editing and Nano Banana image generation/editing.
- `OPENAI_API_KEY` if ChatGPT is used as a decision/copy QA brain.
- `OLLAMA_BASE_URL` for local Ollama brain calls.
- `ORCA_BASE_URL` for Orca orchestration calls if the worker calls Orca over HTTP.
- `HERMES_BASE_URL` or Hermes command/runtime config if Hermes is exposed as a service.
- `N8N_BASE_URL` and `N8N_API_KEY` for workflow management/execution.
- Production Odoo credentials/API access:
  - `ODOO_BASE_URL`
  - `ODOO_DB`
  - `ODOO_USERNAME` or `ODOO_USER`
  - `ODOO_PASSWORD` or `ODOO_API_KEY`
- Any production admin/test account credentials needed by Selenium `Profile 9` must already exist in the Chrome profile or be explicitly provided by the user.

### `.env.local` Audit On 2026-07-16

Existing relevant variables found without exposing values:

- Google/GCP present: `PROD_GOOGLE_OAUTH_CLIENT_ID`, `PROD_GOOGLE_OAUTH_CLIENT_SECRET`, `PROD_GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GCP_PROJECT`, `GCP_INSTANCE`, `GCP_ZONE`, `GCP_SSH_USER`.
- Production Odoo partial: `PROD_ODOO_PASSWORD`.
- GitHub/GCP deployment variables present.

Still needed or needs explicit mapping before implementation:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `N8N_BASE_URL`
- `N8N_API_KEY`
- `OLLAMA_BASE_URL`
- `ORCA_BASE_URL`
- `HERMES_BASE_URL` or command/runtime mode
- `ODOO_BASE_URL`
- `ODOO_DB`
- `ODOO_USERNAME` or `ODOO_USER`
- `ODOO_PASSWORD` or documented mapping from `PROD_ODOO_PASSWORD`
- Google Drive credential mode: either `GOOGLE_APPLICATION_CREDENTIALS` path, or OAuth credentials mapped from the existing `PROD_GOOGLE_*` variables.

## Open Risks / Unknowns

- Orca container is currently stopped; needs restart or dev server path confirmation.
- n8n container is currently stopped; Execute Command may be disabled by default and should be enabled only in an isolated worker setup.
- Ollama and Open WebUI containers are stopped; need model availability inventory before assigning local model roles.
- Hermes containers are running but exact HTTP/control interface for these two containers needs inspection.
- The Drive folder has many flat JPEGs; no product grouping metadata exists, so visual clustering and user review are mandatory.
- Production Odoo public login routing recently returned a Next 404; do not rely on public Odoo URL until routing is clarified.

## Sources Consulted

- n8n template: Enhance product photos with Google Gemini AI for e-commerce catalog.
- n8n template: Automatic background removal for images in Google Drive.
- n8n docs: Google Drive Trigger, AI Agent node, Execute Command node.
- n8n community reports: Drive Trigger polling/checkpoint behavior and Execute Command disabled-by-default security behavior.
- Google Gemini image generation docs: Nano Banana image generation/editing.
- NVIDIA NeMo Curator image dedup workflow: CLIP embeddings to Parquet for image duplicate removal.
- Faiss GitHub: vector similarity search/clustering.
- GitHub n8n workflow mirrors for Gemini product photo enhancement and background removal JSON.
- Local Orca/Hermes docs and memory files in GetUpSoft workspace.
