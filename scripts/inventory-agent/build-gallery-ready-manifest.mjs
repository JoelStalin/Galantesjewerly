import fs from 'node:fs/promises';
const review = JSON.parse(await fs.readFile('data/inventory-agent/review/antigravity-cluster-review.json', 'utf8'));
const clusters = JSON.parse(await fs.readFile('data/inventory-agent/manifests/ml-product-clusters-reviewed.json', 'utf8'));
const byId = new Map((clusters.clusters || []).map((cluster) => [cluster.clusterId, cluster]));
const products = (review.reviews || []).filter((item) => item.sameProduct === true && Number(item.confidence) >= 0.75).map((item) => {
  const cluster = byId.get(item.clusterId);
  return { clusterId: item.clusterId, confidence: item.confidence, primaryImagePath: cluster.files[0].localPath, galleryImagePaths: cluster.files.slice(1).map((file) => file.localPath), galleryImageCount: Math.max(0, cluster.files.length - 1), source: item.source || 'google-ai-studio' };
});
const output = { ok: true, generatedAt: new Date().toISOString(), policy: 'sameProduct=true and confidence>=0.75', products };
await fs.writeFile('data/inventory-agent/manifests/gallery-ready-products.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, galleryReady: products.length, galleryImages: products.reduce((sum, item) => sum + item.galleryImageCount, 0) }));
