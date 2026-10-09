/**
 * orca_decision_learner.mjs
 * Active learning engine connected to Orca platform.
 * Persists every human decision, updates product vector exemplars,
 * and retrains similarity bounds so the model learns continuously.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const EVIDENCE_DIR = path.join(root, 'data', 'inventory-agent', 'evidence');
const ORCA_TENANT_DIR = path.join(root, 'data', 'orca', 'tenants', 'galantesjewelry');
const VECTORS_PATH = path.join(root, 'data', 'inventory-agent', 'vectors', 'image-vectors.json');

/**
 * Log decision to Orca's multi-tenant active learning stream.
 */
export async function logWhatsAppDecision({
  incomingImagePath,
  matchedProductId = null,
  matchedSku = null,
  similarityScore = 0.0,
  decision = 'auto_matched', // 'auto_matched' | 'confirmed_match' | 'rejected_match' | 'backlog_new_product' | 'discarded'
  rawText = '',
  parsedMetadata = null,
  operatorChoice = null,
  alternativeCandidates = []
} = {}) {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  await fs.mkdir(ORCA_TENANT_DIR, { recursive: true });

  const record = {
    timestamp: new Date().toISOString(),
    incomingImagePath,
    matchedProductId,
    matchedSku,
    similarityScore,
    decision,
    rawText,
    parsedMetadata,
    operatorChoice,
    alternativeCandidates,
  };

  const line = `${JSON.stringify(record)}\n`;

  // Write to Galantes local evidence log
  await fs.appendFile(path.join(EVIDENCE_DIR, 'whatsapp_decisions.jsonl'), line, 'utf8');

  // Write to Orca tenant active learning ledger
  await fs.appendFile(path.join(ORCA_TENANT_DIR, 'learning-feedback.jsonl'), line, 'utf8');

  // If a human confirmed a match (or auto-match verified), add as a new vector exemplar!
  if (decision === 'confirmed_match' && (matchedSku || matchedProductId) && incomingImagePath) {
    await learnProductExemplar({
      imagePath: incomingImagePath,
      sku: matchedSku,
      productId: matchedProductId,
    }).catch((err) => {
      console.warn(`[Orca Active Learning] Could not append exemplar vector: ${err.message}`);
    });
  }

  return { ok: true, record };
}

/**
 * Adds the new incoming photo as a positive exemplar for the confirmed product SKU in the vector index.
 */
export async function learnProductExemplar({ imagePath, sku, productId }) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'add_vector_exemplar.py');
    const proc = spawn('python', [
      pythonScript,
      '--image', imagePath,
      '--sku', String(sku || ''),
      '--product-id', String(productId || ''),
      '--index', VECTORS_PATH
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`[Orca Active Learning] Successfully learned new exemplar for SKU: ${sku}`);
        resolve({ ok: true, stdout });
      } else {
        resolve({ ok: false, error: stderr || stdout });
      }
    });
  });
}
