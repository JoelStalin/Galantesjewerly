import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
async function loadGoogleGenAI() {
  try {
    const mod = await import('@google/genai');
    return mod.GoogleGenAI;
  } catch {
    const fallbackUrl = 'file:///C:/Users/yoeli/Documents/GetUpSoft_Workspace/products/galantesjewelry/node_modules/@google/genai/dist/index.mjs';
    const mod = await import(fallbackUrl);
    return mod.GoogleGenAI;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

async function loadEnv() {
  const envFiles = ['.env.local', '.env', '.env.prod'];
  for (const file of envFiles) {
    try {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {}
  }
}

export function parseMetadataDeterministic(rawText) {
  const text = String(rawText || '');
  
  // Extract Price
  let price = null;
  const priceMatch = text.match(/(?:precio|price|\$)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(',', '.'));
  }

  // Extract Stock
  let stock = 1;
  const stockMatch = text.match(/(?:stock|disponible|cantidad|cant)\s*[:=]?\s*(\d+)/i);
  if (stockMatch) {
    stock = parseInt(stockMatch[1], 10);
  }

  // Extract Weight
  let weight = null;
  const weightMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos|grams)/i);
  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  // Extract Karat
  let karat = null;
  const karatMatch = text.match(/(10k|14k|18k|24k|10\s*kt|14\s*kt|18\s*kt|24\s*kt|14\s*kilates|18\s*kilates|10\s*kilates)/i);
  if (karatMatch) {
    karat = karatMatch[1].toUpperCase().replace(/\s*KILATES|\s*KT/, 'K');
  }

  // Category classification
  let category = 'Jewelry';
  if (/anillo|sortija|ring/i.test(text)) category = 'Rings';
  else if (/cadena|chain|collar|necklace/i.test(text)) category = 'Chains';
  else if (/pulsera|bracelet|esclava/i.test(text)) category = 'Bracelets';
  else if (/dije|pendant|medalla/i.test(text)) category = 'Pendants';
  else if (/arete|pendiente|earring/i.test(text)) category = 'Earrings';
  else if (/reloj|watch/i.test(text)) category = 'Watches';

  // Material & Gemstone
  let material = 'Gold';
  if (/plata|silver/i.test(text)) material = 'Silver';
  else if (/platino|platinum/i.test(text)) material = 'Platinum';

  let gemstone = null;
  if (/diamante|diamond/i.test(text)) gemstone = 'Diamond';
  else if (/esmeralda|emerald/i.test(text)) gemstone = 'Emerald';
  else if (/zafiro|sapphire/i.test(text)) gemstone = 'Sapphire';
  else if (/rubi|ruby/i.test(text)) gemstone = 'Ruby';

  // Strict English Title
  const karatStr = karat ? `${karat} ` : '14K ';
  const matStr = /amarillo|yellow/i.test(text) ? 'Yellow Gold' : (/blanco|white/i.test(text) ? 'White Gold' : 'Gold');
  const gemStr = gemstone ? ` with ${gemstone}s` : '';
  const styleStr = /cuban|cubana/i.test(text) ? ' Cuban Link' : '';
  
  const title = `${karatStr}${matStr}${styleStr} ${category.slice(0, -1)}${gemStr}`.trim();
  const description = `Exquisite ${karatStr}${matStr}${styleStr} ${category.slice(0, -1).toLowerCase()}${gemStr}. Crafted with master detail and elegance, perfect for everyday luxury and statement collections. Weighs approximately ${weight || 'N/A'} grams.`;

  return {
    title,
    price,
    stock,
    category,
    description,
    extracted_attributes: {
      material: matStr,
      karat: karat || '14K',
      weight_grams: weight,
      gemstone,
    }
  };
}

export async function parseAndNormalizeWhatsAppMetadata(rawText, { client = null } = {}) {
  await loadEnv();

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey && !client) {
    // Graceful deterministic fallback: strictly pure English, extracting all required fields
    return parseMetadataDeterministic(rawText);
  }

  let ai = client;
  if (!ai) {
    const GoogleGenAI = await loadGoogleGenAI();
    ai = new GoogleGenAI({ apiKey });
  }

  const prompt = `You are the lead luxury product curator and jewelry expert at Galante's Jewelry.
Analyze the following raw WhatsApp message text describing a jewelry piece.
Raw Text: """${rawText}"""

Requirements:
1. STRICT LANGUAGE REQUIREMENT: Output MUST be entirely in ENGLISH. Correct all grammatical and spelling errors. Do NOT include any Spanish words in the final title or description.
2. Extract the price as a numerical float (e.g., 450.0). If missing, return null.
3. Extract the stock quantity as an integer. Default to 1 if not explicitly stated.
4. Classify into an exact standard luxury jewelry category: Rings, Chains, Bracelets, Pendants, Earrings, Necklaces, or Watches.
5. Create a clean, elegant, SEO-friendly luxury Title in English (e.g. "14K Solid Yellow Gold Diamond Cuban Link Chain").
6. Create an engaging, high-end commercial Description in English emphasizing craftsmanship, material quality, and luxury appeal.

Return ONLY a valid JSON object matching this schema with no markdown code blocks:
{
  "title": string,
  "price": number | null,
  "stock": number,
  "category": string,
  "description": string,
  "extracted_attributes": {
    "material": string | null,
    "karat": string | null,
    "weight_grams": number | null,
    "gemstone": string | null
  }
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const responseText = response.text || '';
  const cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  return JSON.parse(cleaned);
}
