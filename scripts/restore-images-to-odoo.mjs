#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { createOdooClient, getOdooConfig } from '../src/config/odooClient.js';

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const separatorIndex = trimmed.indexOf('=');
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {}
}

const DEFAULT_SOURCE_DIR = 'C:\\Users\\yoeli\\Downloads\\galantesjewelry-recovered-images-2026-06-27\\blobs';
const DEFAULT_CMS_PATH = path.join(process.cwd(), 'data', 'cms.json');
const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');
const IMAGE_ATTACHMENT_MODEL = 'ir.attachment';
const IMAGE_ATTACHMENT_OWNER_MODEL = 'galante.cms.settings';

const BRANDING_ASSETS = {
  favicon_url: '/api/image?id=favicon-1776722808533-favicon-32x32.png',
  logo_url: '/api/image?id=image-1776722792843-logo.webp',
  hero_image_url: '/api/image?id=image-1776959050826-portada.webp',
};

const FEATURED_IMAGES = [
  '/api/image?id=image-1776960148616-chatgpt-image-apr-23-2026-11-58-48-am.webp',
  '/api/image?id=image-1776960207167-chatgpt-image-apr-23-2026-11-58-56-am.webp',
  '/api/image?id=image-1776960214904-chatgpt-image-apr-23-2026-11-59-05-am.webp',
];

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE_DIR,
    cms: DEFAULT_CMS_PATH,
    envFile: null,
    productImages: true,
    overwriteProductImages: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--source' && argv[index + 1]) {
      options.source = path.resolve(argv[index + 1]);
      index += 1;
    } else if (current === '--cms' && argv[index + 1]) {
      options.cms = path.resolve(argv[index + 1]);
      index += 1;
    } else if (current === '--env-file' && argv[index + 1]) {
      options.envFile = path.resolve(argv[index + 1]);
      index += 1;
    } else if (current === '--no-product-images') {
      options.productImages = false;
    } else if (current === '--overwrite-product-images') {
      options.overwriteProductImages = true;
    } else if (current === '--dry-run') {
      options.dryRun = true;
    } else if (current === '-h' || current === '--help') {
      console.log('Usage: node scripts/restore-images-to-odoo.mjs [--source <dir>] [--cms <file>] [--env-file <file>] [--no-product-images] [--overwrite-product-images] [--dry-run]');
      process.exit(0);
    }
  }

  return options;
}

function contentTypeForFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  return 'image/webp';
}

function storageIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

async function writeArtifact(name, payload) {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  const target = path.join(ARTIFACTS_DIR, name);
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf-8');
  return target;
}

function applyCmsRestore(cmsSnapshot) {
  const snapshot = cmsSnapshot || { settings: {}, sections: [], featured_items: [] };
  snapshot.settings = { ...(snapshot.settings || {}), ...BRANDING_ASSETS };

  snapshot.featured_items = (snapshot.featured_items || []).map((item, index) => ({
    ...item,
    image_url: FEATURED_IMAGES[index] || item.image_url,
  }));

  return snapshot;
}

async function upsertCmsSnapshot(odoo, snapshot, dryRun) {
  const existing = await odoo.searchRead(IMAGE_ATTACHMENT_OWNER_MODEL, {
    domain: [],
    fields: ['id'],
    limit: 1,
  });

  if (dryRun) {
    return { action: existing?.[0]?.id ? 'would_update' : 'would_create', id: existing?.[0]?.id || null };
  }

  if (existing?.[0]?.id) {
    await odoo.call(IMAGE_ATTACHMENT_OWNER_MODEL, 'write', {
      ids: [existing[0].id],
      vals: { cms_snapshot_json: JSON.stringify(snapshot) },
    });
    return { action: 'updated', id: existing[0].id };
  }

  const id = await odoo.create(IMAGE_ATTACHMENT_OWNER_MODEL, { cms_snapshot_json: JSON.stringify(snapshot) });
  return { action: 'created', id };
}

async function upsertManagedAttachment(odoo, sourceDir, fileName, ownerId, dryRun) {
  const absolutePath = path.join(sourceDir, fileName);
  const buffer = await fs.readFile(absolutePath);
  const existing = await odoo.searchRead(IMAGE_ATTACHMENT_MODEL, {
    domain: [
      ['name', '=', fileName],
      ['res_model', '=', IMAGE_ATTACHMENT_OWNER_MODEL],
    ],
    fields: ['id', 'name'],
    limit: 1,
  });

  const vals = {
    name: fileName,
    datas: buffer.toString('base64'),
    mimetype: contentTypeForFile(fileName),
    type: 'binary',
    public: true,
    res_model: IMAGE_ATTACHMENT_OWNER_MODEL,
    ...(ownerId ? { res_id: ownerId } : {}),
  };

  if (dryRun) {
    return { fileName, bytes: buffer.length, action: existing?.[0]?.id ? 'would_update' : 'would_create' };
  }

  if (existing?.[0]?.id) {
    await odoo.call(IMAGE_ATTACHMENT_MODEL, 'write', { ids: [existing[0].id], vals });
    return { fileName, bytes: buffer.length, action: 'updated', attachmentId: existing[0].id };
  }

  const attachmentId = await odoo.create(IMAGE_ATTACHMENT_MODEL, vals);
  return { fileName, bytes: buffer.length, action: 'created', attachmentId };
}

async function backfillProductImages(odoo, sourceDir, dryRun, overwriteProductImages) {
  const files = (await fs.readdir(sourceDir))
    .filter((fileName) => /\.(jpe?g|png|webp)$/i.test(fileName))
    .filter((fileName) => /^\d{8}_\d{6}\.jpg$/i.test(fileName))
    .sort();

  const productDomain = overwriteProductImages
    ? [['sale_ok', '=', true], ['available_on_website', '=', true]]
    : [['sale_ok', '=', true], ['available_on_website', '=', true], ['image_1920', '=', false]];

  const products = await odoo.searchRead('product.template', {
    domain: productDomain,
    fields: ['id', 'name', 'default_code', 'image_1920'],
    limit: files.length,
    order: 'id asc',
  });

  const results = [];
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const fileName = files[index];
    if (!fileName) break;

    const buffer = await fs.readFile(path.join(sourceDir, fileName));
    if (dryRun) {
      results.push({ productId: product.id, productName: product.name, fileName, bytes: buffer.length, action: product.image_1920 ? 'would_update' : 'would_set' });
      continue;
    }

    await odoo.call('product.template', 'write', {
      ids: [product.id],
      vals: { image_1920: buffer.toString('base64') },
    });
    results.push({ productId: product.id, productName: product.name, fileName, bytes: buffer.length, action: product.image_1920 ? 'updated' : 'set' });
  }

  return { availableFiles: files.length, matchedProducts: products.length, results };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.envFile) {
    await loadEnvFile(options.envFile);
  }
  await loadEnvFile(path.join(process.cwd(), '.env.local'));
  await loadEnvFile(path.join(process.cwd(), '.env.gcp'));
  await loadEnvFile(path.join(process.cwd(), '.env.prod'));
  await loadEnvFile(path.join(process.cwd(), '.env'));

  const config = getOdooConfig();

  if (!config.isReady) {
    throw new Error(`Odoo config is not ready. Missing: ${config.missing.join(', ')}`);
  }

  const odoo = createOdooClient(config);
  const cmsSnapshot = applyCmsRestore(await readJsonIfExists(options.cms));
  const cmsResult = await upsertCmsSnapshot(odoo, cmsSnapshot, options.dryRun);
  if (!options.dryRun) {
    await writeJson(options.cms, cmsSnapshot);
  }

  const ownerId = cmsResult.id;
  const requiredStorageIds = [
    ...Object.values(BRANDING_ASSETS).map(storageIdFromUrl),
    ...FEATURED_IMAGES.map(storageIdFromUrl),
  ].filter(Boolean);

  const managedImages = [];
  for (const storageId of requiredStorageIds) {
    managedImages.push(await upsertManagedAttachment(odoo, options.source, storageId, ownerId, options.dryRun));
  }

  const productImages = options.productImages
    ? await backfillProductImages(odoo, options.source, options.dryRun, options.overwriteProductImages)
    : { skipped: true };

  const report = {
    ok: true,
    dryRun: options.dryRun,
    source: options.source,
    cms: options.cms,
    odoo: {
      baseUrl: config.baseUrl,
      database: config.database,
    },
    cmsResult,
    managedImages,
    overwriteProductImages: options.overwriteProductImages,
    productImages,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactPath = await writeArtifact(`restore-images-to-odoo-${timestamp}.json`, report);
  console.log(JSON.stringify({ ok: true, artifactPath, managedImages: managedImages.length, productImages: productImages.results?.length || 0 }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
