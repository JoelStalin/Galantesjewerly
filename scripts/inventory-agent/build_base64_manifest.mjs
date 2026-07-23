import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dryRunPath = join(root, 'data/inventory-agent/manifests/odoo-dry-run.json');
const chunkDir = join(root, 'data/inventory-agent/manifests/base64-chunks');

await mkdir(chunkDir, { recursive: true });

console.log('Reading odoo-dry-run.json...');
const dryRun = JSON.parse(await readFile(dryRunPath, 'utf8'));
const payloads = dryRun.payloads || [];

console.log(`Processing ${payloads.length} payloads into chunks...`);

const CHUNK_SIZE = 100;
let chunkIndex = 1;

for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
  const chunkPayloads = payloads.slice(i, i + CHUNK_SIZE);
  const chunkItems = [];
  
  for (const item of chunkPayloads) {
    let primaryImageBase64 = null;
    if (item.primaryImagePath) {
      try {
        const fullPath = join(root, item.primaryImagePath);
        const buf = await readFile(fullPath);
        primaryImageBase64 = buf.toString('base64');
      } catch (err) {
        console.warn(`Could not read image for ${item.clusterId}:`, err.message);
      }
    }
    
    chunkItems.push({
      clusterId: item.clusterId,
      categoryLabel: item.categoryLabel,
      vals: item.vals,
      primaryImageBase64
    });
  }
  
  const chunkFile = join(chunkDir, `chunk-${chunkIndex}.json`);
  await writeFile(chunkFile, JSON.stringify(chunkItems, null, 2), 'utf8');
  console.log(`Saved Chunk ${chunkIndex} (${chunkItems.length} items) -> ${chunkFile}`);
  chunkIndex++;
}

console.log(`Complete! Generated ${chunkIndex - 1} chunk files.`);
