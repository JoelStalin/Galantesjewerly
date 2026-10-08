import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const EVIDENCE_DIR = path.join(root, 'data', 'inventory-agent', 'evidence');
const ORCA_TENANT_DIR = path.join(root, 'data', 'orca', 'tenants', 'galantesjewelry');

export async function logWhatsAppDecision({
  incomingImagePath,
  matchedProductId = null,
  similarityScore = 0.0,
  decision = 'auto_matched', // 'auto_matched' | 'confirmed_match' | 'rejected_match' | 'backlog_new_product' | 'discarded'
  rawText = '',
  parsedMetadata = null,
  operatorNotes = '',
  alternativeCandidates = []
} = {}) {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  await fs.mkdir(ORCA_TENANT_DIR, { recursive: true });

  const record = {
    timestamp: new Date().toISOString(),
    incomingImagePath,
    matchedProductId,
    similarityScore,
    decision,
    rawText,
    parsedMetadata,
    operatorNotes,
    alternativeCandidates,
  };

  const line = `${JSON.stringify(record)}\n`;

  // Write to local inventory agent evidence
  await fs.appendFile(path.join(EVIDENCE_DIR, 'whatsapp_decisions.jsonl'), line, 'utf8');

  // Also append to Orca tenant learning store so Orca local models can fine-tune / adapt KNN
  await fs.appendFile(path.join(ORCA_TENANT_DIR, 'learning-feedback.jsonl'), line, 'utf8');

  return { ok: true, record };
}
