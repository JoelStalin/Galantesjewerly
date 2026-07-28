import { describe, it, expect, beforeEach } from 'vitest';
import {
  getClassificationLogs,
  recordClassificationLog,
  reviewClassificationLog,
  generateFewShotPromptContext,
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
});
