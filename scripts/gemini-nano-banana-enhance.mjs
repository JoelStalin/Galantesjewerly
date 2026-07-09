#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

function parseArgs(argv) {
  const args = {
    input: '',
    output: '',
    model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    prompt:
      process.env.GEMINI_ENHANCE_PROMPT ||
      'Enhance this jewelry product photo for a premium ecommerce storefront. Preserve the exact piece, stones, shape, metal color, engraving, and proportions. Remove clutter, improve lighting, increase clarity, and return a clean professional catalog image.',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--model' && argv[index + 1]) {
      args.model = argv[index + 1];
      index += 1;
    } else if (current === '--prompt' && argv[index + 1]) {
      args.prompt = argv[index + 1];
      index += 1;
    } else if (!args.input) {
      args.input = current;
    } else if (!args.output) {
      args.output = current;
    }
  }

  return args;
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  return 'image/jpeg';
}

function extractImageData(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      const inlineData = part?.inlineData;
      if (inlineData?.data) {
        return inlineData.data;
      }
      if (part?.data && part?.mimeType?.startsWith('image/')) {
        return part.data;
      }
    }
  }

  return '';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.input || !options.output) {
    console.error('Usage: node scripts/gemini-nano-banana-enhance.mjs <input-image> <output-image> [--model <model>] [--prompt <text>]');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for Nano Banana enhancement.');
  }

  const inputBuffer = await fs.readFile(options.input);
  const payload = {
    contents: [
      {
        parts: [
          { text: options.prompt },
          {
            inlineData: {
              mimeType: guessMimeType(options.input),
              data: inputBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['Image'],
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(options.model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}): ${responseText}`);
  }

  const responseJson = JSON.parse(responseText);
  const imageData = extractImageData(responseJson);

  if (!imageData) {
    throw new Error('Gemini returned no image data.');
  }

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, Buffer.from(imageData, 'base64'));

  console.log(JSON.stringify({
    ok: true,
    input: options.input,
    output: options.output,
    model: options.model,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
