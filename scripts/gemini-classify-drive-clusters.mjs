#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DEFAULT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const DEFAULT_MAX_IMAGES = 3;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

function parseArgs(argv) {
  const options = {
    manifest: '',
    out: path.join(ARTIFACTS_DIR, 'gdrive-classified-manifest.json'),
    model: DEFAULT_MODEL,
    maxImages: DEFAULT_MAX_IMAGES,
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--manifest' && argv[index + 1]) {
      options.manifest = path.resolve(argv[index + 1]);
      index += 1;
    } else if (current === '--out' && argv[index + 1]) {
      options.out = path.resolve(argv[index + 1]);
      index += 1;
    } else if (current === '--model' && argv[index + 1]) {
      options.model = argv[index + 1];
      index += 1;
    } else if (current === '--max-images' && argv[index + 1]) {
      options.maxImages = Number.parseInt(argv[index + 1], 10) || DEFAULT_MAX_IMAGES;
      index += 1;
    } else if (current === '--confidence-threshold' && argv[index + 1]) {
      options.confidenceThreshold = Number.parseFloat(argv[index + 1]) || DEFAULT_CONFIDENCE_THRESHOLD;
      index += 1;
    } else if (current === '-h' || current === '--help') {
      console.log([
        'Usage:',
        '  node scripts/gemini-classify-drive-clusters.mjs --manifest <manifest.json> [--out <classified-manifest.json>]',
        '',
        'Environment:',
        '  GEMINI_API_KEY                required for Gemini classification',
        '  GOOGLE_APPLICATION_CREDENTIALS Drive readonly access for remote file ids',
        '  GEMINI_TEXT_MODEL             optional Gemini model override',
      ].join('\n'));
      process.exit(0);
    }
  }

  return options;
}

function normalizeMaybeString(value) {
  return String(value ?? '').trim();
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function isLocalFileId(fileId) {
  return typeof fileId === 'string' && fileId.startsWith('file://');
}

function createDriveClient() {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentials,
    scopes: [DRIVE_SCOPE],
  });

  return google.drive({ version: 'v3', auth });
}

async function downloadDriveFile(drive, fileId) {
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'arraybuffer' },
  );

  return Buffer.from(response.data);
}

async function readClusterImage(file, drive) {
  if (isLocalFileId(file?.id)) {
    const fileUrl = new URL(file.id);
    return fs.readFile(fileUrl);
  }

  if (drive && file?.id) {
    return downloadDriveFile(drive, file.id);
  }

  return null;
}

function extractJson(text) {
  const trimmed = normalizeMaybeString(text);
  if (!trimmed) {
    return null;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? trimmed.slice(firstBrace, lastBrace + 1)
    : trimmed;

  return JSON.parse(candidate);
}

function buildPrompt(cluster, product) {
  return [
    'You are classifying a jewelry product cluster for ecommerce publication.',
    'Return a single JSON object with these keys:',
    'name, category, material, shortDescription, longDescription, keywords, confidence, reviewRequired',
    '',
    'Rules:',
    '- Use only what is visible or strongly implied by the images and folder context.',
    '- Do not invent gemstones, carats, metals, or certifications.',
    '- If the cluster looks mixed or uncertain, set reviewRequired to true.',
    '- confidence must be a number between 0 and 1.',
    '- keywords must be an array of short strings.',
    '',
    `Current cluster label: ${cluster.label || ''}`,
    `Current product name: ${product.name || ''}`,
    `Current category: ${product.category || ''}`,
    `Current material: ${product.material || ''}`,
  ].join('\n');
}

async function callGemini(model, imageBuffers, prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini classification.');
  }

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  contents[0].parts.push(
    ...imageBuffers.map((buffer) => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: toBase64(buffer),
      },
    })),
  );

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
      }),
    },
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini classification failed (${response.status}): ${responseText}`);
  }

  const responseJson = JSON.parse(responseText);
  const rawText = responseJson?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim() || responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!rawText) {
    throw new Error('Gemini returned no classification text.');
  }

  return extractJson(rawText);
}

async function enrichManifest(manifestPath, options) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  const drive = createDriveClient();
  const products = Array.isArray(manifest.products) ? manifest.products : [];

  const classifiedProducts = [];
  for (const product of products) {
    const files = Array.isArray(product.files) ? product.files.slice(0, options.maxImages) : [];
    const imageBuffers = [];

    for (const file of files) {
      const buffer = await readClusterImage(file, drive);
      if (buffer) {
        imageBuffers.push(buffer);
      }
    }

    if (imageBuffers.length === 0) {
      classifiedProducts.push({
        ...product,
        classificationSource: 'no-images-available',
        confidence: 0,
        reviewRequired: true,
      });
      continue;
    }

    const classification = await callGemini(
      options.model,
      imageBuffers,
      buildPrompt(product, product),
    );

    const confidence = Number(classification?.confidence);
    const reviewRequired = Boolean(classification?.reviewRequired || !Number.isFinite(confidence) || confidence < options.confidenceThreshold);

    classifiedProducts.push({
      ...product,
      name: normalizeMaybeString(classification?.name) || product.name,
      category: normalizeMaybeString(classification?.category) || product.category,
      material: normalizeMaybeString(classification?.material) || product.material,
      shortDescription: normalizeMaybeString(classification?.shortDescription) || product.shortDescription,
      longDescription: normalizeMaybeString(classification?.longDescription) || product.longDescription,
      keywords: Array.isArray(classification?.keywords) ? classification.keywords : product.keywords || [],
      confidence: Number.isFinite(confidence) ? confidence : 0,
      requiresReview: reviewRequired,
      reviewRequired,
      classificationModel: options.model,
      classificationSource: 'gemini',
    });
  }

  const enriched = {
    ...manifest,
    classifiedAt: new Date().toISOString(),
    classifier: {
      model: options.model,
      confidenceThreshold: options.confidenceThreshold,
    },
    products: classifiedProducts,
  };

  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  await fs.writeFile(options.out, JSON.stringify(enriched, null, 2), 'utf-8');

  console.log(JSON.stringify({
    ok: true,
    manifest: manifestPath,
    out: options.out,
    model: options.model,
    classifiedProducts: classifiedProducts.length,
  }, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.manifest) {
    throw new Error('--manifest is required.');
  }

  await enrichManifest(options.manifest, options);
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
