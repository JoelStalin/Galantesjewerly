import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { openChat, sendTextMessage, sendImageWithCaption } from './whatsapp/whatsapp-sender.mjs';
import { parseAndNormalizeWhatsAppMetadata } from './gemini_whatsapp_metadata_parser.mjs';
import { logWhatsAppDecision } from './orca_decision_learner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const BACKLOG_GROUP = 'galantesbacklog';
const SENDER_NUMBER = '+1 786-246-2664';

async function runVisualCompare(imagePath, threshold = 0.95) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'compare_whatsapp_image.py');
    const isWindows = process.platform === 'win32';
    const pyCmd = isWindows ? 'py' : 'python3';
    const pyArgs = isWindows ? ['-3.12', pythonScript, '--image', imagePath, '--threshold', String(threshold)] : [pythonScript, '--image', imagePath, '--threshold', String(threshold)];
    const proc = spawn(pyCmd, pyArgs);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        resolve({ ok: false, error: stderr || stdout });
      }
    });
  });
}

/**
 * Main coordinator for an incoming WhatsApp media message.
 */
export async function processIncomingWhatsAppItem({
  page,
  imagePath,
  rawCaption = '',
  sender = SENDER_NUMBER,
} = {}) {
  console.log(`[WhatsApp Ingest] Processing image: ${imagePath} from ${sender}`);

  // Step 1: Compare image similarity against catalog
  const matchResult = await runVisualCompare(imagePath, 0.95);
  const similarity = matchResult.similarity || 0.0;
  const status = matchResult.status || 'no_match';

  console.log(`[WhatsApp Match] Status: ${status}, Score: ${similarity}`);

  // Step 2: Extract & clean metadata strictly in English
  let parsedMetadata = null;
  if (rawCaption.trim()) {
    try {
      parsedMetadata = await parseAndNormalizeWhatsAppMetadata(rawCaption);
      console.log(`[WhatsApp NLP] Parsed metadata in English:`, parsedMetadata.title);
    } catch (err) {
      console.warn(`[WhatsApp NLP] Error parsing metadata: ${err.message}`);
    }
  }

  // Step 3: Decision and Dispatch Routing
  if (status === 'auto_match' && similarity >= 0.95) {
    // 95%+ confidence: Auto-match with existing product
    console.log(`[WhatsApp Action] 95%+ Match found (${matchResult.bestMatch?.sku || matchResult.bestMatch?.id})`);
    
    await logWhatsAppDecision({
      incomingImagePath: imagePath,
      matchedProductId: matchResult.bestMatch?.productId || matchResult.bestMatch?.id,
      similarityScore: similarity,
      decision: 'auto_matched',
      rawText: rawCaption,
      parsedMetadata,
      alternativeCandidates: matchResult.topCandidates,
    });

    if (page) {
      const ackMsg = `Auto-matched (${(similarity * 100).toFixed(1)}%) with SKU: ${matchResult.bestMatch?.sku || 'Catalog Item'}. Product updated in draft catalog.`;
      await sendTextMessage(page, sender, ackMsg).catch(() => {});
    }

    return {
      action: 'auto_matched',
      matchedProduct: matchResult.bestMatch,
      similarity,
      parsedMetadata,
    };
  } else if (status === 'ambiguous') {
    // 70% - 94%: Ambiguous match, request human confirmation with labeled options
    console.log(`[WhatsApp Action] Ambiguous match (${(similarity * 100).toFixed(1)}%). Requesting human review.`);

    const promptText = `*Review Needed: Ambiguous Match*\n` +
      `Incoming Photo similarity: ${(similarity * 100).toFixed(1)}%\n` +
      `Proposed Match: ${matchResult.bestMatch?.sku || matchResult.bestMatch?.id}\n` +
      `Reply "YES" to confirm or "NO" to send to backlog.`;

    if (page) {
      await sendImageWithCaption(page, sender, imagePath, promptText).catch(() => {});
    }

    await logWhatsAppDecision({
      incomingImagePath: imagePath,
      matchedProductId: matchResult.bestMatch?.id,
      similarityScore: similarity,
      decision: 'pending_human_review',
      rawText: rawCaption,
      parsedMetadata,
      alternativeCandidates: matchResult.topCandidates,
    });

    return {
      action: 'pending_human_review',
      candidates: matchResult.topCandidates,
      similarity,
      parsedMetadata,
    };
  } else {
    // < 70%: No match, route to galantesbacklog group
    console.log(`[WhatsApp Action] No match found. Routing to group: ${BACKLOG_GROUP}`);

    const backlogCaption = `*Galantes Backlog - New Incoming Jewelry*\n` +
      `Original Caption: ${rawCaption || 'N/A'}\n` +
      (parsedMetadata ? `Title: ${parsedMetadata.title}\nEst. Price: $${parsedMetadata.price}\nCategory: ${parsedMetadata.category}\n` : '') +
      `Please reply CREATE to upload as new item or DISCARD to reject.`;

    if (page) {
      await sendImageWithCaption(page, BACKLOG_GROUP, imagePath, backlogCaption).catch(() => {});
    }

    await logWhatsAppDecision({
      incomingImagePath: imagePath,
      matchedProductId: null,
      similarityScore: similarity,
      decision: 'routed_to_backlog',
      rawText: rawCaption,
      parsedMetadata,
      alternativeCandidates: matchResult.topCandidates,
    });

    return {
      action: 'routed_to_backlog',
      group: BACKLOG_GROUP,
      parsedMetadata,
    };
  }
}
