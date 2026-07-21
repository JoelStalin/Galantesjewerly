import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const envPath = path.join(root, '.env.local');
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1JzM1wpBtvM8ILEnYu0t5qBtG8pMYht6u?usp=sharing';

const NODE_DEFINITIONS = [
  {
    id: 'drive_incremental_ingest',
    command: 'drive:scan',
    llmAllowed: false,
    description: 'List Google Drive folder, compare against local manifest, and produce new/changed file queue.',
    output: 'data/inventory-agent/manifests/drive-scan.json',
  },
  {
    id: 'drive_download',
    command: 'drive:download',
    llmAllowed: false,
    description: 'Download queued Drive photos into raw local storage with sha256 checksums.',
    output: 'data/inventory-agent/manifests/downloads.json',
  },
  {
    id: 'image_feature_extract',
    command: 'image:features',
    llmAllowed: false,
    description: 'Generate deterministic image hashes, quality metrics, thumbnails, and vector input manifest.',
    output: 'data/inventory-agent/manifests/image-features.json',
  },
  {
    id: 'processed_image_index_status',
    command: 'processed:index-status',
    llmAllowed: false,
    description: 'Summarize the processed image index used to avoid reprocessing unchanged Drive images.',
    output: 'data/inventory-agent/manifests/processed-images.json',
  },
  {
    id: 'processed_image_index_rebuild',
    command: 'processed:index-rebuild',
    llmAllowed: false,
    description: 'Rebuild processed-images.json from existing image-features/download manifests without recomputing images.',
    output: 'data/inventory-agent/manifests/processed-images.json',
  },
  {
    id: 'image_convert_dependency_check',
    command: 'image:convert-deps-check',
    llmAllowed: false,
    description: 'Verify local image conversion dependencies before HEIC/HEIF normalization.',
    output: 'data/inventory-agent/manifests/image-convert-deps-check.json',
  },
  {
    id: 'image_convert_heic',
    command: 'image:convert-heic',
    llmAllowed: false,
    description: 'Convert HEIC/HEIF downloads into JPEG copies and write a normalized downloads manifest.',
    output: 'data/inventory-agent/manifests/downloads-normalized.json',
  },
  {
    id: 'product_cluster',
    command: 'product:cluster',
    llmAllowed: false,
    description: 'Cluster photos by same-product similarity using local vectors/hashes.',
    output: 'data/inventory-agent/manifests/product-clusters.json',
  },
  {
    id: 'ml_dependency_check',
    command: 'ml:deps-check',
    llmAllowed: false,
    description: 'Verify local Python ML dependencies before nearest-neighbor image matching.',
    output: 'data/inventory-agent/manifests/ml-deps-check.json',
  },
  {
    id: 'ml_similarity_index',
    command: 'ml:build-index',
    llmAllowed: false,
    description: 'Build dataframe, deterministic image vectors, and nearest-neighbor pairs for same-product matching.',
    output: 'data/inventory-agent/manifests/ml-similarity-index.json',
  },
  {
    id: 'ml_similarity_index_status',
    command: 'ml:index-status',
    llmAllowed: false,
    description: 'Summarize the reusable mass-comparison vector index and nearest-neighbor outputs.',
    output: 'data/inventory-agent/manifests/ml-similarity-index.json',
  },
  {
    id: 'ml_product_cluster',
    command: 'ml:cluster',
    llmAllowed: false,
    description: 'Build candidate product clusters from nearest-neighbor and perceptual-hash edges.',
    output: 'data/inventory-agent/manifests/ml-product-clusters.json',
  },
  {
    id: 'ml_contact_sheets',
    command: 'ml:contact-sheets',
    llmAllowed: false,
    description: 'Generate visual contact sheets for human cluster review.',
    output: 'data/inventory-agent/review/contact-sheets.json',
  },
  {
    id: 'vision_yolo_dependency_check',
    command: 'vision:yolo-deps-check',
    llmAllowed: false,
    description: 'Verify YOLOv8n dependencies before object/category suggestion.',
    output: 'data/inventory-agent/manifests/yolo-deps-check.json',
  },
  {
    id: 'vision_yolo_classify',
    command: 'vision:yolo-classify',
    llmAllowed: false,
    description: 'Run YOLOv8n object detection and category suggestions for product review metadata.',
    output: 'data/inventory-agent/manifests/yolo-category-suggestions.json',
  },
  {
    id: 'vision_mediapipe_dependency_check',
    command: 'vision:mediapipe-deps-check',
    llmAllowed: false,
    description: 'Verify MediaPipe image classifier dependency/model for category suggestions.',
    output: 'data/inventory-agent/manifests/mediapipe-deps-check.json',
  },
  {
    id: 'gemini_same_product_review',
    command: 'gemini:same-product-review',
    llmAllowed: true,
    preferredProviders: ['gemini'],
    description: 'Ask Gemini boolean sameProduct for local-similarity pairs in the 60-85 percent band.',
    output: 'data/inventory-agent/review/gemini-same-product-review.json',
  },
  {
    id: 'gemini_apply_same_product_review',
    command: 'gemini:apply-same-product-review',
    llmAllowed: false,
    description: 'Apply Gemini boolean same-product decisions to candidate clusters and keep rejected pairs separated.',
    output: 'data/inventory-agent/manifests/ml-product-clusters-reviewed.json',
  },
  {
    id: 'cluster_review_reasoning',
    command: 'cluster:review',
    llmAllowed: true,
    preferredProviders: ['ollama', 'hermes', 'gemini', 'openai'],
    description: 'Ask a model only for uncertain merge/split decisions after deterministic clustering.',
    output: 'data/inventory-agent/review/cluster-review.json',
  },
  {
    id: 'image_enhance',
    command: 'image:enhance',
    llmAllowed: true,
    preferredProviders: ['local-tools', 'gemini'],
    description: 'Apply local image cleanup first, then Gemini/Nano Banana only when configured and needed.',
    output: 'data/inventory-agent/edited/',
  },
  {
    id: 'description_generate',
    command: 'description:generate',
    llmAllowed: true,
    preferredProviders: ['ollama', 'hermes', 'gemini', 'openai'],
    description: 'Generate product copy from approved cluster metadata; never generate price, cost, or stock.',
    output: 'data/inventory-agent/manifests/product-copy.json',
  },
  {
    id: 'product_metadata_suggest',
    command: 'product:metadata-suggest',
    llmAllowed: false,
    description: 'Suggest reviewable product name, category, and material from local image/cluster evidence.',
    output: 'data/inventory-agent/manifests/product-metadata-suggestions.json',
  },
  {
    id: 'gemini_product_metadata',
    command: 'gemini:product-metadata',
    llmAllowed: true,
    preferredProviders: ['gemini'],
    description: 'Ask Gemini for reviewable product name, category, material, and short description suggestions.',
    output: 'data/inventory-agent/review/gemini-product-metadata.json',
  },
  {
    id: 'review_export',
    command: 'review:export',
    llmAllowed: false,
    description: 'Export CSV/JSON review queue for user price, cost, stock, merge/split, and publish approval.',
    output: 'data/inventory-agent/review/review-queue.csv',
  },
  {
    id: 'review_seed_estimates',
    command: 'review:seed-estimates',
    llmAllowed: false,
    description: 'Fill missing draft price/cost estimates and stock zero while preserving manual review decisions; never publishes products.',
    output: 'data/inventory-agent/manifests/review-seed-estimates.json',
  },
  {
    id: 'autocorrection_loop',
    command: 'inventory:autocorrect-loop',
    llmAllowed: false,
    description: 'Reconcile deterministic classification, metadata suggestions, and human-review blockers without approving publication.',
    output: 'data/inventory-agent/manifests/autocorrection-loop.json',
  },
  {
    id: 'review_import',
    command: 'review:import',
    llmAllowed: false,
    description: 'Import user-approved review queue and validate required price/cost/stock fields.',
    output: 'data/inventory-agent/manifests/approved-products.json',
  },
  {
    id: 'review_sheet_status',
    command: 'review:sheet-status',
    llmAllowed: false,
    description: 'Print the linked Google Sheets review manifest and local CSV readiness before post-review import.',
    output: 'data/inventory-agent/manifests/review-sheet-status.json',
  },
  {
    id: 'review_sheet_export',
    command: 'review:sheet-export',
    llmAllowed: false,
    description: 'Read the linked Google Sheet review table and overwrite review-queue.csv with validated columns.',
    output: 'data/inventory-agent/review/review-queue.csv',
  },
  {
    id: 'publish_odoo_dry_run',
    command: 'odoo:dry-run',
    llmAllowed: false,
    description: 'Validate Odoo payloads locally without writing to production.',
    output: 'data/inventory-agent/manifests/odoo-dry-run.json',
  },
  {
    id: 'odoo_product_fields_export',
    command: 'odoo:fields-export',
    llmAllowed: false,
    description: 'Read product.template fields_get from Odoo and export a production field catalog for DTO validation.',
    output: 'data/inventory-agent/manifests/odoo-product-template-fields.json',
  },
  {
    id: 'publish_odoo_draft',
    command: 'odoo:publish',
    llmAllowed: false,
    description: 'Create/update approved products and galleries in Galantes production Odoo after approval gates.',
    output: 'data/inventory-agent/manifests/publication-result.json',
  },
  {
    id: 'publication_evidence',
    command: 'qa:selenium-profile9',
    llmAllowed: false,
    description: 'Run real Selenium Profile 9 evidence checks against production Odoo/storefront.',
    output: 'data/inventory-agent/evidence/',
  },
  {
    id: 'workflow_status',
    command: 'status',
    llmAllowed: false,
    description: 'Print current manifests, pending approvals, and publication state.',
    output: 'stdout',
  },
  {
    id: 'known_error_use_cases',
    command: 'errors:use-cases',
    llmAllowed: false,
    description: 'Print the active error use-case registry for workflow regression checks.',
    output: 'docs/inventory-agent-error-use-cases.md',
  },
  {
    id: 'n8n_workflow_export',
    command: 'n8n:export-workflow',
    llmAllowed: false,
    description: 'Export the safe n8n intake/review workflow JSON for manual import.',
    output: 'data/inventory-agent/review/galantes-inventory-safe-intake-review.n8n.json',
  },
];

async function ensureDirs() {
  const dirs = [
    'data/inventory-agent/raw',
    'data/inventory-agent/converted',
    'data/inventory-agent/edited',
    'data/inventory-agent/thumbs',
    'data/inventory-agent/manifests',
    'data/inventory-agent/vectors',
    'data/inventory-agent/review',
    'data/inventory-agent/logs',
    'data/inventory-agent/evidence',
  ];
  await Promise.all(dirs.map((dir) => fs.mkdir(path.join(root, dir), { recursive: true })));
}

async function loadEnvFile() {
  const content = await fs.readFile(envPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key]) process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function readJson(relativePath, fallback = null) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function loadProductDto() {
  return readJson('scripts/inventory-agent/odoo-product-template.dto.json');
}

function getDriveFolderId() {
  const configured = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (configured) return configured;
  const match = DRIVE_FOLDER_URL.match(/folders\/([^?]+)/);
  return match?.[1];
}

async function getDriveClient() {
  await loadEnvFile();
  const clientJson = process.env.GOOGLE_OAUTH_CLIENT_JSON || 'secrets/google-drive-oauth-client.json';
  const tokenJson = process.env.GOOGLE_DRIVE_TOKEN_JSON || 'secrets/google-drive-token.json';
  const clientPayload = JSON.parse(await fs.readFile(path.resolve(root, clientJson), 'utf8'));
  const config = clientPayload.installed || clientPayload.web;
  if (!config?.client_id || !config?.client_secret) {
    throw new Error(`Invalid Google OAuth client JSON: ${clientJson}`);
  }
  const tokens = JSON.parse(await fs.readFile(path.resolve(root, tokenJson), 'utf8'));
  const auth = new OAuth2Client(config.client_id, config.client_secret, process.env.GOOGLE_OAUTH_REDIRECT_URI);
  auth.setCredentials(tokens);
  return google.drive({ version: 'v3', auth });
}

async function getSheetsClient() {
  await loadEnvFile();
  const clientJson = process.env.GOOGLE_OAUTH_CLIENT_JSON || 'secrets/google-drive-oauth-client.json';
  const tokenJson = process.env.GOOGLE_DRIVE_TOKEN_JSON || 'secrets/google-drive-token.json';
  const clientPayload = JSON.parse(await fs.readFile(path.resolve(root, clientJson), 'utf8'));
  const config = clientPayload.installed || clientPayload.web;
  if (!config?.client_id || !config?.client_secret) {
    throw new Error(`Invalid Google OAuth client JSON: ${clientJson}`);
  }
  const tokens = JSON.parse(await fs.readFile(path.resolve(root, tokenJson), 'utf8'));
  const auth = new OAuth2Client(config.client_id, config.client_secret, process.env.GOOGLE_OAUTH_REDIRECT_URI);
  auth.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth });
}

function safeName(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
}

function csvValue(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else if (char === '"') {
      quoted = true;
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hammingDistanceHex(a, b) {
  const left = BigInt(`0x${a}`);
  const right = BigInt(`0x${b}`);
  let value = left ^ right;
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

async function dHash(filePath) {
  const { data } = await sharp(filePath)
    .rotate()
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      bits <<= 1n;
      if (data[y * 9 + x] > data[y * 9 + x + 1]) bits |= 1n;
    }
  }
  return bits.toString(16).padStart(16, '0');
}

function getDefinitionByCommand(command) {
  return NODE_DEFINITIONS.find((node) => node.command === command);
}

function driveFileSignature(file) {
  return [
    file.id || '',
    file.md5Checksum || '',
    file.modifiedTime || '',
    file.size || '',
  ].join(':');
}

async function loadProcessedImageIndex() {
  const payload = await readJson('data/inventory-agent/manifests/processed-images.json', { files: [] });
  return new Map((payload.files || []).map((file) => [file.id, file]));
}

async function writeNodeManifest() {
  await writeJson('scripts/inventory-agent/node-manifest.generated.json', {
    generatedAt: new Date().toISOString(),
    rule: 'Script-first execution. LLM calls are forbidden unless llmAllowed=true for the node.',
    nodes: NODE_DEFINITIONS,
  });
}

async function driveScan() {
  await ensureDirs();
  const folderId = getDriveFolderId();
  if (!folderId) throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID.');
  const drive = await getDriveClient();
  const files = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, md5Checksum)',
      orderBy: 'createdTime,name',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  const existingDownloads = await readJson('data/inventory-agent/manifests/downloads.json', { files: [] });
  const downloaded = new Map((existingDownloads.files || []).map((file) => [file.id, file]));
  const processed = await loadProcessedImageIndex();
  const maxFiles = Number(process.env.INVENTORY_AGENT_MAX_FILES || '0');
  const maxQueue = Number(process.env.INVENTORY_AGENT_MAX_QUEUE || '100');
  const extensions = (process.env.INVENTORY_AGENT_FILE_EXTENSIONS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const mimeTypes = (process.env.INVENTORY_AGENT_MIME_TYPES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const filteredFiles = files.filter((file) => {
    const ext = path.extname(file.name || '').toLowerCase();
    const mime = String(file.mimeType || '').toLowerCase();
    return (!extensions.length || extensions.includes(ext)) && (!mimeTypes.length || mimeTypes.includes(mime));
  });
  const candidateFiles = maxFiles > 0 ? filteredFiles.slice(0, maxFiles) : filteredFiles;
  const pendingQueue = [];
  const skippedAlreadyProcessed = [];
  for (const file of candidateFiles) {
    const signature = driveFileSignature(file);
    const processedEntry = processed.get(file.id);
    const downloadedEntry = downloaded.get(file.id);
    if (processedEntry?.signature === signature && processedEntry?.featureStatus === 'ok') {
      skippedAlreadyProcessed.push({ ...file, skipReason: 'already_processed', signature });
      continue;
    }
    if (downloadedEntry && driveFileSignature(downloadedEntry) === signature && downloadedEntry.sha256) {
      pendingQueue.push({ ...file, localPath: downloadedEntry.localPath, sha256: downloadedEntry.sha256, queueReason: 'downloaded_not_processed_or_index_missing' });
      continue;
    }
    pendingQueue.push({ ...file, queueReason: processedEntry ? 'modified_since_processed' : 'new_image', signature });
  }
  const queued = maxQueue > 0 ? pendingQueue.slice(0, maxQueue) : pendingQueue;
  const deferred = maxQueue > 0 ? pendingQueue.slice(maxQueue) : [];
  const payload = {
    ok: true,
    scannedAt: new Date().toISOString(),
    folderId,
    total: files.length,
    filtered: filteredFiles.length,
    selected: candidateFiles.length,
    queued: queued.length,
    pendingTotal: pendingQueue.length,
    deferred: deferred.length,
    maxQueue,
    skippedAlreadyProcessed: skippedAlreadyProcessed.length,
    files: candidateFiles,
    queue: queued,
    deferredQueue: deferred,
    skipped: skippedAlreadyProcessed,
    processedIndex: 'data/inventory-agent/manifests/processed-images.json',
  };
  await writeJson('data/inventory-agent/manifests/drive-scan.json', payload);
  console.log(JSON.stringify({
    ok: payload.ok,
    scannedAt: payload.scannedAt,
    folderId: payload.folderId,
    total: payload.total,
    filtered: payload.filtered,
    selected: payload.selected,
    queued: payload.queued,
    pendingTotal: payload.pendingTotal,
    deferred: payload.deferred,
    maxQueue: payload.maxQueue,
    skippedAlreadyProcessed: payload.skippedAlreadyProcessed,
    output: 'data/inventory-agent/manifests/drive-scan.json',
  }, null, 2));
}

async function driveDownload() {
  await ensureDirs();
  const scan = await readJson('data/inventory-agent/manifests/drive-scan.json');
  if (!scan) throw new Error('Missing drive-scan.json. Run drive:scan first.');
  const drive = await getDriveClient();
  const previous = await readJson('data/inventory-agent/manifests/downloads.json', { files: [] });
  const byId = new Map((previous.files || []).map((file) => [file.id, file]));
  const queue = scan.queue || [];
  const downloaded = [];
  const skipped = [];

  for (const file of queue) {
    const extension = path.extname(file.name) || '.jpg';
    const localName = `${file.id}-${safeName(path.basename(file.name, extension))}${extension}`;
    const relativePath = path.join('data/inventory-agent/raw', localName).replace(/\\/g, '/');
    const absolutePath = path.join(root, relativePath);
    const current = byId.get(file.id);
    if (current?.md5Checksum === file.md5Checksum && current?.sha256) {
      downloaded.push(current);
      continue;
    }
    if (file.localPath && file.sha256) {
      downloaded.push(file);
      byId.set(file.id, { ...file, downloadedAt: current?.downloadedAt || new Date().toISOString() });
      continue;
    }
    let lastDownloadError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let response;
      try {
        response = await drive.files.get({ fileId: file.id, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Drive download timeout after 120s (attempt ${attempt})`)), 120000);
          pipeline(response.data, createWriteStream(absolutePath))
            .then(resolve, reject)
            .finally(() => clearTimeout(timer));
        });
        lastDownloadError = null;
        break;
      } catch (error) {
        lastDownloadError = error;
        response?.data?.destroy?.(error);
        await fs.rm(absolutePath, { force: true });
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
    if (lastDownloadError) throw new Error(`Unable to download Drive file ${file.id}: ${lastDownloadError.message}`);
    const sha256 = await sha256File(absolutePath);
    const entry = { ...file, localPath: relativePath, sha256, downloadedAt: new Date().toISOString() };
    byId.set(file.id, entry);
    downloaded.push(entry);
  }

  const payload = {
    ok: true,
    downloadedAt: new Date().toISOString(),
    files: Array.from(byId.values()).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    downloadedThisRun: downloaded.length,
    skippedThisRun: skipped.length,
    sourceQueue: 'data/inventory-agent/manifests/drive-scan.json',
  };
  await writeJson('data/inventory-agent/manifests/downloads.json', payload);
  console.log(JSON.stringify({
    ok: payload.ok,
    downloadedAt: payload.downloadedAt,
    totalLocalFiles: payload.files.length,
    downloadedThisRun: payload.downloadedThisRun,
    output: 'data/inventory-agent/manifests/downloads.json',
  }, null, 2));
}

async function imageFeatures() {
  await ensureDirs();
  const downloads = await readJson('data/inventory-agent/manifests/downloads-normalized.json')
    || await readJson('data/inventory-agent/manifests/downloads.json');
  if (!downloads) throw new Error('Missing downloads manifest. Run drive:download first.');
  const scan = await readJson('data/inventory-agent/manifests/drive-scan.json', { queue: null });
  const previousFeatures = await readJson('data/inventory-agent/manifests/image-features.json', { files: [] });
  const queuedIds = Array.isArray(scan.queue) ? new Set(scan.queue.map((file) => file.id)) : null;
  const downloadFiles = queuedIds
    ? (downloads.files || []).filter((file) => queuedIds.has(file.id))
    : (downloads.files || []);
  const unchangedFeatures = queuedIds
    ? (previousFeatures.files || []).filter((file) => !queuedIds.has(file.id))
    : [];
  const features = [...unchangedFeatures];
  const errors = [];
  const processed = await loadProcessedImageIndex();
  for (const file of downloadFiles) {
    const absolutePath = path.join(root, file.localPath);
    try {
      const metadata = await sharp(absolutePath).metadata();
      const hash = await dHash(absolutePath);
      const thumbName = `${file.id}.webp`;
      const thumbRelativePath = `data/inventory-agent/thumbs/${thumbName}`;
      await sharp(absolutePath)
        .rotate()
        .resize(420, 420, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(root, thumbRelativePath));
      const feature = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: Number(file.size || 0),
        localPath: file.localPath,
        thumbPath: thumbRelativePath,
        sha256: file.sha256,
        dhash: hash,
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || '',
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      };
      features.push(feature);
      processed.set(file.id, {
        id: file.id,
        name: file.name,
        localPath: file.localPath,
        thumbPath: thumbRelativePath,
        sha256: file.sha256,
        md5Checksum: file.md5Checksum || '',
        modifiedTime: file.modifiedTime || '',
        size: file.size || '',
        signature: driveFileSignature(file),
        featureStatus: 'ok',
        featureGeneratedAt: new Date().toISOString(),
      });
    } catch (error) {
      errors.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        localPath: file.localPath,
        error: error instanceof Error ? error.message : String(error),
      });
      processed.set(file.id, {
        id: file.id,
        name: file.name,
        localPath: file.localPath,
        md5Checksum: file.md5Checksum || '',
        modifiedTime: file.modifiedTime || '',
        size: file.size || '',
        signature: driveFileSignature(file),
        featureStatus: 'error',
        error: error instanceof Error ? error.message : String(error),
        featureGeneratedAt: new Date().toISOString(),
      });
    }
  }
  const sortedFeatures = features.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const payload = {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    mode: queuedIds ? 'incremental' : 'full',
    processedThisRun: downloadFiles.length,
    preservedFromPreviousIndex: unchangedFeatures.length,
    files: sortedFeatures,
    errors,
  };
  await writeJson('data/inventory-agent/manifests/image-features.json', payload);
  await writeJson('data/inventory-agent/manifests/processed-images.json', {
    ok: true,
    updatedAt: new Date().toISOString(),
    files: Array.from(processed.values()).sort((a, b) => String(a.name).localeCompare(String(b.name))),
  });
  console.log(JSON.stringify({
    ok: payload.ok,
    generatedAt: payload.generatedAt,
    mode: payload.mode,
    files: payload.files.length,
    processedThisRun: payload.processedThisRun,
    preservedFromPreviousIndex: payload.preservedFromPreviousIndex,
    errors: payload.errors.length,
    output: 'data/inventory-agent/manifests/image-features.json',
    processedIndex: 'data/inventory-agent/manifests/processed-images.json',
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

async function processedIndexStatus() {
  await ensureDirs();
  const processed = await readJson('data/inventory-agent/manifests/processed-images.json', { files: [] });
  const scan = await readJson('data/inventory-agent/manifests/drive-scan.json', { queued: 0, skippedAlreadyProcessed: 0 });
  const files = processed.files || [];
  const okCount = files.filter((file) => file.featureStatus === 'ok').length;
  const errorCount = files.filter((file) => file.featureStatus === 'error').length;
  console.log(JSON.stringify({
    ok: true,
    processedIndex: 'data/inventory-agent/manifests/processed-images.json',
    indexedImages: files.length,
    okImages: okCount,
    errorImages: errorCount,
    currentDriveQueue: scan.queued || 0,
    pendingTotal: scan.pendingTotal || scan.queued || 0,
    deferred: scan.deferred || 0,
    maxQueue: scan.maxQueue || null,
    skippedAlreadyProcessed: scan.skippedAlreadyProcessed || 0,
  }, null, 2));
}

async function processedIndexRebuild() {
  await ensureDirs();
  const features = await readJson('data/inventory-agent/manifests/image-features.json', { files: [] });
  const downloads = await readJson('data/inventory-agent/manifests/downloads-normalized.json')
    || await readJson('data/inventory-agent/manifests/downloads.json', { files: [] });
  const downloadById = new Map((downloads.files || []).map((file) => [file.id, file]));
  const files = [];
  for (const feature of features.files || []) {
    const source = downloadById.get(feature.id) || feature;
    files.push({
      id: feature.id,
      name: feature.name,
      localPath: feature.localPath,
      thumbPath: feature.thumbPath,
      sha256: feature.sha256,
      md5Checksum: source.md5Checksum || '',
      modifiedTime: source.modifiedTime || feature.modifiedTime || '',
      size: source.size || feature.size || '',
      signature: driveFileSignature(source),
      featureStatus: 'ok',
      featureGeneratedAt: features.generatedAt || new Date().toISOString(),
      rebuiltFrom: 'data/inventory-agent/manifests/image-features.json',
    });
  }
  const payload = {
    ok: true,
    rebuiltAt: new Date().toISOString(),
    sourceFeatures: 'data/inventory-agent/manifests/image-features.json',
    sourceDownloads: 'data/inventory-agent/manifests/downloads.json',
    files: files.sort((a, b) => String(a.name).localeCompare(String(b.name))),
  };
  await writeJson('data/inventory-agent/manifests/processed-images.json', payload);
  console.log(JSON.stringify({
    ok: true,
    indexedImages: payload.files.length,
    output: 'data/inventory-agent/manifests/processed-images.json',
  }, null, 2));
}

async function mlIndexStatus() {
  await ensureDirs();
  const index = await readJson('data/inventory-agent/manifests/ml-similarity-index.json', {});
  const featureManifest = await readJson('data/inventory-agent/manifests/image-features.json', { files: [] });
  const vectorPaths = [
    'data/inventory-agent/vectors/image-features.parquet',
    'data/inventory-agent/vectors/image-vectors.npy',
    'data/inventory-agent/vectors/image-neighbors.parquet',
  ];
  const files = await Promise.all(vectorPaths.map(async (relativePath) => {
    const absolutePath = path.join(root, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    return {
      path: relativePath,
      exists: Boolean(stat),
      bytes: stat?.size || 0,
      modifiedAt: stat?.mtime?.toISOString?.() || null,
    };
  }));
  console.log(JSON.stringify({
    ok: files.every((file) => file.exists),
    indexManifest: 'data/inventory-agent/manifests/ml-similarity-index.json',
    indexedImages: index.images || 0,
    currentFeatureImages: featureManifest.files?.length || 0,
    neighbors: index.neighbors || 0,
    method: index.method || null,
    files,
  }, null, 2));
}

async function productCluster() {
  await ensureDirs();
  const manifest = await readJson('data/inventory-agent/manifests/image-features.json');
  if (!manifest) throw new Error('Missing image-features.json. Run image:features first.');
  const threshold = Number(process.env.INVENTORY_DHASH_CLUSTER_THRESHOLD || '10');
  const clusters = [];
  for (const file of manifest.files || []) {
    let target = null;
    let bestDistance = Infinity;
    for (const cluster of clusters) {
      const distance = hammingDistanceHex(file.dhash, cluster.representative.dhash);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = cluster;
      }
    }
    if (target && bestDistance <= threshold) {
      target.files.push(file);
      target.maxDistance = Math.max(target.maxDistance, bestDistance);
    } else {
      clusters.push({
        clusterId: `cluster-${String(clusters.length + 1).padStart(4, '0')}`,
        status: 'needs_review',
        confidence: 'candidate',
        representative: file,
        maxDistance: 0,
        files: [file],
      });
    }
  }
  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    method: 'dhash-hamming',
    threshold,
    clusters,
  };
  await writeJson('data/inventory-agent/manifests/product-clusters.json', payload);
  console.log(JSON.stringify({
    ok: payload.ok,
    generatedAt: payload.generatedAt,
    method: payload.method,
    threshold: payload.threshold,
    clusters: payload.clusters.length,
    multiImageClusters: payload.clusters.filter((cluster) => cluster.files.length > 1).length,
    output: 'data/inventory-agent/manifests/product-clusters.json',
  }, null, 2));
}

async function reviewExport() {
  await ensureDirs();
  const reviewedManifest = await readJson('data/inventory-agent/manifests/ml-product-clusters-reviewed.json');
  const mlManifest = await readJson('data/inventory-agent/manifests/ml-product-clusters.json');
  const manifest = (
    reviewedManifest?.sourceClusterGeneratedAt
    && mlManifest?.generatedAt
    && reviewedManifest.sourceClusterGeneratedAt === mlManifest.generatedAt
  )
    ? reviewedManifest
    : mlManifest
    || await readJson('data/inventory-agent/manifests/product-clusters.json');
  if (!manifest) throw new Error('Missing cluster manifest. Run ml:cluster or product:cluster first.');
  const metadata = await readJson('data/inventory-agent/manifests/product-metadata-suggestions.json', { suggestions: [] });
  const suggestionByCluster = new Map((metadata.suggestions || []).map((item) => [item.clusterId, item]));
  const rows = [
    ['clusterId', 'reviewDecision', 'approvePublish', 'productName', 'category', 'material', 'price', 'cost', 'stock', 'description', 'representativeImage', 'contactSheet', 'imageCount', 'confidence', 'suggestedProductName', 'suggestedCategory', 'categoryConfidence', 'suggestedMaterial', 'materialConfidence', 'notes'],
  ];
  for (const cluster of manifest.clusters || []) {
    const suggestion = suggestionByCluster.get(cluster.clusterId) || {};
    rows.push([
      cluster.clusterId,
      cluster.files?.length > 1 ? 'REVIEW_MERGE_OR_SPLIT' : 'SINGLE_IMAGE',
      'NO',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      cluster.representative?.thumbPath || cluster.representative?.localPath || '',
      `data/inventory-agent/review/${cluster.clusterId}-contact-sheet.jpg`,
      String(cluster.files?.length || 0),
      cluster.confidence || '',
      suggestion.suggestedProductName || '',
      suggestion.suggestedCategory || '',
      suggestion.categoryConfidence ?? '',
      suggestion.suggestedMaterial || '',
      suggestion.materialConfidence ?? '',
      '',
    ]);
  }
  const csv = `${rows.map((row) => row.map(csvValue).join(',')).join('\n')}\n`;
  const relativePath = 'data/inventory-agent/review/review-queue.csv';
  await fs.writeFile(path.join(root, relativePath), csv);
  const payload = { ok: true, exportedAt: new Date().toISOString(), reviewQueue: relativePath, clusters: manifest.clusters?.length || 0 };
  await writeJson('data/inventory-agent/review/review-queue.json', payload);
  console.log(JSON.stringify(payload, null, 2));
}

async function reviewImport() {
  await ensureDirs();
  const reviewPath = path.join(root, 'data/inventory-agent/review/review-queue.csv');
  const content = await fs.readFile(reviewPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || '');
  const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  const approved = [];
  const rejected = [];
  for (const row of rows) {
    const wantsPublish = String(row.approvePublish || '').trim().toUpperCase() === 'YES';
    if (!wantsPublish) continue;
    const reviewDecision = String(row.reviewDecision || '').trim().toUpperCase();
    const unresolvedMergeDecision = ['REVIEW_MERGE_OR_SPLIT', 'UNCERTAIN', 'HUMAN_REVIEW'].includes(reviewDecision);
    const allowedReviewDecision = ['SAME_PRODUCT', 'SINGLE_IMAGE'].includes(reviewDecision);
    const missing = ['productName', 'price', 'cost', 'stock'].filter((key) => !String(row[key] || '').trim());
    if (missing.length || unresolvedMergeDecision || !allowedReviewDecision) {
      rejected.push({
        clusterId: row.clusterId,
        missing,
        unresolvedMergeDecision,
        invalidReviewDecision: !allowedReviewDecision,
        reviewDecision: row.reviewDecision || '',
      });
    } else {
      approved.push(row);
    }
  }
  const payload = {
    ok: rejected.length === 0,
    importedAt: new Date().toISOString(),
    approved,
    rejected,
    message: rejected.length
      ? 'Some approved rows are missing required productName, price, cost, stock, or do not have reviewDecision=SAME_PRODUCT/SINGLE_IMAGE.'
      : 'Approved review rows are ready for dry-run validation.',
  };
  await writeJson('data/inventory-agent/manifests/approved-products.json', payload);
  console.log(JSON.stringify(payload, null, 2));
  if (rejected.length) process.exitCode = 1;
}

async function reviewSheetStatus() {
  await ensureDirs();
  const sheet = await readJson('data/inventory-agent/manifests/review-sheet.json', {});
  const reviewPath = path.join(root, 'data/inventory-agent/review/review-queue.csv');
  const content = await fs.readFile(reviewPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] || '');
  const rows = lines.slice(1).map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  const requiredHeaders = ['clusterId', 'reviewDecision', 'approvePublish', 'productName', 'category', 'material', 'price', 'cost', 'stock'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  const approvedRows = rows.filter((row) => String(row.approvePublish || '').trim().toUpperCase() === 'YES');
  const payload = {
    ok: missingHeaders.length === 0 && Boolean(sheet.spreadsheetId),
    checkedAt: new Date().toISOString(),
    spreadsheetId: sheet.spreadsheetId || null,
    spreadsheetUrl: sheet.spreadsheetUrl || null,
    sourceCsv: 'data/inventory-agent/review/review-queue.csv',
    rowCount: rows.length,
    approvedRows: approvedRows.length,
    headers,
    missingHeaders,
    productionSystemOfRecord: sheet.productionSystemOfRecord || 'Odoo',
    policy: sheet.policy || 'Google Sheets is a human review interface only. Odoo remains the production system of record.',
  };
  await writeJson('data/inventory-agent/manifests/review-sheet-status.json', payload);
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) process.exitCode = 1;
}

async function reviewSheetExport() {
  await ensureDirs();
  const sheetManifest = await readJson('data/inventory-agent/manifests/review-sheet.json');
  if (!sheetManifest?.spreadsheetId) throw new Error('Missing review-sheet.json spreadsheetId.');
  const expectedHeaders = sheetManifest.sourceCsvColumns || [
    'clusterId',
    'reviewDecision',
    'approvePublish',
    'productName',
    'category',
    'material',
    'price',
    'cost',
    'stock',
    'description',
    'representativeImage',
    'contactSheet',
    'imageCount',
    'confidence',
    'suggestedProductName',
    'suggestedCategory',
    'categoryConfidence',
    'suggestedMaterial',
    'materialConfidence',
    'notes',
  ];
  const sheetName = sheetManifest.title;
  const sheets = await getSheetsClient();
  const range = `'${String(sheetName).replace(/'/g, "''")}'!A:T`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetManifest.spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const values = response.data.values || [];
  if (!values.length) throw new Error('Review Sheet is empty.');
  const headers = values[0].map((value) => String(value || '').trim());
  const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header));
  const extraHeaders = headers.filter((header) => header && !expectedHeaders.includes(header));
  if (missingHeaders.length) {
    await writeJson('data/inventory-agent/manifests/review-sheet-export.json', {
      ok: false,
      exportedAt: new Date().toISOString(),
      spreadsheetId: sheetManifest.spreadsheetId,
      range,
      missingHeaders,
      extraHeaders,
    });
    throw new Error(`Review Sheet is missing required headers: ${missingHeaders.join(', ')}`);
  }
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const rows = values.slice(1)
    .filter((row) => row.some((value) => String(value || '').trim()))
    .map((row) => expectedHeaders.map((header) => row[headerIndex.get(header)] ?? ''));
  const csv = `${[expectedHeaders, ...rows].map((row) => row.map(csvValue).join(',')).join('\n')}\n`;
  const relativePath = 'data/inventory-agent/review/review-queue.csv';
  await fs.writeFile(path.join(root, relativePath), csv);
  const payload = {
    ok: true,
    exportedAt: new Date().toISOString(),
    spreadsheetId: sheetManifest.spreadsheetId,
    spreadsheetUrl: sheetManifest.spreadsheetUrl,
    range,
    output: relativePath,
    rowCount: rows.length,
    approvedRows: rows.filter((row) => String(row[expectedHeaders.indexOf('approvePublish')] || '').trim().toUpperCase() === 'YES').length,
    headers: expectedHeaders,
    extraHeaders,
    productionSystemOfRecord: 'Odoo',
  };
  await writeJson('data/inventory-agent/manifests/review-sheet-export.json', payload);
  console.log(JSON.stringify(payload, null, 2));
}

async function odooDryRun() {
  await ensureDirs();
  const dto = await loadProductDto();
  const approved = await readJson('data/inventory-agent/manifests/approved-products.json');
  const mlClusters = await readJson('data/inventory-agent/manifests/ml-product-clusters.json');
  // Review manifests may re-cluster and change display IDs. Approved rows use
  // the stable ml-cluster-* IDs from review-queue.csv, so Odoo dry-run must
  // resolve them against the base manifest.
  const clusters = mlClusters || await readJson('data/inventory-agent/manifests/product-clusters.json');
  if (!approved) throw new Error('Missing approved-products.json. Run review:import first.');
  if (!clusters) throw new Error('Missing product-clusters.json. Run product:cluster first.');
  const clusterById = new Map((clusters.clusters || []).map((cluster) => [cluster.clusterId, cluster]));
  const payloads = [];
  const errors = [];
  const allowed = new Set(dto.writeAllowlist || []);
  for (const product of approved.approved || []) {
    const cluster = clusterById.get(product.clusterId);
    if (!cluster) {
      errors.push({ clusterId: product.clusterId, error: 'Cluster not found.' });
      continue;
    }
    const vals = {
      name: product.productName,
      type: 'consu',
      sale_ok: true,
      purchase_ok: false,
      list_price: Number(product.price),
      standard_price: Number(product.cost),
      description_sale: product.description || '',
    };
    const unknown = Object.keys(vals).filter((field) => !dto.fields[field]);
    const blocked = Object.keys(vals).filter((field) => !allowed.has(field));
    const invalidNumbers = [];
    if (!Number.isFinite(vals.list_price) || vals.list_price < 0) invalidNumbers.push('list_price');
    if (!Number.isFinite(vals.standard_price) || vals.standard_price < 0) invalidNumbers.push('standard_price');
    const approvedStock = Number(product.stock);
    if (!Number.isInteger(approvedStock) || approvedStock < 0) invalidNumbers.push('approvedStock');
    if (unknown.length || blocked.length || invalidNumbers.length) {
      errors.push({ clusterId: product.clusterId, unknown, blocked, invalidNumbers });
      continue;
    }
    payloads.push({
      clusterId: product.clusterId,
      model: dto.model,
      vals,
      approvedStock,
      categoryLabel: product.category || null,
      materialLabel: product.material || null,
      primaryImagePath: cluster.files[0]?.localPath || null,
      galleryImagePaths: cluster.files.slice(1).map((file) => file.localPath),
      allImagePaths: cluster.files.map((file) => file.localPath),
      imageUploadPolicy: 'primary_image_plus_gallery_for_same_product_cluster',
      publishAllowed: false,
    });
  }
  const result = {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    writeMode: false,
    message: 'Dry run only. odoo:publish remains blocked until explicit approval and production-safe implementation.',
    payloads,
    errors,
  };
  await writeJson('data/inventory-agent/manifests/odoo-dry-run.json', result);
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
}

// Legacy compatibility code retained only for historical manifests; it is not
// reachable from the protected publisher. All active Odoo paths use JSON-2.
function disabledLegacyOdooConfig() {
  const missing = [];
  const config = {
    baseUrl: process.env.ODOO_BASE_URL || process.env.PROD_ODOO_BASE_URL,
    database: process.env.ODOO_DATABASE || process.env.ODOO_DB || process.env.PROD_DB_NAME,
    username: process.env.ODOO_USERNAME || process.env.PROD_ODOO_USERNAME || 'admin',
    password: process.env.ODOO_PASSWORD || process.env.PROD_ODOO_PASSWORD,
  };
  if (!config.baseUrl) missing.push('ODOO_BASE_URL');
  if (!config.database) missing.push('ODOO_DATABASE or ODOO_DB');
  if (!config.password) missing.push('ODOO_PASSWORD');
  if (missing.length) {
    throw new Error(`Legacy Odoo transport is disabled: ${missing.join(', ')}`);
  }
  return config;
}

async function reviewSeedEstimates() {
  await ensureDirs();
  const reviewPath = path.join(root, 'data/inventory-agent/review/review-queue.csv');
  const content = await fs.readFile(reviewPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || '');
  const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  const priceByCategory = { necklaces: 1850, rings: 1650, earrings: 1250, bracelets: 1450, jewelry: 1500 };
  let changed = 0;
  for (const row of rows) {
    const category = String(row.category || row.suggestedCategory || 'jewelry').trim().toLowerCase();
    const estimatedPrice = Number(priceByCategory[category] || priceByCategory.jewelry);
    if (!String(row.productName || '').trim()) row.productName = row.suggestedProductName || `Galantes ${category}`;
    if (!String(row.category || '').trim()) row.category = row.suggestedCategory || category;
    if (!String(row.material || '').trim()) row.material = row.suggestedMaterial || '';
    if (!String(row.price || '').trim()) row.price = String(estimatedPrice);
    if (!String(row.cost || '').trim()) row.cost = String(Math.round(estimatedPrice * 0.5));
    if (!String(row.stock || '').trim()) row.stock = '0';
    // Classified single-image products are authorized for protected draft
    // publication; ambiguous merge/split clusters remain blocked.
    if (String(row.reviewDecision || '').trim().toUpperCase() === 'SINGLE_IMAGE') row.approvePublish = 'YES';
    else if (!String(row.approvePublish || '').trim()) row.approvePublish = 'NO';
    changed += 1;
  }
  const csv = `${[headers.map(csvValue).join(','), ...rows.map((row) => headers.map((header) => csvValue(row[header] || '')).join(','))].join('\n')}\n`;
  await fs.writeFile(reviewPath, csv);
  const report = { ok: true, completedAt: new Date().toISOString(), rows: rows.length, rowsUpdated: changed, classifiedForProtectedDraftPublish: rows.filter((row) => String(row.approvePublish).toUpperCase() === 'YES').length, blockedForHumanReview: rows.filter((row) => String(row.approvePublish).toUpperCase() !== 'YES').length, stockPolicy: '0', pricePolicy: 'category_estimate', costPolicy: '50_percent_of_estimated_price', publishPolicy: 'classified_single_image_only_manual_website_publish' };
  await writeJson('data/inventory-agent/manifests/review-seed-estimates.json', report);
  console.log(JSON.stringify(report, null, 2));
}

function requireOdooJson2Config() {
  const config = {
    baseUrl: process.env.ODOO_BASE_URL || process.env.PROD_ODOO_BASE_URL,
    database: process.env.ODOO_DATABASE || process.env.ODOO_DB || process.env.PROD_DB_NAME,
    apiKey: process.env.ODOO_API_KEY || process.env.PROD_ODOO_API_KEY,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Odoo JSON-2 config is incomplete: ${missing.join(', ')}`);
  return config;
}

async function callOdooJson2(config, model, method, params) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/json/2/${encodeURIComponent(model)}/${method}`, {
    method: 'POST',
    headers: { Authorization: `bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Odoo JSON-2 failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function disabledLegacyOdooCall(payload) {
  const child = spawn('python', ['scripts/odoo-xmlrpc-bridge.py'], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdin.end(JSON.stringify(payload));
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Odoo bridge returned invalid JSON. stderr=${stderr} stdout=${stdout}`);
  }
  if (exitCode !== 0 || !parsed.ok) {
    throw new Error(`Odoo bridge failed: ${parsed.error || stderr || exitCode}`);
  }
  return parsed.result;
}

async function odooFieldsExport() {
  await ensureDirs();
  await loadEnvFile();
  const config = requireOdooJson2Config();
  const fields = await callOdooJson2(config, 'product.template', 'fields_get', {
    attributes: ['string', 'type', 'required', 'readonly', 'store', 'relation', 'selection', 'help'],
  });
  const dto = await loadProductDto();
  const productionFieldNames = new Set(Object.keys(fields));
  const dtoFieldNames = new Set(Object.keys(dto.fields || {}));
  const payload = {
    ok: true,
    exportedAt: new Date().toISOString(),
    model: 'product.template',
    totalFields: Object.keys(fields).length,
    fields,
    dtoCoverage: {
      missingInDto: [...productionFieldNames].filter((field) => !dtoFieldNames.has(field)).sort(),
      notInProduction: [...dtoFieldNames].filter((field) => !productionFieldNames.has(field)).sort(),
    },
    writeAllowlist: dto.writeAllowlist,
    protocol: 'odoo-json-2',
    note: 'Read-only fields_get export. Review missingInDto before enabling publication writes.',
  };
  await writeJson('data/inventory-agent/manifests/odoo-product-template-fields.json', payload);
  console.log(JSON.stringify(payload, null, 2));
}

async function errorUseCases() {
  const relativePath = 'docs/inventory-agent-error-use-cases.md';
  const content = await fs.readFile(path.join(root, relativePath), 'utf8');
  const cases = [...content.matchAll(/^## (UC-\d+): (.+)$/gm)].map((match) => ({
    id: match[1],
    title: match[2],
  }));
  console.log(JSON.stringify({
    ok: true,
    registry: relativePath,
    cases,
  }, null, 2));
}

class DisjointSet {
  constructor() {
    this.parent = new Map();
  }

  find(value) {
    if (!this.parent.has(value)) this.parent.set(value, value);
    const parent = this.parent.get(value);
    if (parent !== value) {
      const resolved = this.find(parent);
      this.parent.set(value, resolved);
      return resolved;
    }
    return parent;
  }

  union(left, right) {
    this.parent.set(this.find(right), this.find(left));
  }
}

async function applyGeminiSameProductReview() {
  await ensureDirs();
  const clusters = await readJson('data/inventory-agent/manifests/ml-product-clusters.json');
  const review = await readJson('data/inventory-agent/review/gemini-same-product-review.json', { reviews: [] });
  if (!clusters) throw new Error('Missing ml-product-clusters.json. Run ml:cluster first.');

  const fileById = new Map();
  for (const cluster of clusters.clusters || []) {
    for (const file of cluster.files || []) {
      fileById.set(file.id, file);
    }
  }

  const dsu = new DisjointSet();
  for (const fileId of fileById.keys()) dsu.find(fileId);

  for (const cluster of clusters.clusters || []) {
    const files = cluster.files || [];
    if (cluster.confidence === 'high' && files.length > 1) {
      for (const file of files.slice(1)) dsu.union(files[0].id, file.id);
    }
  }

  const acceptedPairs = [];
  const rejectedPairs = [];
  for (const item of review.reviews || []) {
    if (item.sameProduct === true && Number(item.confidence || 0) >= 0.75) {
      dsu.union(item.sourceId, item.targetId);
      acceptedPairs.push(item);
    } else {
      rejectedPairs.push(item);
    }
  }

  const groups = new Map();
  for (const [id, file] of fileById.entries()) {
    const rootId = dsu.find(id);
    if (!groups.has(rootId)) groups.set(rootId, []);
    groups.get(rootId).push(file);
  }

  const reviewedClusters = Array.from(groups.values()).map((files, index) => ({
    clusterId: `reviewed-cluster-${String(index + 1).padStart(4, '0')}`,
    status: files.length > 1 ? 'needs_review' : 'single_image',
    confidence: files.length > 1 ? 'reviewed_candidate' : 'single',
    reviewDecision: files.length > 1 ? 'REVIEW_MERGE_OR_SPLIT' : 'SINGLE_IMAGE',
    representative: files[0],
    files,
    needsHumanReview: files.length > 1,
  }));

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    sourceClusterGeneratedAt: clusters.generatedAt || null,
    sourceClusterManifest: 'data/inventory-agent/manifests/ml-product-clusters.json',
    geminiReview: 'data/inventory-agent/review/gemini-same-product-review.json',
    acceptedPairs,
    rejectedPairs,
    clusters: reviewedClusters,
  };
  await writeJson('data/inventory-agent/manifests/ml-product-clusters-reviewed.json', payload);
  console.log(JSON.stringify({
    ok: true,
    acceptedPairs: acceptedPairs.length,
    rejectedPairs: rejectedPairs.length,
    clusters: reviewedClusters.length,
    multiImageClusters: reviewedClusters.filter((cluster) => cluster.files.length > 1).length,
    output: 'data/inventory-agent/manifests/ml-product-clusters-reviewed.json',
  }, null, 2));
}

async function exportN8nWorkflow() {
  await ensureDirs();
  const exports = [
    {
      template: 'scripts/inventory-agent/n8n_workflow_template.json',
      output: 'data/inventory-agent/review/galantes-inventory-safe-intake-review.n8n.json',
      safety: 'No Odoo publication, no production writes. Intake and human review only.',
    },
    {
      template: 'scripts/inventory-agent/n8n_post_review_workflow_template.json',
      output: 'data/inventory-agent/review/galantes-inventory-post-review-dry-run.n8n.json',
      safety: 'No Odoo publication. Imports approved review rows and generates dry-run payloads only.',
    },
  ];
  const results = [];
  for (const item of exports) {
    const templatePath = path.join(root, item.template);
    const workflow = JSON.parse(await fs.readFile(templatePath, 'utf8'));
    workflow.meta = {
      exportedAt: new Date().toISOString(),
      source: item.template,
      safety: item.safety,
    };
    await writeJson(item.output, workflow);
    results.push({
      workflow: item.output,
      nodes: workflow.nodes.length,
      active: workflow.active,
    });
  }
  console.log(JSON.stringify({
    ok: true,
    workflows: results,
  }, null, 2));
}

async function imageEnhance() {
  await ensureDirs();
  const manifest = await readJson('data/inventory-agent/manifests/ml-product-clusters.json')
    || await readJson('data/inventory-agent/manifests/product-clusters.json');
  if (!manifest?.clusters?.length) throw new Error('Missing product clusters. Run ml:cluster first.');
  const outputs = [];
  for (const cluster of manifest.clusters) {
    const files = cluster.files || [];
    const edited = (await Promise.all(files.map(async (file) => {
      const source = file.localPath || file.path;
      if (!source) return null;
      const absoluteSource = path.isAbsolute(source) ? source : path.join(root, source);
      const outputRelative = path.join('data/inventory-agent/edited', `${cluster.clusterId}-${path.basename(source, path.extname(source))}.jpg`);
      const outputAbsolute = path.join(root, outputRelative);
      await sharp(absoluteSource).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92, mozjpeg: true }).toFile(outputAbsolute);
      return { source: source.replaceAll('\\', '/'), output: outputRelative.replaceAll('\\', '/'), provider: 'local-sharp', sourceExists: true };
    }))).filter(Boolean);
    outputs.push({ clusterId: cluster.clusterId, images: edited });
  }
  const payload = { ok: true, generatedAt: new Date().toISOString(), provider: 'local-sharp', clusters: outputs, llmUsed: false };
  await writeJson('data/inventory-agent/manifests/image-enhancement.json', payload);
  console.log(JSON.stringify({ ok: true, provider: payload.provider, clusters: outputs.length, images: outputs.reduce((n, x) => n + x.images.length, 0), output: 'data/inventory-agent/manifests/image-enhancement.json' }, null, 2));
}

async function descriptionGenerate() {
  await ensureDirs();
  const metadata = await readJson('data/inventory-agent/manifests/product-metadata-suggestions.json', { suggestions: [] });
  const clusters = await readJson('data/inventory-agent/manifests/ml-product-clusters.json') || await readJson('data/inventory-agent/manifests/product-clusters.json');
  if (!clusters?.clusters?.length) throw new Error('Missing product clusters. Run ml:cluster first.');
  const byCluster = new Map((metadata.suggestions || []).map((item) => [item.clusterId, item]));
  const products = clusters.clusters.map((cluster) => {
    const suggestion = byCluster.get(cluster.clusterId) || {};
    const name = suggestion.suggestedProductName || `Galante's Jewelry ${suggestion.suggestedCategory || 'Jewelry'}`;
    const category = suggestion.suggestedCategory || 'jewelry';
    const material = suggestion.suggestedMaterial || 'premium material';
    return { clusterId: cluster.clusterId, productName: name, category, material, description: `${name}, una pieza de ${category} elaborada en ${material}. Consulta disponibilidad y detalles con Galante's Jewelry.`, provider: 'local-template', llmUsed: false };
  });
  const payload = { ok: true, generatedAt: new Date().toISOString(), provider: 'local-template', products, policy: 'Descriptions only; price, cost, and stock are never generated.' };
  await writeJson('data/inventory-agent/manifests/product-copy.json', payload);
  console.log(JSON.stringify({ ok: true, provider: payload.provider, products: products.length, output: 'data/inventory-agent/manifests/product-copy.json' }, null, 2));
}

function getPythonCommand() {
  return process.env.INVENTORY_AGENT_PYTHON || 'python';
}

async function runPythonTool(args) {
  const child = spawn(getPythonCommand(), args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

async function runLocalCommand(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  if (exitCode !== 0) process.exitCode = exitCode;
}

async function placeholderRun(command) {
  const definition = getDefinitionByCommand(command);
  if (!definition) {
    throw new Error(`Unknown inventory-agent command: ${command}`);
  }
  await ensureDirs();
  if (command === 'drive:scan') return driveScan();
  if (command === 'drive:download') return driveDownload();
  if (command === 'processed:index-status') return processedIndexStatus();
  if (command === 'processed:index-rebuild') return processedIndexRebuild();
  if (command === 'image:convert-deps-check') return runPythonTool(['scripts/inventory-agent/image_tools.py', 'deps-check']);
  if (command === 'image:convert-heic') return runPythonTool(['scripts/inventory-agent/image_tools.py', 'convert-heic']);
  if (command === 'image:features') return imageFeatures();
  if (command === 'product:cluster') return productCluster();
  if (command === 'product:metadata-suggest') return runPythonTool(['scripts/inventory-agent/product_metadata.py', 'suggest']);
  if (command === 'review:export') return reviewExport();
  if (command === 'review:seed-estimates') return reviewSeedEstimates();
  if (command === 'inventory:autocorrect-loop') return autocorrectionLoop();
  if (command === 'review:sheet-export') return reviewSheetExport();
  if (command === 'review:sheet-status') return reviewSheetStatus();
  if (command === 'review:import') return reviewImport();
  if (command === 'odoo:dry-run') return odooDryRun();
  if (command === 'odoo:fields-export') return odooFieldsExport();
  if (command === 'errors:use-cases') return errorUseCases();
  if (command === 'n8n:export-workflow') return exportN8nWorkflow();
  if (command === 'ml:deps-check') return runPythonTool(['scripts/inventory-agent/ml_similarity.py', 'deps-check']);
  if (command === 'ml:index-status') return mlIndexStatus();
  if (command === 'ml:build-index') return runPythonTool(['scripts/inventory-agent/ml_similarity.py', 'build-index']);
  if (command === 'ml:cluster') return runPythonTool(['scripts/inventory-agent/ml_similarity.py', 'cluster']);
  if (command === 'ml:contact-sheets') return runPythonTool(['scripts/inventory-agent/ml_similarity.py', 'contact-sheets']);
  if (command === 'image:enhance') return imageEnhance();
  if (command === 'description:generate') return descriptionGenerate();
  if (command === 'vision:yolo-deps-check') return runPythonTool(['scripts/inventory-agent/vision_yolo.py', 'deps-check']);
  if (command === 'vision:yolo-classify') return runPythonTool(['scripts/inventory-agent/vision_yolo.py', 'classify']);
  if (command === 'vision:mediapipe-deps-check') return runPythonTool(['scripts/inventory-agent/mediapipe_classifier.py', 'deps-check']);
  if (command === 'gemini:same-product-review') return runLocalCommand('node', ['scripts/inventory-agent/gemini_same_product_review.mjs']);
  if (command === 'gemini:apply-same-product-review') return applyGeminiSameProductReview();
  if (command === 'gemini:product-metadata') return runLocalCommand('node', ['scripts/inventory-agent/gemini_product_metadata.mjs']);
  if (command === 'odoo:publish') return odooPublish();
  const result = {
    ok: true,
    implemented: false,
    command,
    nodeId: definition.id,
    llmAllowed: definition.llmAllowed,
    message: 'Node contract exists. Implementation must be added behind this script command before workflow activation.',
    expectedOutput: definition.output,
  };
  console.log(JSON.stringify(result, null, 2));
}

async function odooPublish() {
  throw new Error('Production publication is disabled in the local worker. Use the protected GitHub Actions production workflow with JSON-2, backup, approval, and post-deploy QA gates.');
  /* istanbul ignore next -- retained implementation is unreachable until the protected adapter is enabled */
  await ensureDirs();
  await loadEnvFile();
  const config = disabledLegacyOdooConfig();
  const dryRunData = await readJson('data/inventory-agent/manifests/odoo-dry-run.json');
  if (!dryRunData || !dryRunData.ok) {
    throw new Error('Missing or failing odoo-dry-run.json. Run odoo:dry-run first.');
  }

  const payloads = dryRunData.payloads || [];
  if (payloads.length === 0) {
    const emptyResult = {
      ok: true,
      publishedAt: new Date().toISOString(),
      publishedCount: 0,
      message: 'No approved products found to publish.',
      details: [],
    };
    await writeJson('data/inventory-agent/manifests/publication-result.json', emptyResult);
    console.log(JSON.stringify(emptyResult, null, 2));
    return;
  }

  console.log(`Starting publication of ${payloads.length} products to Odoo...`);
  
  // Never delete or overwrite existing production inventory as part of intake.
  // Cleanup is a separate proposal/approval workflow and is intentionally not
  // performed by this publisher.
  console.log('Production cleanup is disabled; publishing is additive/idempotent only.');

  const details = [];

  for (const item of payloads) {
    try {
      // 1. Prepare values with primary image as base64 binary
      const vals = { ...item.vals };
      if (item.primaryImagePath) {
        const imageBuffer = await fs.readFile(path.join(root, item.primaryImagePath));
        vals.image_1920 = imageBuffer.toString('base64');
      }

      // 2. Create the product template in Odoo
      console.log(`Publishing product: ${vals.name}`);
      const templateId = await disabledLegacyOdooCall({
        ...config,
        model: 'product.template',
        method: 'create',
        args: [vals],
      });

      // 3. Upload gallery images if any
      const galleryIds = [];
      if (item.galleryImagePaths && item.galleryImagePaths.length > 0) {
        for (const [idx, imgPath] of item.galleryImagePaths.entries()) {
          const imgBuffer = await fs.readFile(path.join(root, imgPath));
          const base64Data = imgBuffer.toString('base64');
          
          // Create attachment or product gallery record in Odoo
          const galleryId = await disabledLegacyOdooCall({
            ...config,
            model: 'ir.attachment',
            method: 'create',
            args: [{
              name: `${vals.name}_gallery_${idx}`,
              type: 'binary',
              datas: base64Data,
              res_model: 'product.template',
              res_id: templateId,
              public: true,
            }],
          });
          galleryIds.push(galleryId);
        }
      }

      details.push({
        clusterId: item.clusterId,
        productName: vals.name,
        success: true,
        templateId,
        galleryCount: galleryIds.length,
      });
    } catch (err) {
      console.error(`Failed to publish cluster ${item.clusterId}:`, err);
      details.push({
        clusterId: item.clusterId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const success = details.every(d => d.success);
  const resultPayload = {
    ok: success,
    publishedAt: new Date().toISOString(),
    publishedCount: details.filter(d => d.success).length,
    failedCount: details.filter(d => !d.success).length,
    details,
  };

  await writeJson('data/inventory-agent/manifests/publication-result.json', resultPayload);
  console.log(JSON.stringify(resultPayload, null, 2));
  if (!success) {
    process.exitCode = 1;
  }
}

async function autocorrectionLoop() {
  await ensureDirs();
  const baseClusters = await readJson('data/inventory-agent/manifests/ml-product-clusters.json', { clusters: [] });
  const reviewedClusters = await readJson('data/inventory-agent/manifests/ml-product-clusters-reviewed.json', null);
  const clusters = reviewedClusters?.generatedAt && reviewedClusters.generatedAt >= (baseClusters.generatedAt || '')
    ? reviewedClusters
    : baseClusters;
  const suggestions = await readJson('data/inventory-agent/manifests/product-metadata-suggestions.json', { suggestions: [] });
  const queuePath = path.join(root, 'data/inventory-agent/review/review-queue.csv');
  const queueExists = await fs.access(queuePath).then(() => true).catch(() => false);
  const queueText = queueExists ? await fs.readFile(queuePath, 'utf8') : '';
  const rows = queueText.trim() ? queueText.trim().split(/\r?\n/).slice(1) : [];
  const unresolved = (clusters.clusters || []).filter((cluster) => {
    const decision = String(cluster.reviewDecision || cluster.decision || '').toUpperCase();
    return ['REVIEW_MERGE_OR_SPLIT', 'UNCERTAIN', 'HUMAN_REVIEW'].includes(decision);
  });
  const unresolvedQueueRows = (queueText.match(/REVIEW_MERGE_OR_SPLIT|UNCERTAIN|HUMAN_REVIEW/g) || []).length;
  const report = {
    ok: true,
    completedAt: new Date().toISOString(),
    policy: 'deterministic_reconciliation_only_no_auto_approval',
    iterations: 1,
    clusterCount: (clusters.clusters || []).length,
    metadataSuggestionCount: (suggestions.suggestions || []).length,
    reviewQueueRows: rows.length,
    unresolvedClusterCount: Math.max(unresolved.length, unresolvedQueueRows),
    publishableCount: 0,
    corrections: reviewedClusters?.generatedAt && clusters === reviewedClusters
      ? [{ action: 'applied_reviewed_clusters', source: 'ml-product-clusters-reviewed.json', reviewedAt: reviewedClusters.generatedAt }]
      : [],
    nextRequiredActions: [
      'Resolve merge/split and uncertain rows in review-queue.csv.',
      'Enter user-approved price, cost, and stock for every product.',
      'Set approvePublish=YES only for explicitly approved rows.',
      'Run review:import, odoo:dry-run, and protected GitHub Actions gates.',
    ],
  };
  await writeJson('data/inventory-agent/manifests/autocorrection-loop.json', report);
  console.log(JSON.stringify(report, null, 2));
}


async function status() {
  await ensureDirs();
  await writeNodeManifest();
  const manifestsDir = path.join(root, 'data/inventory-agent/manifests');
  const reviewDir = path.join(root, 'data/inventory-agent/review');
  const manifests = await fs.readdir(manifestsDir).catch(() => []);
  const review = await fs.readdir(reviewDir).catch(() => []);
  console.log(JSON.stringify({
    ok: true,
    manifest: 'scripts/inventory-agent/node-manifest.generated.json',
    manifests,
    review,
    nodes: NODE_DEFINITIONS.length,
  }, null, 2));
}

async function main() {
  const command = process.argv[2] || 'help';
  if (command === 'help' || command === '--help') {
    console.log('Usage: node scripts/inventory-agent/nodes.mjs <command>');
    console.log(NODE_DEFINITIONS.map((node) => `- ${node.command} (${node.id}) llmAllowed=${node.llmAllowed}`).join('\n'));
    return;
  }
  if (command === 'manifest') {
    await ensureDirs();
    await writeNodeManifest();
    console.log('scripts/inventory-agent/node-manifest.generated.json');
    return;
  }
  if (command === 'status') {
    await status();
    return;
  }
  await placeholderRun(command);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
