import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const envPath = path.join(root, '.env.local');

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

async function readJson(relativePath, fallback = null) {
  const target = path.join(root, relativePath);
  try {
    return JSON.parse(await fs.readFile(target, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(relativePath, payload) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function imagePart(relativePath) {
  const data = await fs.readFile(path.join(root, relativePath));
  return {
    inlineData: {
      mimeType: mimeFromPath(relativePath),
      data: data.toString('base64'),
    },
  };
}

function parseJson(text) {
  return JSON.parse(text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim());
}

async function generateWithFallback(ai, models, contents) {
  let lastError = '';
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      return { model, text: response.text || '' };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { model: null, error: lastError };
}

async function main() {
  await loadEnvFile();
  if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY in .env.local.');

  const reviewed = await readJson('data/inventory-agent/manifests/ml-product-clusters-reviewed.json');
  const base = await readJson('data/inventory-agent/manifests/ml-product-clusters.json');
  const clusters = (
    reviewed?.sourceClusterGeneratedAt
    && base?.generatedAt
    && reviewed.sourceClusterGeneratedAt === base.generatedAt
  ) ? reviewed : base;
  if (!clusters) throw new Error('Missing reviewed cluster manifest.');

  const existing = await readJson('data/inventory-agent/manifests/product-metadata-suggestions.json', { suggestions: [] });
  const existingByCluster = new Map((existing.suggestions || []).map((item) => [item.clusterId, item]));
  const maxClusters = Number(process.env.GEMINI_PRODUCT_METADATA_MAX_CLUSTERS || '10');
  const models = (process.env.GEMINI_PRODUCT_METADATA_MODELS || 'gemini-flash-lite-latest,gemini-flash-latest')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const categories = ['rings', 'necklaces', 'bracelets', 'earrings', 'pendants', 'brooches', 'watches', 'sets', 'jewelry', 'unknown'];
  const materials = ['gold', 'silver', 'rose_gold', 'steel', 'pearl', 'turquoise', 'larimar', 'stone', 'crystal', 'beads', 'mixed', 'unknown'];
  const generated = [];

  for (const cluster of (clusters.clusters || []).slice(0, maxClusters)) {
    const file = cluster.representative || cluster.files?.[0];
    if (!file?.localPath) continue;
    const prompt = [
      'Eres catalogador de inventario para una joyeria. Analiza la imagen del producto principal.',
      'Ignora fondo, soporte, planta, estrella de mar, mano, sombras y decoracion.',
      'Devuelve SOLO JSON valido con esta forma exacta:',
      '{"productName":"...","category":"...","material":"...","shortDescription":"...","confidence":0-1,"reason":"maximo 20 palabras"}',
      `category debe ser uno de: ${categories.join(', ')}`,
      `material debe ser uno de: ${materials.join(', ')}`,
      'Si no estas seguro, usa category unknown o material unknown y baja confidence.',
      'No inventes precio ni stock.',
    ].join('\n');
    const result = await generateWithFallback(ai, models, [{
      role: 'user',
      parts: [{ text: prompt }, await imagePart(file.localPath)],
    }]);
    let suggestion;
    if (result.error) {
      suggestion = {
        clusterId: cluster.clusterId,
        ok: false,
        error: result.error.slice(0, 180),
        reviewRequired: true,
      };
    } else {
      try {
        const parsed = parseJson(result.text);
        suggestion = {
          clusterId: cluster.clusterId,
          suggestedProductName: String(parsed.productName || ''),
          suggestedCategory: categories.includes(parsed.category) ? parsed.category : 'unknown',
          categoryConfidence: Number(parsed.confidence || 0),
          suggestedMaterial: materials.includes(parsed.material) ? parsed.material : 'unknown',
          materialConfidence: Number(parsed.confidence || 0),
          shortDescription: String(parsed.shortDescription || ''),
          reason: String(parsed.reason || ''),
          model: result.model,
          reviewRequired: true,
        };
      } catch {
        suggestion = {
          clusterId: cluster.clusterId,
          ok: false,
          error: `Invalid JSON: ${String(result.text).slice(0, 180)}`,
          reviewRequired: true,
        };
      }
    }
    existingByCluster.set(cluster.clusterId, {
      ...(existingByCluster.get(cluster.clusterId) || {}),
      ...suggestion,
    });
    generated.push(suggestion);
  }

  const payload = {
    ok: true,
    policy: 'gemini_metadata_suggestions_only_human_review_required',
    generatedCount: generated.length,
    suggestions: Array.from(existingByCluster.values()),
  };
  await writeJson('data/inventory-agent/manifests/product-metadata-suggestions.json', payload);
  await writeJson('data/inventory-agent/review/gemini-product-metadata.json', { ok: true, generated });
  console.log(JSON.stringify({
    ok: true,
    generated: generated.length,
    output: 'data/inventory-agent/manifests/product-metadata-suggestions.json',
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
