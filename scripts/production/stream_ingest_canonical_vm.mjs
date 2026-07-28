import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const dryRunPath = join(root, 'data/inventory-agent/manifests/odoo-dry-run.json');

const dryRunRaw = await readFile(dryRunPath, 'utf8').catch(() => null);
if (!dryRunRaw) {
  console.error(`Missing ${dryRunPath}`);
  process.exit(1);
}

const dryRun = JSON.parse(dryRunRaw);
const payloads = dryRun.payloads || [];
const targetUrl = process.env.ODOO_INGEST_URL || 'http://odoo:8069/api/products/ingest';

console.log(`[Canonical VM Streamer] Target URL: ${targetUrl}`);
console.log(`[Canonical VM Streamer] Starting 1-by-1 ingestion of ${payloads.length} products...`);

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

let successCount = 0;
let failCount = 0;
const startTime = Date.now();

for (let i = 0; i < payloads.length; i++) {
  const item = payloads[i];
  const clusterId = item.clusterId || `item-${i + 1}`;
  const sku = item.vals?.default_code || `GAL-${clusterId}`;
  const catKey = (item.categoryLabel || 'jewelry').toLowerCase().trim();
  const title = categoryTitles[catKey] || 'Joya Fina Galantes';

  let primaryImageBase64 = null;
  if (item.primaryImagePath) {
    try {
      const fullPath = join(root, item.primaryImagePath);
      const buf = await readFile(fullPath);
      primaryImageBase64 = buf.toString('base64');
    } catch {}
  }

  const galleryImagesBase64 = [];
  for (const gPath of item.galleryImagePaths || []) {
    try {
      const fullPath = join(root, gPath);
      const buf = await readFile(fullPath);
      galleryImagesBase64.push(buf.toString('base64'));
    } catch {}
  }

  const productData = {
    sku,
    name: title,
    price: item.vals?.list_price || 1500,
    cost: item.vals?.standard_price || 750,
    type: 'consu',
    available_on_website: true,
    is_published: true,
    primaryImageBase64,
    galleryImagesBase64,
  };

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [productData] }),
    });

    const result = await res.json().catch(() => ({}));
    if (res.ok && result.success) {
      successCount++;
      if ((i + 1) % 10 === 0 || i === payloads.length - 1) {
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rate = (i + 1) / elapsedSec;
        console.log(`[${i + 1}/${payloads.length}] Synced ${sku} (${title}) -> HTTP 200 OK | Speed: ${rate.toFixed(1)} items/s`);
      }
    } else {
      failCount++;
      console.warn(`[${i + 1}/${payloads.length}] FAILED ${sku}: HTTP ${res.status}`, result);
    }
  } catch (err) {
    failCount++;
    console.error(`[${i + 1}/${payloads.length}] ERROR ${sku}:`, err.message);
  }
}

const elapsedSec = (Date.now() - startTime) / 1000;
console.log('\n==========================================');
console.log(`Canonical VM Ingestion Finished in ${elapsedSec.toFixed(1)}s`);
console.log(`Success: ${successCount} / ${payloads.length}`);
console.log(`Failed:  ${failCount}`);
console.log('==========================================');
