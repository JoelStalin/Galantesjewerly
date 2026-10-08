import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

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

export async function parseAndNormalizeWhatsAppMetadata(rawText, { client = null } = {}) {
  await loadEnv();

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey && !client) {
    throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is required to normalize metadata.');
  }

  const ai = client || new GoogleGenAI({ apiKey });

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
