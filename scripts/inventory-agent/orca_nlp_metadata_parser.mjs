/**
 * orca_nlp_metadata_parser.mjs
 * Extracts product metadata from WhatsApp captions, corrects grammatical/spelling errors,
 * and enforces 100% fluent, luxury English terminology via Orca language models.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const ORCA_API_URL = process.env.ORCA_API_URL || 'http://localhost:8000';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';

/**
 * Deterministic fallback parser to guarantee zero Spanish words and clean English structure.
 */
export function parseDeterministicEnglish(rawText) {
  const text = String(rawText || '').trim();

  // 1. Price extraction
  let price = null;
  const priceMatch = text.match(/\$\s*(\d+(?:[.,]\d+)?)/) ||
                     text.match(/(?:precio|price)\s*[:=]?\s*\$?\s*(\d+(?:[.,]\d+)?)/i);
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(',', '.'));
  }

  // 2. Stock extraction
  let stock = 1;
  const stockMatch = text.match(/(?:stock|disponible|cantidad|cant|qty|quantity)\s*[:=]?\s*(\d+)/i);
  if (stockMatch) {
    stock = parseInt(stockMatch[1], 10);
  }

  // 3. Weight in grams
  let weight = null;
  const weightMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos|grams)/i);
  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  // 4. Karat detection
  let karat = '14K';
  const karatMatch = text.match(/(10k|14k|18k|22k|24k|10\s*kt|14\s*kt|18\s*kt|24\s*kt|14\s*kilates|18\s*kilates|10\s*kilates)/i);
  if (karatMatch) {
    karat = karatMatch[1].toUpperCase().replace(/\s*KILATES|\s*KT/, 'K');
  }

  // 5. Category classification
  let category = 'Jewelry';
  let singular = 'Piece';
  if (/anillo|sortija|ring/i.test(text)) {
    category = 'Rings';
    singular = 'Ring';
  } else if (/cadena|collar|necklace|chain/i.test(text)) {
    category = 'Chains';
    singular = 'Chain';
  } else if (/pulsera|esclava|bracelet|brazalete/i.test(text)) {
    category = 'Bracelets';
    singular = 'Bracelet';
  } else if (/dije|pendant|medalla|colgante/i.test(text)) {
    category = 'Pendants';
    singular = 'Pendant';
  } else if (/arete|pendiente|earring|dormilona/i.test(text)) {
    category = 'Earrings';
    singular = 'Earrings';
  } else if (/reloj|watch/i.test(text)) {
    category = 'Watches';
    singular = 'Watch';
  }

  // 6. Metal Material
  let material = 'Yellow Gold';
  if (/blanco|white/i.test(text)) material = 'White Gold';
  else if (/rosa|rose/i.test(text)) material = 'Rose Gold';
  else if (/plata|silver/i.test(text)) material = 'Sterling Silver';
  else if (/platino|platinum/i.test(text)) material = 'Platinum';
  else if (/oro|gold/i.test(text)) material = 'Yellow Gold';

  // 7. Gemstones
  let gemstone = null;
  if (/diamante|brillante|diamond/i.test(text)) gemstone = 'Diamond';
  else if (/esmeralda|emerald/i.test(text)) gemstone = 'Emerald';
  else if (/zafiro|sapphire/i.test(text)) gemstone = 'Sapphire';
  else if (/rubi|ruby/i.test(text)) gemstone = 'Ruby';

  // 8. Style Details (Cuban, Figaro, Tennis, Solitaire, etc.)
  let style = '';
  if (/cuban|cubana/i.test(text)) style = ' Cuban Link';
  else if (/figaro/i.test(text)) style = ' Figaro Link';
  else if (/tennis|tenis/i.test(text)) style = ' Tennis';
  else if (/solitario|solitaire/i.test(text)) style = ' Solitaire';
  else if (/rope|cordon/i.test(text)) style = ' Rope';
  else if (/franco/i.test(text)) style = ' Franco';

  // Construct flawless English Title
  const gemSuffix = gemstone ? ` with ${gemstone}s` : '';
  const title = `${karat} ${material}${style} ${singular}${gemSuffix}`.trim();

  // Construct English Description
  const weightStr = weight ? ` Weighs approximately ${weight} grams.` : '';
  const description = `Luxury ${karat} ${material.toLowerCase()}${style.toLowerCase()} ${singular.toLowerCase()}${gemSuffix}. Designed with precision craftsmanship and timeless elegance, suitable for everyday luxury and high-profile occasions.${weightStr}`;

  return {
    title,
    description,
    price: price || 0.0,
    stock: stock || 1,
    category,
    attributes: {
      karat,
      material,
      style: style.trim() || 'Classic',
      gemstone,
      weight_grams: weight,
      language: 'en'
    }
  };
}

/**
 * Ask Orca / Ollama model to process raw caption with grammar correction strictly in English.
 */
export async function parseWithOrcaLLM(rawCaption) {
  if (!rawCaption || !rawCaption.trim()) {
    return parseDeterministicEnglish('');
  }

  const systemPrompt = `You are Galante's Jewelry Catalog AI within the Orca Automation Platform.
Analyze the following WhatsApp message describing a piece of jewelry.
Correct all spelling and grammar mistakes.
STRICT RULE: All output values MUST be in 100% ENGLISH. Never use Spanish.
Extract:
1. title: Refined luxury product title in English (e.g., "14K Yellow Gold Cuban Link Chain")
2. description: Elegant product description in English
3. price: Float price (extract from text or estimate 0.0)
4. stock: Integer stock quantity (default 1)
5. category: One of ["Rings", "Chains", "Bracelets", "Pendants", "Earrings", "Watches"]
6. karat: e.g. "10K", "14K", "18K"
7. material: e.g. "Yellow Gold", "White Gold", "Platinum"
8. weight_grams: Float or null
9. gemstone: string or null

Return ONLY a valid JSON object with these keys. No explanation or markdown code block.`;

  // Attempt 1: Orca FastAPI orchestrator
  try {
    const res = await fetch(`${ORCA_API_URL}/api/test-flow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: 'galantesjewelry',
        context: `${systemPrompt}\n\nInput message: "${rawCaption}"`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const outputText = data.output || data.result || '';
      const cleanJson = outputText.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.title) return parsed;
    }
  } catch {}

  // Attempt 2: Local Ollama instance
  try {
    const res = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: `${systemPrompt}\n\nInput message: "${rawCaption}"`,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.response);
      if (parsed.title) return parsed;
    }
  } catch {}

  // Attempt 3: Deterministic English parser (rock-solid, zero dependencies)
  return parseDeterministicEnglish(rawCaption);
}
