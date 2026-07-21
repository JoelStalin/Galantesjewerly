# Galantes Inventory Agent - Error Use Cases And Fixes

Status: active regression log.

Every error found during inventory-agent implementation must become a use case with a prevention rule, implementation fix, and verification command.

## UC-001: Google OAuth Opens File Explorer Instead Of Browser

Observed:

- `google-drive-oauth.mjs` used `explorer.exe <url>` on Windows.
- Windows opened File Explorer instead of the Google OAuth browser flow.

Prevention:

- Windows URL opening must use `rundll32.exe url.dll,FileProtocolHandler <url>`.
- The OAuth script must always print the auth URL as manual fallback.

Fix:

- `scripts/inventory-agent/google-drive-oauth.mjs` now uses `rundll32.exe`.

Verification:

```bash
node scripts/inventory-agent/google-drive-oauth.mjs
```

Expected:

- Browser opens to Google OAuth, or the printed URL can be pasted manually.

## UC-002: Wrong Python Runtime Has No Selenium Or Pip

Observed:

- `python` resolved to Hermes venv.
- That venv had no `pip` and no `selenium`.

Prevention:

- Agent scripts that call Python must support `INVENTORY_AGENT_PYTHON`.
- Selenium scripts should use the known Python 3.12 runtime when local PATH is polluted.

Fix:

- `nodes.mjs` uses `INVENTORY_AGENT_PYTHON` for ML commands.
- Testing notes must set:

```powershell
$env:INVENTORY_AGENT_PYTHON="$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
```

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:deps-check
```

Expected:

- Required Python deps are reported clearly.

## UC-003: Google Drive API Disabled

Observed:

- `drive:scan` failed because `drive.googleapis.com` was disabled in OAuth project `634248716519`.

Prevention:

- `drive:scan` failure must preserve the exact Google enablement link/error.
- Setup checklist must include enabling Google Drive API before OAuth/scan.

Fix:

- API was enabled with:

```bash
gcloud services enable drive.googleapis.com --project=634248716519
```

Verification:

```bash
node scripts/inventory-agent/nodes.mjs drive:scan
```

Expected:

- Scan writes `data/inventory-agent/manifests/drive-scan.json`.

## UC-004: Drive Scan Prints Massive JSON To Console

Observed:

- `drive:scan` printed all 1,298 files to stdout.
- This is not usable in n8n logs or Codex context.

Prevention:

- Commands must write large payloads to files and print only summaries.

Fix:

- `drive:scan`, `drive:download`, `image:features`, and `product:cluster` now print summaries.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs drive:scan
```

Expected:

- Console shows counts and output path only.

## UC-005: HEIC Images Fail Feature Extraction

Observed:

- Sharp/libvips cannot decode current HEIC files:
  `heif: Support for this compression format has not been built in`.

Prevention:

- Unsupported formats must be detected before feature extraction.
- HEIC files must be quarantined or converted through an explicit conversion step.
- JPEG-only test runs must be possible.

Fix:

- `drive:scan` supports:
  - `INVENTORY_AGENT_FILE_EXTENSIONS=.jpg,.jpeg`
  - `INVENTORY_AGENT_MIME_TYPES=image/jpeg`
  - `INVENTORY_AGENT_MAX_FILES=<n>`
- `image:features` records per-file errors instead of crashing silently.

Required next fix:

- Add a dedicated `image:convert-heic` node using an approved converter before full inventory processing.

Verification:

```bash
set INVENTORY_AGENT_FILE_EXTENSIONS=.jpg,.jpeg
set INVENTORY_AGENT_MAX_FILES=50
node scripts/inventory-agent/nodes.mjs drive:scan
node scripts/inventory-agent/nodes.mjs drive:download
node scripts/inventory-agent/nodes.mjs image:features
```

Expected:

- JPEG files produce features.
- HEIC files are excluded or logged with actionable errors.

## UC-006: Same-Product ML Clustering Is Too Permissive

Observed:

- First ML baseline grouped many different jewelry pieces together because they shared white background/display props.

Prevention:

- Color/edge similarity alone is not enough for same-product approval.
- Multi-image clusters must be marked for human/vision review.
- Publishing must not accept multi-image clusters without `reviewDecision`.

Fix:

- ML clustering thresholds were tightened.
- Cluster joining now requires dHash agreement or very strict cosine plus dHash.
- `review:export` marks multi-image clusters as `REVIEW_MERGE_OR_SPLIT`.

Required next fix:

- `review:import` must reject rows where `reviewDecision=REVIEW_MERGE_OR_SPLIT` unless the reviewer resolves it to an approved decision.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:cluster
node scripts/inventory-agent/nodes.mjs ml:contact-sheets
node scripts/inventory-agent/nodes.mjs review:export
```

Expected:

- Multi-image groups are visible in contact sheets and blocked from automatic publish.

## UC-007: Odoo Product Payload Must Not Write Computed Stock Fields

Observed:

- Product DTO includes `qty_available`, but it is computed/read-only in normal Odoo inventory flows.

Prevention:

- Bot payloads must keep approved stock separate from `product.template` values.
- Stock update flow must be a separate inventory adjustment workflow.

Fix:

- `odoo:dry-run` emits `approvedStock` separately and does not write `qty_available`.

Required next fix:

- Add explicit Odoo stock/inventory DTO and dry-run before any stock mutation.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs odoo:dry-run
```

Expected:

- Payload includes `approvedStock`, not `qty_available` inside `vals`.

## UC-008: Local Model Pretraining Is Not The Initial Strategy

Observed:

- The workflow needs image similarity, but there is not yet a labeled Galantes dataset with confirmed same-product/different-product pairs.

Prevention:

- Do not pretrain a local model from scratch for the initial workflow.
- Use deterministic features, OpenCV near-duplicate scoring, and pretrained embedding models first.
- Fine-tune only after accumulating reviewed labels from `review-queue.csv`.

Fix:

- The current ML node uses deterministic local features and nearest neighbors.
- The next model improvement should add pretrained CLIP/SigLIP embeddings behind the same `ml:build-index` command.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:build-index
node scripts/inventory-agent/nodes.mjs ml:cluster
```

Expected:

- The workflow produces auditable candidate clusters without requiring local pretraining.

## UC-009: OpenCV Pixel Difference Is Useful But Not Sufficient

Observed:

- The OpenCV article pattern of grayscale, blur, absolute difference, threshold, and changed-pixel ratio is useful for detecting near-identical images.
- For Galantes products, similar white backgrounds and display props can still mislead image similarity.

Prevention:

- Treat OpenCV `absdiff` similarity as supporting evidence only.
- Do not approve same-product clusters from OpenCV score alone.
- Continue requiring pHash/dHash agreement and human/vision review for multi-image clusters.

Fix:

- `ml_similarity.py` now records `opencvAbsDiffSimilarity` and `opencvChangedRatio` for nearest-neighbor pairs when OpenCV is installed.
- Clustering uses OpenCV only with dHash agreement.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:build-index
node scripts/inventory-agent/nodes.mjs ml:cluster
```

Expected:

- Neighbor manifests include OpenCV similarity scores.
- Multi-image clusters remain review-gated.

## UC-010: Ambiguous 60-85 Percent Similarity Must Go To Gemini

Observed:

- Local similarity can be uncertain when products share a display, background, or angle.

Prevention:

- Do not auto-merge image pairs with same-product score from 0.60 to 0.85.
- Send both images to Gemini with a strict prompt requiring JSON boolean `sameProduct`.
- Invalid JSON, uncertainty, or low confidence must be treated as `sameProduct=false`.

Fix:

- `ml_similarity.py` writes `geminiReviewPairs` for the 0.60-0.85 band.
- `gemini_same_product_review.mjs` sends paired images to Gemini and saves boolean decisions.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:cluster
node scripts/inventory-agent/nodes.mjs gemini:same-product-review
```

Expected:

- `data/inventory-agent/review/gemini-same-product-review.json` contains boolean `sameProduct` results.

## UC-011: MediaPipe Classifier Requires A Model File

Observed:

- Installing `mediapipe` is not enough for image classification.
- MediaPipe Image Classifier requires a compatible `.tflite` model path.

Prevention:

- Keep `vision:mediapipe-deps-check` explicit.
- Require `MEDIAPIPE_IMAGE_CLASSIFIER_MODEL` before MediaPipe classification is considered active.

Fix:

- `mediapipe_classifier.py` reports missing dependency/model without pretending classification ran.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs vision:mediapipe-deps-check
```

Expected:

- Reports `ok=true` only when `mediapipe` and a valid model path are present.

## UC-012: Retired Gemini Model Names Cause 404

Observed:

- `gemini-2.5-flash` returned 404 because the model is no longer available to this account.

Prevention:

- Prefer current Gemini aliases such as `gemini-flash-latest` for non-regulated review tasks.
- Keep `GEMINI_SAME_PRODUCT_MODEL` configurable in `.env.local`.

Fix:

- `gemini_same_product_review.mjs` defaults to `gemini-flash-latest`.

Verification:

```bash
set GEMINI_SAME_PRODUCT_MAX_PAIRS=2
node scripts/inventory-agent/nodes.mjs gemini:same-product-review
```

Expected:

- Gemini returns JSON boolean decisions for image pairs.

## UC-013: Gemini High Demand 503 Must Not Break The Workflow

Observed:

- `gemini-flash-latest` returned 503 `UNAVAILABLE` during a same-product review.

Prevention:

- Use a configurable fallback model list.
- If all Gemini models fail, mark the pair as `sameProduct=false` with reason `Gemini unavailable`.
- Do not auto-merge ambiguous pairs when Gemini is unavailable.

Fix:

- `gemini_same_product_review.mjs` supports `GEMINI_SAME_PRODUCT_MODELS`, defaulting to `gemini-flash-latest,gemini-flash-lite-latest`.

Verification:

```bash
set GEMINI_SAME_PRODUCT_MAX_PAIRS=2
node scripts/inventory-agent/nodes.mjs gemini:same-product-review
```

Expected:

- The command writes a review JSON even if Gemini is temporarily unavailable.

## UC-014: Google Sheets API Disabled Blocks Sheet Export

Observed:

- `review:sheet-export` failed because `sheets.googleapis.com` was disabled in OAuth project `634248716519`.
- The Google Drive connector could read the Sheet, but the local script using `googleapis.sheets` could not.

Prevention:

- Setup must enable both Drive and Sheets APIs for the OAuth project.
- `review:sheet-export` must fail before `review:import`, so stale CSV data is not treated as current approval.
- The readiness manifest must record this as a blocking prerequisite.

Fix:

- Enable the Google Sheets API in project `634248716519`.
- Keep `review:sheet-export` as the first post-review command after the trigger.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs review:sheet-export
node scripts/inventory-agent/nodes.mjs review:sheet-status
```

Expected:

- `review-sheet-export.json` is written.
- `review-queue.csv` reflects the linked Google Sheet before `review:import`.

## UC-015: Large Drive Folder Must Not Process Every Pending Image In One Trigger

Observed:

- Drive folder `Products` currently has 1,298 images.
- After seeding 70 already processed images, 1,228 remain pending.
- Processing all pending files in one trigger would make n8n runs slow and fragile.

Prevention:

- `drive:scan` must batch pending images with `INVENTORY_AGENT_MAX_QUEUE`.
- Already processed images must be skipped by signature.
- Deferred items must remain visible in `drive-scan.json`.

Fix:

- `processed-images.json` stores Drive file id plus checksum/modified-time/size signature.
- `drive:scan` defaults to `INVENTORY_AGENT_MAX_QUEUE=100` and reports `pendingTotal`, `queued`, and `deferred`.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs processed:index-rebuild
node scripts/inventory-agent/nodes.mjs drive:scan
node scripts/inventory-agent/nodes.mjs processed:index-status
```

Expected:

- Already processed images are counted as `skippedAlreadyProcessed`.
- Only one batch is queued; the rest are counted as `deferred`.

## UC-016: Google Sheets API Enabled But Token Lacks Sheets Scope

Observed:

- After enabling `sheets.googleapis.com`, `review:sheet-export` failed with `The caller does not have permission`.
- The stored OAuth token only had Drive scopes:
  `drive.readonly`, `drive.file`, and `drive.metadata.readonly`.

Prevention:

- The inventory OAuth flow must request `https://www.googleapis.com/auth/spreadsheets.readonly`.
- OAuth generation must use `include_granted_scopes=true` so Drive access is preserved while adding Sheet read access.
- `review:sheet-export` must remain before `review:import` to avoid stale approvals.

Fix:

- `scripts/inventory-agent/google-drive-oauth.mjs` now includes `spreadsheets.readonly` and `include_granted_scopes`.
- Re-run OAuth and replace `secrets/google-drive-token.json`.

Verification:

```bash
node scripts/inventory-agent/google-drive-oauth.mjs
node scripts/inventory-agent/nodes.mjs review:sheet-export
```

Expected:

- Token scope includes `https://www.googleapis.com/auth/spreadsheets.readonly`.
- `review-sheet-export.json` is written from the linked Google Sheet.

## UC-017: Stale Reviewed Cluster Manifest Must Not Override Fresh ML Clusters

Observed:

- After processing a new batch, `ml-product-clusters.json` contained 170 images.
- `ml:contact-sheets` and `review:export` still preferred an older `ml-product-clusters-reviewed.json` with 70 clusters.

Prevention:

- Reviewed cluster manifests must include the source cluster generation timestamp.
- Downstream review export/contact sheet commands must use reviewed clusters only when they match the current source cluster manifest.

Fix:

- `applyGeminiSameProductReview()` writes `sourceClusterGeneratedAt`.
- `review:export` and `ml:contact-sheets` ignore stale reviewed manifests.
- `product_metadata.py` also ignores stale reviewed manifests.
- `gemini_product_metadata.mjs` also ignores stale reviewed manifests.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:cluster
node scripts/inventory-agent/nodes.mjs ml:contact-sheets
node scripts/inventory-agent/nodes.mjs review:export
```

Expected:

- Review output cluster count matches the fresh `ml-product-clusters.json` unless a current reviewed manifest exists.

## UC-018: Connector-Created Sheets Must Be Shared With Local OAuth User

Observed:

- The Google Drive connector created/imported the review Sheet successfully.
- Local `review:sheet-export` still failed with `The caller does not have permission`.
- The local OAuth user was `ceo@galantesjewelry.com`, but the connector-created file was not shared with that user.

Prevention:

- Any connector-created review Sheet must be shared with the local OAuth user before n8n/local scripts read it.
- The OAuth token must include `spreadsheets.readonly`.
- `review-sheet.json` should track the active Sheet ID so sharing and trigger configuration target the same file.

Fix:

- Shared the active Sheet with `ceo@galantesjewelry.com` as writer.
- Re-ran `review:sheet-export`, `review:sheet-status`, `review:import`, and `odoo:dry-run`.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs review:sheet-export
node scripts/inventory-agent/nodes.mjs review:sheet-status
node scripts/inventory-agent/nodes.mjs review:import
node scripts/inventory-agent/nodes.mjs odoo:dry-run
```

Expected:

- Sheet export succeeds and local dry-run remains `writeMode=false`.

## UC-019: Public Odoo URL May Not Expose XML-RPC

Observed:

- `odoo:fields-export` with `https://odoo.galantesjewelry.com` failed at `/xmlrpc/2/common` with `404 Not Found`.
- Alternate documented host `https://galantes-odoo.getupsoft.com.do` failed DNS resolution from the local environment.

Prevention:

- Do not assume the public Odoo web URL exposes XML-RPC.
- Keep `odoo:fields-export` read-only and fail closed when the endpoint is unavailable.
- Do not change tunnel, reverse proxy, DNS, or service topology to make XML-RPC reachable without explicit approval.

Fix:

- Keep `odoo:fields-export` blocked until an approved read-only Odoo API endpoint is provided.
- Prefer an internal/staging endpoint or approved JSON-2 bearer token path for field export.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs odoo:fields-export
```

Expected:

- Succeeds only when `ODOO_BASE_URL`, database, and credential point to an approved read-only endpoint.

## UC-020: Cluster Inspection Must Use Current Manifest Schema

Observed:

- A validation snippet assumed clusters expose `imageIds`.
- The current manifest schema stores images under `files`.
- The ML node succeeded, but the ad hoc validation exited non-zero after clustering.

Prevention:

- Use schema-tolerant inspection snippets that accept `files`, `imageIds`, or `images`.
- Treat validation snippet failures separately from node failures when the node output already reports `ok: true`.

Fix:

- Update inspection snippets to derive the cluster size from `files.length`, `imageIds.length`, or `images.length`.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:cluster
node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync('data/inventory-agent/manifests/ml-product-clusters.json','utf8')).clusters; console.log(c.length)"
```

Expected:

- Cluster inspection completes without changing the generated manifest.

## UC-021: Mass Similarity Index Can Exceed Short Command Timeouts

Observed:

- `ml:build-index` for 770 images exceeded a 30 minute shell timeout.
- The command had already regenerated feature/vector artifacts for 770 images, but the nearest-neighbor parquet and index manifest still reflected the prior 670-image run.

Prevention:

- Check `ml:index-status` after any timeout and compare `indexedImages` with `currentFeatureImages`.
- Do not continue to `ml:cluster` unless the index manifest image count matches the current feature count.
- Use a longer timeout for large batches or optimize OpenCV pair scoring before scaling further.

Fix:

- Re-ran `ml:build-index` with a 60 minute timeout, then ran `ml:cluster`.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:index-status
node scripts/inventory-agent/nodes.mjs ml:cluster
```

Expected:

- `indexedImages` equals `currentFeatureImages` and clustering uses the latest neighbor parquet.

## UC-022: OpenCV Cache Optimization Must Preserve Derived Dimensions

Observed:

- While optimizing `ml:build-index`, the resized image `size` constant moved into `opencv_prepare_absdiff_image()`.
- `opencv_absdiff_similarity()` still referenced `size`, causing `NameError: name 'size' is not defined`.

Prevention:

- After performance edits, immediately rerun the affected node before continuing the batch loop.
- Compute totals from the prepared image shape instead of a local constant that can drift out of scope.

Fix:

- Changed total pixel count to `left.shape[0] * left.shape[1]`.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:build-index
```

Expected:

- Index rebuild completes with the cached OpenCV path and no `NameError`.

## UC-023: Transitive Similarity Can Create Oversized Candidate Clusters

Observed:

- At 970 processed images, connected-component clustering produced a 45-image candidate cluster.
- The large component had strong local pair similarities, but transitive chaining can mix products across a long visual chain.

Prevention:

- Treat oversized non-high-confidence components as unsafe for automatic merge.
- Keep all images in review, but split large candidate components into single-image review rows.

Fix:

- Added `--max-candidate-component-size` defaulting to 25.
- Components above that limit are split into singles with `large_candidate_component_split`.

Verification:

```bash
node scripts/inventory-agent/nodes.mjs ml:cluster
```

Expected:

- No candidate component above the configured limit is exported as one merged product row.
