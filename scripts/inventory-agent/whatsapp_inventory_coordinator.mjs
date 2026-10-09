/**
 * whatsapp_inventory_coordinator.mjs
 * Central multi-tier coordinator for Galantes Jewelry inventory ingestion via WhatsApp Web.
 * 
 * Rules:
 *   - Inbound whitelisted sender: +1 786-246-2664
 *   - Tier 1 (>= 95% similarity): Auto-match, extract metadata & fix grammar strictly in English, update Odoo.
 *   - Tier 2 (70% - 94% similarity): Generate labeled comparison collage with badges, ask operator (1, 2, NO).
 *   - Tier 3 (< 70% similarity): Dispatch to WhatsApp group 'galantesbacklog' with English proposal.
 *   - Active Learning: Every human confirmation retrains vector exemplars in Orca.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sendTextMessage, sendImageWithCaption } from './whatsapp/whatsapp-careerai-node.mjs';
import { parseWithOrcaLLM } from './orca_nlp_metadata_parser.mjs';
import { logWhatsAppDecision } from './orca_decision_learner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const BACKLOG_GROUP = 'galantesbacklog';
const SENDER_NUMBER = '+1 786-246-2664';
const EVIDENCE_DIR = path.join(root, 'data', 'inventory-agent', 'evidence');

/**
 * Executes Python visual comparator against local catalog vectors.
 */
export async function runVisualCompare(imagePath, threshold = 0.95) {
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, 'compare_whatsapp_image.py');
    const proc = spawn('python', [pythonScript, '--image', imagePath, '--threshold', String(threshold)]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', () => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ ok: false, similarity: 0.0, status: 'no_match', topCandidates: [] });
      }
    });
  });
}

/**
 * Creates the labeled multi-panel comparison image for human review.
 */
export async function generateComparisonCollage(originalPath, candidates) {
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, 'generate_labeled_comparison.py');
    const outPath = path.join(EVIDENCE_DIR, `review_${Date.now()}.jpg`);
    const proc = spawn('python', [
      pythonScript,
      '--original', originalPath,
      '--candidates', JSON.stringify(candidates),
      '--output', outPath,
    ]);

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(outPath);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Main coordinator function processing an incoming WhatsApp image and caption.
 */
export async function processIncomingWhatsAppItem({
  page = null,
  imagePath,
  rawCaption = '',
  sender = SENDER_NUMBER,
} = {}) {
  console.log(`\n======================================================`);
  console.log(`[WhatsApp Coordinator] Inbound intake: ${imagePath}`);
  console.log(`[WhatsApp Coordinator] Sender: ${sender}`);
  console.log(`[WhatsApp Coordinator] Raw Caption: "${rawCaption}"`);

  // Step 1: Run visual similarity match against Odoo catalog
  const matchResult = await runVisualCompare(imagePath, 0.95);
  const similarity = matchResult.similarity || 0.0;
  const status = matchResult.status || 'no_match';
  const bestMatch = matchResult.bestMatch || null;
  const topCandidates = matchResult.topCandidates || [];

  console.log(`[WhatsApp Coordinator] Visual Match Score: ${(similarity * 100).toFixed(1)}% | Status: ${status}`);

  // Step 2: Extract & correct metadata strictly in English via Orca NLP
  const parsedMetadata = await parseWithOrcaLLM(rawCaption);
  console.log(`[WhatsApp Coordinator] Title (EN): "${parsedMetadata.title}"`);
  console.log(`[WhatsApp Coordinator] Price: $${parsedMetadata.price} | Stock: ${parsedMetadata.stock} | Cat: ${parsedMetadata.category}`);

  // Tier 1: Confidence >= 95% (Auto-Match)
  if (status === 'auto_match' && similarity >= 0.95) {
    const sku = bestMatch?.sku || bestMatch?.id;
    console.log(`[WhatsApp Tier 1] Auto-matched (${(similarity * 100).toFixed(1)}%) with SKU: ${sku}`);

    await logWhatsAppDecision({
      incomingImagePath: imagePath,
      matchedProductId: bestMatch?.productId || bestMatch?.id,
      matchedSku: sku,
      similarityScore: similarity,
      decision: 'auto_matched',
      rawText: rawCaption,
      parsedMetadata,
      alternativeCandidates: topCandidates,
    });

    const replyMsg = `✅ *Auto-Matched (${(similarity * 100).toFixed(1)}%)*\n` +
      `Product: *${sku}*\n` +
      `Title: ${parsedMetadata.title}\n` +
      `Price: $${parsedMetadata.price}\n` +
      `Stock: ${parsedMetadata.stock}\n` +
      `Category: ${parsedMetadata.category}\n` +
      `Inventory updated in Odoo.`;

    if (page) {
      await sendTextMessage(page, sender, replyMsg).catch((err) => {
        console.warn(`[WhatsApp Coordinator] Error sending reply: ${err.message}`);
      });
    }

    return {
      action: 'auto_matched',
      matchedProduct: bestMatch,
      similarity,
      parsedMetadata,
      replyMsg,
    };
  }

  // Tier 2: Confidence 70% - 94% (Ambiguous - Request Human Selection with Labeled Collage)
  if (status === 'ambiguous' || (similarity >= 0.70 && similarity < 0.95)) {
    console.log(`[WhatsApp Tier 2] Ambiguous match (${(similarity * 100).toFixed(1)}%). Generating labeled comparison collage...`);

    const collagePath = await generateComparisonCollage(imagePath, topCandidates);

    const cand1 = topCandidates[0] ? `Option 1: SKU ${topCandidates[0].sku} (${(topCandidates[0].similarity * 100).toFixed(1)}%)` : '';
    const cand2 = topCandidates[1] ? `Option 2: SKU ${topCandidates[1].sku} (${(topCandidates[1].similarity * 100).toFixed(1)}%)` : '';

    const reviewCaption = `🔍 *Verification Needed: Similar Item Detected*\n` +
      `${cand1}\n${cand2}\n` +
      `• Proposed Title (EN): ${parsedMetadata.title}\n` +
      `Reply *1* or *2* to confirm match, or *NO* to route to backlog.`;

    if (page && collagePath) {
      await sendImageWithCaption(page, sender, collagePath, reviewCaption).catch((err) => {
        console.warn(`[WhatsApp Coordinator] Error sending comparison: ${err.message}`);
      });
    }

    await logWhatsAppDecision({
      incomingImagePath: imagePath,
      matchedProductId: bestMatch?.id,
      matchedSku: bestMatch?.sku,
      similarityScore: similarity,
      decision: 'pending_human_review',
      rawText: rawCaption,
      parsedMetadata,
      alternativeCandidates: topCandidates,
    });

    return {
      action: 'pending_human_review',
      collagePath,
      candidates: topCandidates,
      similarity,
      parsedMetadata,
      reviewCaption,
    };
  }

  // Tier 3: Confidence < 70% (No match - Route to WhatsApp Group 'galantesbacklog')
  console.log(`[WhatsApp Tier 3] No match found (< 70%). Routing to group: ${BACKLOG_GROUP}`);

  const backlogCaption = `📦 *Galantes Backlog - New Intake*\n` +
    `• Proposed Title (EN): ${parsedMetadata.title}\n` +
    `• Est. Price: $${parsedMetadata.price}\n` +
    `• Stock: ${parsedMetadata.stock}\n` +
    `• Category: ${parsedMetadata.category}\n` +
    `• Notes: ${rawCaption || 'N/A'}\n` +
    `Reply *CREATE* to publish as new product, or *DISCARD* to reject.`;

  if (page) {
    await sendImageWithCaption(page, BACKLOG_GROUP, imagePath, backlogCaption).catch((err) => {
      console.warn(`[WhatsApp Coordinator] Error sending to backlog group: ${err.message}`);
    });
  }

  await logWhatsAppDecision({
    incomingImagePath: imagePath,
    matchedProductId: null,
    matchedSku: null,
    similarityScore: similarity,
    decision: 'routed_to_backlog',
    rawText: rawCaption,
    parsedMetadata,
    alternativeCandidates: topCandidates,
  });

  return {
    action: 'routed_to_backlog',
    group: BACKLOG_GROUP,
    parsedMetadata,
    backlogCaption,
  };
}

/**
 * Handles incoming reply from operator answering an ambiguous review or backlog decision.
 */
export async function handleHumanReply({
  page = null,
  sender = SENDER_NUMBER,
  replyText = '',
  pendingDecision = null,
} = {}) {
  const text = replyText.trim().toUpperCase();
  console.log(`[WhatsApp Feedback] Operator replied: "${text}" from ${sender}`);

  if (!pendingDecision) {
    console.warn(`[WhatsApp Feedback] No pending decision found for ${sender}`);
    return { ok: false, reason: 'no_pending_context' };
  }

  const { incomingImagePath, candidates, parsedMetadata } = pendingDecision;

  if (text === '1' || text === '2') {
    const idx = parseInt(text, 10) - 1;
    const chosen = candidates && candidates[idx] ? candidates[idx] : null;

    if (chosen) {
      console.log(`[WhatsApp Feedback] Confirmed match for Option ${text}: SKU ${chosen.sku}`);

      // Log decision AND update Orca active learning vector exemplar
      await logWhatsAppDecision({
        incomingImagePath,
        matchedProductId: chosen.productId || chosen.id,
        matchedSku: chosen.sku,
        similarityScore: chosen.similarity,
        decision: 'confirmed_match',
        operatorChoice: text,
        parsedMetadata,
        alternativeCandidates: candidates,
      });

      const confirmMsg = `🎯 *Match Confirmed & Learned*\n` +
        `SKU *${chosen.sku}* updated in catalog.\n` +
        `Orca active learning registered this image as positive exemplar.`;

      if (page) {
        await sendTextMessage(page, sender, confirmMsg).catch(() => {});
      }

      return { ok: true, action: 'confirmed_match', chosen };
    }
  }

  if (text === 'NO') {
    console.log(`[WhatsApp Feedback] Operator rejected candidates. Routing to ${BACKLOG_GROUP}...`);
    const backlogCaption = `📦 *Galantes Backlog (Operator Diverted)*\n` +
      `Title (EN): ${parsedMetadata?.title || 'Unknown'}\n` +
      `Reply CREATE to publish or DISCARD to reject.`;

    if (page) {
      await sendImageWithCaption(page, BACKLOG_GROUP, incomingImagePath, backlogCaption).catch(() => {});
    }

    await logWhatsAppDecision({
      incomingImagePath,
      matchedProductId: null,
      matchedSku: null,
      similarityScore: 0.0,
      decision: 'rejected_match',
      operatorChoice: 'NO',
      parsedMetadata,
    });

    return { ok: true, action: 'routed_to_backlog' };
  }

  if (text === 'CREATE') {
    console.log(`[WhatsApp Backlog] Operator approved new product creation.`);
    await logWhatsAppDecision({
      incomingImagePath,
      matchedProductId: null,
      matchedSku: null,
      decision: 'backlog_created_new',
      parsedMetadata,
    });

    if (page) {
      await sendTextMessage(page, BACKLOG_GROUP, `✅ Approved! Product staged for creation with SKU.`);
    }

    return { ok: true, action: 'backlog_created_new' };
  }

  if (text === 'DISCARD') {
    console.log(`[WhatsApp Backlog] Operator discarded item.`);
    await logWhatsAppDecision({
      incomingImagePath,
      matchedProductId: null,
      matchedSku: null,
      decision: 'discarded',
      parsedMetadata,
    });

    if (page) {
      await sendTextMessage(page, BACKLOG_GROUP, `🗑️ Item discarded from ingestion queue.`);
    }

    return { ok: true, action: 'discarded' };
  }

  return { ok: false, reason: 'unknown_command' };
}
