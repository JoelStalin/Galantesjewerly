#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { createOdooClient, getOdooConfig } from '../src/config/odooClient.js';

const IMAGE_ATTACHMENT_MODEL = 'ir.attachment';
const IMAGE_ATTACHMENT_OWNER_MODEL = 'galante.cms.settings';
const DEFAULT_SOURCE_DIR = path.join(process.cwd(), 'Galantesjewelry', 'data', 'blobs');
const DEFAULT_CMS_PATH = path.join(process.cwd(), 'Galantesjewelry', 'data', 'cms.json');
const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE_DIR,
    cms: DEFAULT_CMS_PATH,
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
    } else if (current === '--dry-run') {
      options.dryRun = true;
    } else if (current === '-h' || current === '--help') {
      console.log('Usage: node scripts/backfill-managed-images-to-odoo.mjs [--source <dir>] [--cms <file>] [--dry-run]');
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

async function loadCmsSnapshot(cmsPath) {
  try {
    const raw = await fs.readFile(cmsPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function collectReferencedStorageIds(cmsSnapshot) {
  if (!cmsSnapshot) return [];

  const urls = [
    cmsSnapshot.settings?.favicon_url,
    cmsSnapshot.settings?.logo_url,
    cmsSnapshot.settings?.hero_image_url,
    ...(cmsSnapshot.sections || []).map((section) => section.image_url),
    ...(cmsSnapshot.featured_items || []).map((item) => item.image_url),
  ].filter(Boolean);

  return Array.from(new Set(
    urls
      .map((url) => {
        if (typeof url !== 'string') return null;
        const match = url.match(/[?&]id=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
      })
      .filter(Boolean),
  ));
}

async function ensureArtifactsDir() {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

async function writeArtifact(name, payload) {
  await ensureArtifactsDir();
  const target = path.join(ARTIFACTS_DIR, name);
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf-8');
  return target;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getOdooConfig();

  if (!config.isReady) {
    throw new Error(`Odoo config is not ready. Missing: ${config.missing.join(', ')}`);
  }

  const odoo = createOdooClient(config);
  const files = (await fs.readdir(options.source, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const cmsSnapshot = await loadCmsSnapshot(options.cms);
  const referencedStorageIds = collectReferencedStorageIds(cmsSnapshot);
  const settingsRecords = await odoo.searchRead(IMAGE_ATTACHMENT_OWNER_MODEL, {
    domain: [],
    fields: ['id'],
    limit: 1,
  });
  const ownerId = settingsRecords?.[0]?.id || null;

  const report = {
    source: options.source,
    cms: options.cms,
    dryRun: options.dryRun,
    totalFiles: files.length,
    ownerId,
    referencedStorageIds,
    processed: [],
    skipped: [],
  };

  for (const fileName of files) {
    const absolutePath = path.join(options.source, fileName);
    const buffer = await fs.readFile(absolutePath);
    const datas = buffer.toString('base64');
    const mimetype = contentTypeForFile(fileName);
    const referenced = referencedStorageIds.includes(fileName);

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
      datas,
      mimetype,
      type: 'binary',
      public: true,
      res_model: IMAGE_ATTACHMENT_OWNER_MODEL,
      ...(ownerId ? { res_id: ownerId } : {}),
    };

    if (options.dryRun) {
      report.processed.push({
        fileName,
        bytes: buffer.length,
        mimetype,
        referenced,
        action: existing?.[0]?.id ? 'would_update' : 'would_create',
      });
      continue;
    }

    if (existing?.[0]?.id) {
      await odoo.call(IMAGE_ATTACHMENT_MODEL, 'write', {
        ids: [existing[0].id],
        vals,
      });
      report.processed.push({
        fileName,
        bytes: buffer.length,
        mimetype,
        referenced,
        action: 'updated',
        attachmentId: existing[0].id,
      });
    } else {
      const attachmentId = await odoo.create(IMAGE_ATTACHMENT_MODEL, vals);
      report.processed.push({
        fileName,
        bytes: buffer.length,
        mimetype,
        referenced,
        action: 'created',
        attachmentId,
      });
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactPath = await writeArtifact(`managed-images-backfill-${timestamp}.json`, report);
  console.log(JSON.stringify({ ok: true, artifactPath, processed: report.processed.length }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
