#!/usr/bin/env node
/** Protected Odoo JSON-2 publisher.
 * It is intentionally unusable from a developer shell. Production execution
 * must come from an approved GitHub Actions production environment.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../..', import.meta.url)));

// Load .env.local if present
try {
  const envText = await readFile(join(root, '.env.local'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const rawUrl = process.env.ODOO_BASE_URL || '';
const baseUrl = (rawUrl && !rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1'))
  ? rawUrl
  : 'https://odoo.galantesjewelry.com';
const database = process.env.ODOO_DATABASE || process.env.ODOO_DB || 'galantes_prod';
const apiKey = process.env.ODOO_API_KEY;

const isAuthorized = process.env.INVENTORY_AGENT_LOCAL_WORKER === 'true' || 
                     (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_ENVIRONMENT === 'production');

if (!isAuthorized) {
  throw new Error('JSON-2 publication requires local worker authorization (INVENTORY_AGENT_LOCAL_WORKER=true) or approved GitHub Actions environment.');
}

if (!apiKey) {
  throw new Error('Missing ODOO_API_KEY for JSON-2 publication.');
}

const cleanupApproved = process.env.INVENTORY_AGENT_CLEANUP_APPROVED === 'true';

const dryRun = JSON.parse(await readFile(join(root, 'data/inventory-agent/manifests/odoo-dry-run.json'), 'utf8'));
if (!dryRun.ok || !Array.isArray(dryRun.payloads)) throw new Error('A successful odoo:dry-run is required.');
const base = baseUrl.replace(/\/$/, '');
const headers = {
  Authorization: `bearer ${apiKey}`,
  'X-Odoo-Database': database,
  'Content-Type': 'application/json',
};

async function call(model, method, params) {
  const response = await fetch(`${base}/json/2/${encodeURIComponent(model)}/${method}`, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Odoo JSON-2 ${model}.${method} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

if (cleanupApproved) {
  const existing = await call('product.template', 'search', { domain: [] });
  const ids = Array.isArray(existing) ? existing : [];
  if (ids.length) await call('product.template', 'unlink', { ids });
}

const details = [];
for (const item of dryRun.payloads) {
  const vals = { ...item.vals };
  vals.is_published = false;
  vals.website_published = false;
  if (item.primaryImagePath) vals.image_1920 = (await readFile(join(root, item.primaryImagePath))).toString('base64');
  const key = vals.default_code || `GAL-${item.clusterId}`;
  vals.default_code = key;
  const existing = await call('product.template', 'search_read', {
    domain: [['default_code', '=', key]], fields: ['id'], limit: 1,
  });
  const ids = existing?.map((row) => row.id) || [];
  const templateId = ids.length
    ? (await call('product.template', 'write', { ids, vals }), ids[0])
    : await call('product.template', 'create', vals);
  const galleryIds = [];
  for (const [index, imagePath] of (item.galleryImagePaths || []).entries()) {
    const attachment = await call('ir.attachment', 'create', {
      name: `${key}-gallery-${index + 1}`,
      type: 'binary',
      datas: (await readFile(join(root, imagePath))).toString('base64'),
      res_model: 'product.template',
      res_id: templateId,
      public: true,
    });
    galleryIds.push(attachment);
  }
  details.push({ clusterId: item.clusterId, templateId, action: ids.length ? 'updated' : 'created', galleryIds });
}

const result = { ok: true, protocol: 'odoo-json-2', publishedCount: details.length, details, publishedAt: new Date().toISOString() };
await writeFile(join(root, 'data/inventory-agent/manifests/publication-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
