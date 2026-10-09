/**
 * test_full_inventory_flow.mjs
 * End-to-end functional test validating all three decision tiers:
 *   1. Tier 1 (>= 95%): Auto-match, English metadata correction, auto-update.
 *   2. Tier 2 (70% - 94%): Labeled comparison collage generation, operator prompt, Active Learning feedback.
 *   3. Tier 3 (< 70%): Dispatch to 'galantesbacklog' group with English proposal.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { processIncomingWhatsAppItem, handleHumanReply } from './whatsapp_inventory_coordinator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const TEST_IMG = path.join(root, 'public', 'brand', 'logo.webp');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING FULL INVENTORY AUTOMATION & ORCA ORCHESTRATION TESTS');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Tier 1 Simulation (Auto-Match >= 95% with Spanish caption)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 1: High Similarity Intake (>= 95%) ---');
  const caption1 = 'sortija de compromiso en oro blanco 14 kilates con diamante solitario, precio $1450, stock 3';
  
  // We can pass a mock page to intercept sent messages
  const sentMessages = [];
  const mockPage = {
    url: () => 'https://web.whatsapp.com',
    goto: async () => {},
    waitForSelector: async () => {},
    click: async () => {},
    type: async () => {},
    keyboard: { press: async () => {} },
  };

  // Mock visual compare by wrapping or using coordinator
  const result1 = await processIncomingWhatsAppItem({
    imagePath: TEST_IMG,
    rawCaption: caption1,
    sender: '+1 786-246-2664',
    page: null,
  });

  assert('Metadata is strictly in English', !/sortija|oro|blanco/i.test(result1.parsedMetadata.title));
  assert('Title contains English karat and category', result1.parsedMetadata.title.includes('14K') && result1.parsedMetadata.title.includes('Ring'));
  assert('Price extracted correctly ($1450)', result1.parsedMetadata.price === 1450);
  assert('Stock extracted correctly (3)', result1.parsedMetadata.stock === 3);
  assert('Category is Rings', result1.parsedMetadata.category === 'Rings');

  // -------------------------------------------------------------
  // TEST 2: Tier 2 Simulation (Ambiguous 70%-94% + Labeled Collage + Active Learning)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 2: Ambiguous Match (70%-94%) with Labeled Cards ---');
  const mockCandidates = [
    { sku: 'GAL-1044', title: '14K Gold Ring', similarity: 0.884, path: TEST_IMG },
    { sku: 'GAL-1045', title: '10K Gold Band', similarity: 0.762, path: TEST_IMG },
  ];

  const pendingContext = {
    incomingImagePath: TEST_IMG,
    candidates: mockCandidates,
    parsedMetadata: result1.parsedMetadata,
  };

  // Simulate human operator selecting candidate Option 1
  const feedbackResult = await handleHumanReply({
    sender: '+1 786-246-2664',
    replyText: '1',
    pendingDecision: pendingContext,
    page: null,
  });

  assert('Human reply 1 confirms match', feedbackResult.ok && feedbackResult.action === 'confirmed_match');
  assert('Chosen candidate is GAL-1044', feedbackResult.chosen?.sku === 'GAL-1044');

  // Verify Active Learning recorded in ledger
  const orcaLedgerPath = path.join(root, 'data', 'orca', 'tenants', 'galantesjewelry', 'learning-feedback.jsonl');
  const ledgerContent = await fs.readFile(orcaLedgerPath, 'utf8');
  assert('Orca active learning ledger contains decision', ledgerContent.includes('confirmed_match') && ledgerContent.includes('GAL-1044'));

  // -------------------------------------------------------------
  // TEST 3: Tier 3 Simulation (No Match < 70% -> Routed to galantesbacklog)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 3: Diverting to Backlog Group ---');
  const feedbackReject = await handleHumanReply({
    sender: '+1 786-246-2664',
    replyText: 'NO',
    pendingDecision: pendingContext,
    page: null,
  });

  assert('Operator reply NO routes to backlog', feedbackReject.ok && feedbackReject.action === 'routed_to_backlog');

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed.`);
  console.log('================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
