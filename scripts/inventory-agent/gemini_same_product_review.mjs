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

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
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
  const absolutePath = path.join(root, relativePath);
  const data = await fs.readFile(absolutePath);
  return {
    inlineData: {
      mimeType: mimeFromPath(relativePath),
      data: data.toString('base64'),
    },
  };
}

function parseJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

async function main() {
  await loadEnvFile();
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in .env.local.');
  }
  const clusters = await readJson('data/inventory-agent/manifests/ml-product-clusters.json');
  const featureManifest = await readJson('data/inventory-agent/manifests/image-features.json');
  const fileById = new Map((featureManifest.files || []).map((file) => [file.id, file]));
  const pairs = (clusters.geminiReviewPairs || []).slice(0, Number(process.env.GEMINI_SAME_PRODUCT_MAX_PAIRS || '25'));
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = (process.env.GEMINI_SAME_PRODUCT_MODELS || process.env.GEMINI_SAME_PRODUCT_MODEL || 'gemini-flash-latest,gemini-flash-lite-latest')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const reviews = [];

  for (const pair of pairs) {
    const source = fileById.get(pair.sourceId);
    const target = fileById.get(pair.targetId);
    if (!source || !target) continue;
    const prompt = [
      'Eres un verificador visual estricto para inventario de joyeria.',
      'Debes decidir si las dos imagenes muestran exactamente el mismo producto fisico para subirlas al mismo producto de Odoo.',
      'Ignora fondo, mano, soporte, planta, estrella de mar, iluminacion, rotacion y recorte.',
      'Compara la pieza principal: forma, metal, piedra, color, patron, cierre, dije, cadena, montura y detalles.',
      'Responde SOLO JSON valido con esta forma:',
      '{"sameProduct":true|false,"confidence":0-1,"reason":"maximo 20 palabras"}',
      'Usa false si no estas seguro.',
      `Score local previo: ${pair.sameProductScore}. Banda: ${pair.decisionBand}.`,
      `Imagen A: ${source.name}. Imagen B: ${target.name}.`,
    ].join('\n');
    const parts = [
      { text: prompt },
      await imagePart(source.localPath),
      await imagePart(target.localPath),
    ];
    let text = '';
    let usedModel = '';
    let lastError = '';
    for (const candidateModel of models) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            temperature: 0,
          },
        });
        text = response.text || '';
        usedModel = candidateModel;
        lastError = '';
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    let result;
    if (lastError && !text) {
      result = { sameProduct: false, confidence: 0, reason: `Gemini unavailable: ${lastError.slice(0, 80)}` };
    } else try {
      result = parseJson(text);
    } catch {
      result = { sameProduct: false, confidence: 0, reason: `Invalid JSON: ${text.slice(0, 120)}` };
    }
    reviews.push({
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      sameProduct: Boolean(result.sameProduct),
      confidence: Number(result.confidence || 0),
      reason: String(result.reason || ''),
      localScore: pair.sameProductScore,
      model: usedModel || null,
    });
  }

  const payload = {
    ok: true,
    models,
    policy: 'Only pairs with local score 0.60-0.85 are sent to Gemini. Gemini returns boolean sameProduct.',
    reviewedPairs: reviews.length,
    reviews,
  };
  await writeJson('data/inventory-agent/review/gemini-same-product-review.json', payload);
  console.log(JSON.stringify({
    ok: true,
    reviewedPairs: reviews.length,
    sameProductTrue: reviews.filter((item) => item.sameProduct).length,
    output: 'data/inventory-agent/review/gemini-same-product-review.json',
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
