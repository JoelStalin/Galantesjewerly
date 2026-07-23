#!/usr/bin/env node
/** Streaming Odoo HTTP Publisher.
 * Streams products directly from local intake to Odoo production API in real time.
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
const base = baseUrl.replace(/\/$/, '');

const dryRunPath = join(root, 'data/inventory-agent/manifests/odoo-dry-run.json');
const dryRun = JSON.parse(await readFile(dryRunPath, 'utf8'));
const payloads = dryRun.payloads || [];

console.log(`Starting real-time streaming ingestion of ${payloads.length} products to ${base}/api/products/ingest...`);

const categoryTitles = {
  necklaces: 'Collar Fino Galantes',
  necklace: 'Collar Fino Galantes',
  chains: 'Cadena de Oro Galantes',
  chain: 'Cadena de Oro Galantes',
  rings: 'Anillo Elegante Galantes',
  ring: 'Anillo Elegante Galantes',
  earrings: 'Aretes Elegantes Galantes',
  earring: 'Aretes Elegantes Galantes',
  bracelets: 'Pulsera Fina Galantes',
  bracelet: 'Pulsera Fina Galantes',
  pendants: 'Dije Elegante Galantes',
  pendant: 'Dije Elegante Galantes',
  jewelry: 'Joya Fina Galantes',
};

const STREAM_CHUNK_SIZE = 5;
let totalCreated = 0;
let totalUpdated = 0;
let totalFailed = 0;

for (let i = 0; i < payloads.length; i += STREAM_CHUNK_SIZE) {
  const rawChunk = payloads.slice(i, i + STREAM_CHUNK_SIZE);
  const productsToIngest = [];

  for (const item of rawChunk) {
    const clusterId = item.clusterId || 'item';
    const sku = item.vals?.default_code || `GAL-${clusterId}`;
    const catKey = (item.categoryLabel || 'jewelry').toLowerCase().trim();
    const title = categoryTitles[catKey] || 'Joya Fina Galantes';

    let primaryImageBase64 = null;
    if (item.primaryImagePath) {
      try {
        const fullPath = join(root, item.primaryImagePath);
        const buf = await readFile(fullPath);
        primaryImageBase64 = buf.toString('base64');
      } catch (err) {
        console.warn(`[Stream] Could not read image for ${clusterId}:`, err.message);
      }
    }

    const galleryImagesBase64 = [];
    for (const gPath of item.galleryImagePaths || []) {
      try {
        const fullPath = join(root, gPath);
        const buf = await readFile(fullPath);
        galleryImagesBase64.push(buf.toString('base64'));
      } catch {}
    }

    productsToIngest.push({
      sku,
      name: title,
      price: item.vals?.list_price || 1500,
      cost: item.vals?.standard_price || 750,
      type: 'consu', // Mandatory consumable product, NEVER a service
      available_on_website: true,
      is_published: true,
      primaryImageBase64,
      galleryImagesBase64,
    });
  }

  const currentChunkNumber = Math.floor(i / STREAM_CHUNK_SIZE) + 1;
  const totalChunks = Math.ceil(payloads.length / STREAM_CHUNK_SIZE);

  try {
    const response = await fetch(`${base}/api/products/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: productsToIngest }),
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && result.success) {
      totalCreated += result.created || 0;
      totalUpdated += result.updated || 0;
      console.log(`[Stream ${currentChunkNumber}/${totalChunks}] Synced ${productsToIngest.length} items (${result.created || 0} created, ${result.updated || 0} updated).`);
    } else {
      totalFailed += productsToIngest.length;
      console.warn(`[Stream ${currentChunkNumber}/${totalChunks}] HTTP ${response.status} Notice:`, result);
    }
  } catch (err) {
    totalFailed += productsToIngest.length;
    console.error(`[Stream ${currentChunkNumber}/${totalChunks}] Transport error:`, err instanceof Error ? err.message : err);
  }
}

const summary = {
  ok: totalFailed === 0,
  publishedAt: new Date().toISOString(),
  totalProducts: payloads.length,
  totalCreated,
  totalUpdated,
  totalFailed,
  endpoint: `${base}/api/products/ingest`,
};

await writeFile(join(root, 'data/inventory-agent/manifests/publication-result.json'), JSON.stringify(summary, null, 2));
console.log('\n--- Real-Time Streaming Ingestion Summary ---');
console.log(JSON.stringify(summary, null, 2));
