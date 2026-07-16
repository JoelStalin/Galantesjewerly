#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { createOdooClient, getOdooConfig } from '../src/config/odooClient.js';

const REQUIRED_MANAGED_STORAGE_IDS = [
  'favicon-1776722808533-favicon-32x32.png',
  'image-1776722792843-logo.webp',
  'image-1776959050826-portada.webp',
  'image-1776960148616-chatgpt-image-apr-23-2026-11-58-48-am.webp',
  'image-1776960207167-chatgpt-image-apr-23-2026-11-58-56-am.webp',
  'image-1776960214904-chatgpt-image-apr-23-2026-11-59-05-am.webp',
];

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');

function parseArgs(argv) {
  const options = { envFile: null };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--env-file' && argv[index + 1]) {
      options.envFile = path.resolve(argv[index + 1]);
      index += 1;
    } else if (current === '-h' || current === '--help') {
      console.log('Usage: node scripts/verify-image-durability.mjs [--env-file <file>]');
      process.exit(0);
    }
  }

  return options;
}

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

async function writeArtifact(payload) {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(ARTIFACTS_DIR, `image-durability-${timestamp}.json`);
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf-8');
  return target;
}

function byteLengthFromBase64(value) {
  if (!value || typeof value !== 'string') return 0;
  return Buffer.from(value, 'base64').length;
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
  const managed = [];
  for (const storageId of REQUIRED_MANAGED_STORAGE_IDS) {
    const records = await odoo.searchRead('ir.attachment', {
      domain: [
        ['name', '=', storageId],
        ['res_model', '=', 'galante.cms.settings'],
      ],
      fields: ['id', 'name', 'datas', 'mimetype'],
      limit: 1,
    });

    const record = records?.[0];
    managed.push({
      storageId,
      attachmentId: record?.id || null,
      bytes: byteLengthFromBase64(record?.datas),
      mimetype: record?.mimetype || null,
      ok: byteLengthFromBase64(record?.datas) > 0,
    });
  }

  const productStats = await odoo.searchRead('product.template', {
    domain: [['sale_ok', '=', true], ['available_on_website', '=', true]],
    fields: ['id', 'name', 'image_1920'],
    limit: 500,
    order: 'id asc',
  });

  const products = productStats.map((product) => ({
    id: product.id,
    name: product.name,
    bytes: byteLengthFromBase64(product.image_1920),
    ok: byteLengthFromBase64(product.image_1920) > 0,
  }));

  const report = {
    ok: managed.every((item) => item.ok) && products.length > 0 && products.every((item) => item.ok),
    odoo: {
      baseUrl: config.baseUrl,
      database: config.database,
    },
    managed,
    productSummary: {
      total: products.length,
      withImage: products.filter((item) => item.ok).length,
      missingImage: products.filter((item) => !item.ok).length,
    },
    missingProducts: products.filter((item) => !item.ok),
  };

  const artifactPath = await writeArtifact(report);
  console.log(JSON.stringify({ ok: report.ok, artifactPath, productSummary: report.productSummary }, null, 2));

  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
