# Galantes Inventory Agent - n8n Node Inventory

Status: local-worker execution design. Drive, image, ML, review, and dry-run
nodes execute on the local machine; the protected production workflow only
consumes the validated publication bundle.

Rule: n8n orchestrates deterministic local scripts first. LLM/model calls are only allowed in explicitly marked decision, vision, image-editing, or copy QA nodes. Price, cost, and stock always require user approval and must be written/verified in Odoo before production storefront publication.

## Workflow 1: Inventory Intake Orchestrator

Purpose: start the full run safely and keep each phase idempotent.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Google Drive Products Trigger / Manual Trigger | Trigger | Starts batch when a photo is created or modified in Drive folder `Products` (`1JzM1wpBtvM8ILEnYu0t5qBtG8pMYht6u`), with manual fallback | No | Run metadata |
| 2 | Set Run Context | Set | folder id, run id, dry-run flags | No | Normalized execution context |
| 3 | Execute Command: Agent Status | Execute Command | `node scripts/inventory-agent/nodes.mjs status` | No | Current manifest state |
| 4 | Execute Command: Error Use Cases | Execute Command | `node scripts/inventory-agent/nodes.mjs errors:use-cases` | No | Active regression registry |
| 5 | IF: Publication Locked? | IF | Checks dry-run/write lock | No | Blocks accidental production writes |
| 6 | Execute Workflow: Drive Scan | Execute Workflow | Workflow 2 | No | Drive scan result |
| 7 | Execute Command: Processed Index Status | Execute Command | `node scripts/inventory-agent/nodes.mjs processed:index-status` | No | Reprocessing guard summary |
| 8 | Execute Workflow: Download Photos | Execute Workflow | Workflow 3 | No | Local raw image manifest |
| 9 | Execute Workflow: Feature Extract | Execute Workflow | Workflow 4 | No | Feature manifest |
| 10 | Execute Workflow: Product Cluster | Execute Workflow | Workflow 5 | No | Product clusters |
| 11 | Execute Workflow: Review Export | Execute Workflow | Workflow 8 | No | Review queue |
| 12 | Respond to Webhook / Email Summary | Respond / Email | Sends review artifact location | No | Human review checkpoint |

## Workflow 2: Google Drive Incremental Scan

Purpose: list folder contents and queue new/changed photos.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Drive Scan | Execute Command | `node scripts/inventory-agent/nodes.mjs drive:scan` | No | `drive-scan.json` |
| 2 | Read Binary/File Manifest | Read File | Reads scan manifest | No | Parsed result |
| 3 | IF: New Files Exist | IF | `queued > 0` | No | Continue/stop |
| 4 | Log Event | Write File / DB | Append run event | No | Audit log |

Reprocessing guard:

- `drive:scan` compares Drive file id, md5 checksum, modified time, and size against `data/inventory-agent/manifests/processed-images.json`.
- Unchanged images with successful feature extraction are skipped and reported as `skippedAlreadyProcessed`.
- Modified images re-enter the queue with `queueReason=modified_since_processed`.
- Large pending queues are batched by `INVENTORY_AGENT_MAX_QUEUE` (default `100`); remaining images are reported as `deferred`.

## Workflow 3: Google Drive Photo Download

Purpose: keep local copies of every source photo.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Drive Download | Execute Command | `node scripts/inventory-agent/nodes.mjs drive:download` | No | `downloads.json` |
| 2 | Read Download Manifest | Read File | Reads local paths/checksums | No | Download records |
| 3 | IF: Download Errors | IF | Checks script status/errors | No | Retry or stop |
| 4 | Log Download Evidence | Write File / DB | Append checksum evidence | No | Audit log |

## Workflow 4: Image Feature Extraction

Purpose: deterministic image processing before any model call.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Image Features | Execute Command | `node scripts/inventory-agent/nodes.mjs image:features` | No | `image-features.json` |
| 2 | Read Feature Manifest | Read File | Reads dimensions, hashes, thumbnails | No | Parsed features |
| 3 | IF: Bad Images | IF | Missing hash/width/height | No | Quarantine or continue |
| 4 | Log Feature Evidence | Write File / DB | Append image quality event | No | Audit log |

## Workflow 5: Product Clustering

Purpose: group photos that likely represent the same product.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Product Cluster | Execute Command | `node scripts/inventory-agent/nodes.mjs product:cluster` | No | `product-clusters.json` |
| 2 | Read Cluster Manifest | Read File | Reads cluster candidates | No | Parsed clusters |
| 3 | Execute Command: ML Index Status | Execute Command | `node scripts/inventory-agent/nodes.mjs ml:index-status` | No | Mass comparison index status |
| 4 | Execute Command: ML Similarity Index | Execute Command | `python scripts/inventory-agent/ml_similarity.py build-index` | No | `image-neighbors.parquet`, `image-vectors.npy` |
| 5 | Execute Command: Candidate Clusters | Execute Command | `python scripts/inventory-agent/ml_similarity.py cluster` | No | `ml-product-clusters.json` |
| 5 | IF: Uncertain Clusters | IF | Low confidence / conflict score | No | Sends uncertain cases to Workflow 6 |
| 6 | Execute Workflow: Cluster Review Reasoning | Execute Workflow | Workflow 6 | Yes, only for uncertain cases | `cluster-review.json` |
| 7 | Merge Review Decisions | Code | Applies merge/split recommendations only as review suggestions | No | Updated review queue |

Recommended implementation for `ml_similarity.py`:

- `pandas`: joins Drive metadata, local paths, hashes, dimensions, model scores, and cluster ids.
- `Pillow`/`imagehash`: fast perceptual hash prefilter for duplicate/near-duplicate photos.
- `OpenCV` or `sharp` output metrics: blur, brightness, crop/aspect quality.
- `OpenCV absdiff`: grayscale + blur + absolute difference + threshold + changed-pixel ratio for near-duplicate evidence.
- CLIP or SigLIP embeddings: semantic visual vectors for jewelry similarity.
- `sklearn.neighbors.NearestNeighbors`: exact or approximate k-nearest-neighbor search for small/medium batches.
- `sklearn.cluster.DBSCAN` or `AgglomerativeClustering`: product grouping by cosine distance.
- Optional `faiss`: faster vector index when image volume grows.
- Outputs must include `confidence`, `nearestNeighbors`, `distance`, `reasonCodes`, and `needsHumanReview`.

## Workflow 6: Cluster Review Reasoning

Purpose: ask a model only when deterministic clustering is uncertain.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Cluster Review Context | Execute Command | `node scripts/inventory-agent/nodes.mjs cluster:review` | Yes | Review context |
| 2 | Code: Build Contact Sheet Prompt | Code | Includes thumbnails, neighbors, distance matrix, metadata | No | Vision prompt payload |
| 3 | HTTP Request: Hermes/Ollama Vision if available | HTTP Request | Local model first | Yes | Merge/split recommendation |
| 4 | IF: Still Uncertain | IF | Confidence threshold | No | Optional escalation |
| 5 | HTTP Request: Gemini/OpenAI Vision | HTTP Request | Escalation only | Yes | Vision recommendation |
| 6 | Write Review Suggestions | Write File | Saves suggestions, does not auto-approve | No | `cluster-review.json` |

LLM review rules:

- The model can only recommend `same_product`, `different_product`, `uncertain`, `needs_better_photo`, or `human_review`.
- The model cannot approve publishing, price, stock, or destructive cleanup.
- The model sees contact sheets and deterministic evidence, not raw free-form folder access.
- All recommendations must cite image ids and nearest-neighbor distances.

## Workflow 7: Image Enhancement

Purpose: prepare catalog images without losing source files.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Local Image Enhance | Execute Command | `node scripts/inventory-agent/nodes.mjs image:enhance` | Yes only if configured | Local edited images |
| 2 | IF: Needs Gemini Edit | IF | Enhancement confidence/quality | No | Optional Gemini |
| 3 | HTTP Request: Gemini Image Edit | HTTP Request | Gemini/Nano Banana | Yes | Edited catalog image |
| 4 | Save Edited Image | Write Binary File | Writes to `data/inventory-agent/edited` | No | Edited file path |
| 5 | Log Image Provenance | Write File / DB | Source -> edited mapping | No | Audit log |

## Workflow 8: Human Review Export

Purpose: stop for human product, price, cost, stock, and publish approval.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Review Export | Execute Command | `node scripts/inventory-agent/nodes.mjs review:export` | No | `review-queue.csv` |
| 2 | Google Sheets: Upload Review Queue | Google Sheets | Optional review sheet for editing review fields; Odoo remains the production system of record for price, cost, and stock | No | Sheet URL |
| 3 | Email / Orca Message: Review Required | Email/HTTP | Sends review queue location | No | Human checkpoint |
| 4 | Wait Node | Wait | Pauses until approval event | No | Resume token |

## Workflow 9: Human Review Import

Purpose: validate approval before any Odoo payload is built.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 0 | Google Sheets Review Trigger / Manual Trigger | Trigger | Starts post-review dry-run when the review Sheet is modified, with manual fallback | No | Run metadata |
| 1 | Execute Command: Review Sheet Export | Execute Command | `node scripts/inventory-agent/nodes.mjs review:sheet-export` | No | Refreshed `review-queue.csv` |
| 2 | Execute Command: Review Sheet Status | Execute Command | `node scripts/inventory-agent/nodes.mjs review:sheet-status` | No | `review-sheet-status.json` |
| 3 | Execute Command: Review Import | Execute Command | `node scripts/inventory-agent/nodes.mjs review:import` | No | `approved-products.json` |
| 4 | IF: Missing Price/Cost/Stock | IF | Blocks incomplete approvals | No | Stop with error |
| 5 | IF: Unresolved Merge/Split | IF | Blocks `REVIEW_MERGE_OR_SPLIT`, `UNCERTAIN`, `HUMAN_REVIEW` rows | No | Stop with error |

Allowed publish review decisions:

- `SINGLE_IMAGE`: create/update one product with one primary image.
- `SAME_PRODUCT`: create/update one product and attach every cluster image to that same product gallery.
- Any split/merge uncertainty must be resolved before `review:import`.

## Workflow 10: Odoo DTO Field Export

Purpose: compare production `product.template` fields with the local DTO before enabling publish.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Odoo Fields Export | Execute Command | `node scripts/inventory-agent/nodes.mjs odoo:fields-export` | No | `odoo-product-template-fields.json` |
| 2 | Read DTO Coverage | Read File | Reads `dtoCoverage` | No | Missing/custom fields |
| 3 | IF: DTO Missing Fields | IF | `missingInDto.length > 0` | No | Stop for DTO review |
| 4 | Log DTO Evidence | Write File / DB | Saves production field snapshot | No | Audit log |

## Workflow 11: Description Generation

Purpose: generate sales copy only after image grouping and metadata review.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Description Generate | Execute Command | `node scripts/inventory-agent/nodes.mjs description:generate` | Yes | Draft copy |
| 2 | HTTP Request: Hermes/Ollama | HTTP Request | Local copy generation first | Yes | Product description |
| 3 | IF: Premium Copy QA Needed | IF | Quality threshold | No | Optional escalation |
| 4 | HTTP Request: Gemini/OpenAI Copy QA | HTTP Request | Escalation only | Yes | Polished description |
| 5 | Write Product Copy Manifest | Write File | Saves generated copy | No | `product-copy.json` |

## Workflow 12: Odoo Dry Run

Purpose: build Odoo payloads and validate DTO safety without writing.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Odoo Dry Run | Execute Command | `node scripts/inventory-agent/nodes.mjs odoo:dry-run` | No | `odoo-dry-run.json` |
| 2 | Read Dry Run Result | Read File | Reads payloads/errors | No | Parsed dry run |
| 3 | IF: Payload Errors | IF | Blocks invalid DTO fields | No | Stop |
| 4 | Code: Verify Image Upload Plan | Code | Confirms `primaryImagePath` and gallery image list exist for approved product | No | Image upload plan |
| 5 | IF: Explicit Publish Approval | IF | Requires user approval flag | No | Continue only with approval |

## Workflow 13: Odoo Publication

Purpose: create/update approved products only after all gates pass.

This workflow must remain disabled until reviewed.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Production Approval Gate | IF / Webhook | Verifies explicit approval payload | No | Approval evidence |
| 2 | Execute Command: Pre-Publish Backup Check | Execute Command | Production backup evidence command | No | Backup path |
| 3 | Execute Command: Odoo Publish | Execute Command | `node scripts/inventory-agent/nodes.mjs odoo:publish` | No | Publication result |
| 4 | IF: Publish Failed | IF | Stops and reports rollback data | No | Error evidence |
| 5 | Log Publication Result | Write File / DB | Records Odoo IDs and image IDs | No | `publication-result.json` |

## Workflow 14: Post-Publish Browser QA

Purpose: verify production storefront images and PDPs with Selenium Profile 9.

| Order | n8n node | Type | Calls | LLM allowed | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Execute Command: Selenium QA | Execute Command | `node scripts/inventory-agent/nodes.mjs qa:selenium-profile9` | No | Browser evidence |
| 2 | Read QA Evidence | Read File | Reads screenshots/logs/result | No | Parsed evidence |
| 3 | IF: Broken Images | IF | Requires `naturalWidth > 0` | No | Stop/report |
| 4 | Final Report | Email / Orca Message | Sends evidence summary | No | Completion report |

## Required Credentials / Settings

- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_OAUTH_CLIENT_JSON`
- `GOOGLE_DRIVE_TOKEN_JSON`
- `ODOO_BASE_URL`
- `ODOO_DATABASE` or `ODOO_DB`
- `ODOO_PASSWORD` or approved JSON-2 bearer token
- Optional: `GEMINI_API_KEY`
- Optional: `OPENAI_API_KEY`
- Optional local model endpoint: Hermes/Ollama

## Recommended Skills / MCP / Tooling Additions

Use these to improve the workflow without weakening safety gates:

| Capability | Recommended tool | Where it fits | Why |
| --- | --- | --- | --- |
| Drive file discovery | Google Drive connector or n8n Google Drive node | Workflows 2-3 | Native metadata, folder ids, resumable review artifacts |
| Review sheets | Google Sheets connector or n8n Google Sheets node | Workflows 8-9 | Human price/cost/stock approval in a structured table before Odoo validation |
| Review comments | Google Drive comments connector | Workflow 8 | Human can comment on clusters/products without changing CSV fields |
| Notifications | Gmail / SendGrid / n8n Email node | Workflows 8, 13, 14 | Alerts when review or QA is required |
| Local deterministic tools | n8n Execute Command or isolated HTTP worker | All workflows | Keeps script-first rule and minimizes LLM tokens |
| Agent reasoning | n8n AI Agent as Tools Agent | Workflows 6, 11 only | Use only after deterministic evidence exists |
| Vision fallback | Gemini/OpenAI Vision | Workflow 6 | Resolve uncertain same-product cases |
| Image editing | Gemini image edit / Nano Banana, optional PhotoRoom | Workflow 7 | Catalog-ready images after grouping |
| Vector search | Python `sklearn.neighbors` first, FAISS later | Workflow 5 | Same-product candidate matching |
| Dataframes | `pandas` + Parquet | Workflows 4-5, 12 | Auditable manifests and reproducible joins |
| Browser evidence | Selenium Profile 9 | Workflow 14 | Production image/PDP validation |

## Improved Same-Product Matching Pipeline

Recommended sequence before involving an LLM:

1. Normalize image metadata into a dataframe:
   `fileId`, `name`, `sha256`, `phash`, `width`, `height`, `createdTime`, `localPath`, `thumbPath`.
2. Calculate quality metrics:
   blur score, brightness, dominant background color, aspect ratio, crop confidence.
3. Use perceptual hash to mark exact/near duplicates.
4. Calculate OpenCV pairwise near-duplicate score for nearest-neighbor candidates:
   grayscale, Gaussian blur, `absdiff`, threshold, changed-pixel ratio.
5. Generate visual embeddings:
   CLIP/SigLIP vector per image, stored in Parquet plus optional FAISS index.
6. Run k-nearest-neighbor search:
   `k=5` or `k=8`, cosine distance, same-folder batch scope.
7. Build candidate graph:
   images become nodes; edges connect images under the similarity threshold.
8. Cluster connected components:
   DBSCAN/agglomerative clustering for same-product candidates.
9. Assign confidence:
   high when pHash/dHash, embedding, and OpenCV near-duplicate signals agree; medium when only embeddings agree; low when images are visually close but metadata/quality conflicts.
10. Create contact sheets:
   one sheet per cluster plus nearest external negatives.
11. Send only uncertain clusters to vision LLM.

Suggested thresholds to tune locally:

- same-product score `>= 0.85`: strong same-product candidate.
- same-product score `0.60-0.85`: send both images to Gemini with a strict boolean prompt.
- same-product score `< 0.60`: treat as different product.
- pHash/dHash and OpenCV evidence are supporting signals; multi-image clusters still remain review-gated before publication.

These thresholds must be calibrated with the Galantes photo batch before production use.

Gemini prompt contract for 60-85 percent pairs:

- Attach both candidate images.
- Ask only whether both images show exactly the same physical product.
- Require JSON only: `{"sameProduct": true|false, "confidence": 0-1, "reason": "..."}`.
- Treat invalid JSON or uncertainty as `sameProduct=false`.

MediaPipe classifier integration:

- Install dependency: `python -m pip install mediapipe`.
- Configure model path with `MEDIAPIPE_IMAGE_CLASSIFIER_MODEL`.
- Official MediaPipe Image Classifier requires a compatible trained `.tflite` model and uses `ImageClassifier.create_from_options`.
- MediaPipe category output is a product-data suggestion only; it does not approve publish or same-product grouping.

## Additional n8n Nodes To Add

Add these nodes to the draft inventory before building the real n8n workflow:

| Node | Type | Purpose |
| --- | --- | --- |
| ML Dependency Check | Execute Command | Verifies Python packages: `pandas`, `pillow`, `imagehash`, `scikit-learn`, optional `faiss-cpu`, optional CLIP/SigLIP runtime |
| Build Similarity Index | Execute Command | Generates embeddings and nearest-neighbor index |
| Similarity Threshold Report | Code | Summarizes clusters by confidence and conflict |
| Contact Sheet Generator | Execute Command | Creates visual review sheets per cluster |
| LLM Cluster Judge | AI Agent / HTTP Request | Reviews only uncertain clusters |
| Human Merge/Split Review | Google Sheets | Allows user to override cluster id |
| DTO Coverage Gate | IF | Blocks publish if production Odoo has fields not represented in DTO |
| Payload Diff Preview | Code | Shows exact Odoo fields that would be created/updated |
| Publish Approval Webhook | Webhook | Captures explicit user approval before `odoo:publish` |

## Activation Order

1. Export the safe intake workflow:

```bash
node scripts/inventory-agent/nodes.mjs n8n:export-workflow
```

2. Import `data/inventory-agent/review/galantes-inventory-safe-intake-review.n8n.json` into n8n.
3. Keep the workflow inactive until reviewed.
4. Enable Workflows 1-5 and 8 only.
5. Review clusters and CSV output.
6. Enable Workflow 10 for Odoo DTO field export.
7. Enable Workflows 9, 11, and 12 for approved draft validation.
8. Keep Workflow 13 disabled until explicit production approval.
9. Enable Workflow 14 only after a controlled publish path exists.
