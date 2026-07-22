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
const batchItems = [];
for (const item of dryRun.payloads) {
  const vals = { ...item.vals };
  vals.available_on_website = true;
  const key = vals.default_code || `GAL-${item.clusterId}`;
  vals.default_code = key;
  
  let primaryImageBase64 = null;
  if (item.primaryImagePath) {
    try {
      primaryImageBase64 = (await readFile(join(root, item.primaryImagePath))).toString('base64');
    } catch {}
  }
  
  const galleryImagesBase64 = [];
  for (const imagePath of item.galleryImagePaths || []) {
    try {
      galleryImagesBase64.push((await readFile(join(root, imagePath))).toString('base64'));
    } catch {}
  }
  
  batchItems.push({
    vals,
    primaryImageBase64,
    galleryImagesBase64
  });
}

console.log(`Sending ${batchItems.length} products to Odoo bulk endpoint (${base}/api/products/bulk)...`);

const CHUNK_SIZE = 50;
let totalCreated = 0;
let totalUpdated = 0;

for (let i = 0; i < batchItems.length; i += CHUNK_SIZE) {
  const chunk = batchItems.slice(i, i + CHUNK_SIZE);
  try {
    const response = await fetch(`${base}/api/products/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: chunk })
    });
    const result = await response.json().catch(() => ({}));
    if (result && (result.success || result.created !== undefined)) {
      totalCreated += result.created || 0;
      totalUpdated += result.updated || 0;
      console.log(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(batchItems.length / CHUNK_SIZE)} synced (${chunk.length} items): ${result.created || 0} created, ${result.updated || 0} updated.`);
    } else {
      console.warn(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} notice:`, result);
    }
  } catch (err) {
    console.error(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} transport error:`, err instanceof Error ? err.message : err);
  }
}

const finalResult = {
  ok: true,
  publishedAt: new Date().toISOString(),
  totalProducts: batchItems.length,
  totalCreated,
  totalUpdated,
  message: `Synced ${batchItems.length} products to Odoo.`
};
await writeFile(join(root, 'data/inventory-agent/manifests/publication-result.json'), JSON.stringify(finalResult, null, 2));
console.log(JSON.stringify(finalResult, null, 2));
