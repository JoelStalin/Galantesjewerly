import { describe, it, expect } from 'vitest';
import {
  getClassificationLogs,
  recordClassificationLog,
  reviewClassificationLog,
  generateFewShotPromptContext,
  evaluateStockReorderStrategy,
} from '../../lib/orca/classification-feedback';

describe('Orca Classification Logs & LM Few-Shot Feedback Suite', () => {
  it('Should record a new image classification log in pending_review status', () => {
    const log = recordClassificationLog({
      cluster_id: 'GAL-9999',
      image_url: '/assets/products/gold-ring.jpg',
      image_filename: 'cluster-9999-1.jpg',
      predicted_category: 'Rings',
      predicted_tags: ['Gold', 'Band'],
      confidence: 0.88,
      model_name: 'test-model',
    });

    expect(log.id).toBeDefined();
    expect(log.status).toBe('pending_review');
    expect(log.cluster_id).toBe('GAL-9999');
  });

  it('Should record admin feedback and update log status to corrected', () => {
    const logs = getClassificationLogs();
    expect(logs.length).toBeGreaterThan(0);
    const targetId = logs[0].id;

    const updated = reviewClassificationLog(targetId, {
      status: 'corrected',
      corrected_category: 'High Jewelry Rings',
      corrected_tags: ['18K Gold', 'Diamond Cluster'],
      reviewer_notes: 'Corrected category for precise listing.',
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('corrected');
    expect(updated?.admin_feedback?.corrected_category).toBe('High Jewelry Rings');
  });

  it('Should generate structured few-shot prompt context from reviewed examples', () => {
    const context = generateFewShotPromptContext();
    expect(context).toContain('HUMAN-VERIFIED FEW-SHOT EXAMPLES FOR LM ACCURACY');
    expect(context).toContain('Category:');
  });

  it('Should evaluate high-value vs low-value reorder strategy based on video workflow rules', () => {
    // High-value item ($1650 > $500 threshold) with low stock (2 <= 5) -> HUMAN_APPROVAL_REQUIRED
    const highValEval = evaluateStockReorderStrategy({
      product_id: 'GAL-1093',
      product_name: 'Gold Cluster Ring',
      current_stock: 2,
      min_threshold: 5,
      unit_price: 1650.00,
    });

    expect(highValEval.strategy).toBe('HUMAN_APPROVAL_REQUIRED');
    expect(highValEval.is_high_value).toBe(true);

    // Low-value item ($45 < $500 threshold) with low stock (1 <= 5) -> AUTOMATIC_REORDER_DRAFT
    const lowValEval = evaluateStockReorderStrategy({
      product_id: 'GAL-2001',
      product_name: 'Silver Cleaning Cloth',
      current_stock: 1,
      min_threshold: 5,
      unit_price: 45.00,
    });

    expect(lowValEval.strategy).toBe('AUTOMATIC_REORDER_DRAFT');
    expect(lowValEval.is_high_value).toBe(false);

    // Item with sufficient stock (10 > 5) -> NO_ACTION
    const normalStockEval = evaluateStockReorderStrategy({
      product_id: 'GAL-3001',
      product_name: 'Gold Pave Ring',
      current_stock: 10,
      min_threshold: 5,
      unit_price: 1200.00,
    });

    expect(normalStockEval.strategy).toBe('NO_ACTION');
    expect(normalStockEval.is_low_stock).toBe(false);
  });
});
