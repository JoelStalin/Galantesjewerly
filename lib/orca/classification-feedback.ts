import fs from 'node:fs';
import path from 'node:path';

export interface ImageClassificationLog {
  id: string;
  tenant_id: string;
  cluster_id: string;
  image_url: string;
  image_filename: string;
  predicted_category: string;
  predicted_tags: string[];
  confidence: number;
  model_name: string;
  timestamp: string;
  status: 'pending_review' | 'approved' | 'corrected' | 'rejected';
  admin_feedback?: {
    corrected_category?: string;
    corrected_tags?: string[];
    reviewer_notes?: string;
    reviewed_at: string;
  };
}

export function getTenantLogsFile(tenantId: string = 'galantesjewelry'): string {
  const baseDir = path.resolve(process.cwd(), `data/orca/tenants/${tenantId}/logs`);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, 'orca-classification-feedback.json');
}

export function ensureFeedbackFile(tenantId: string = 'galantesjewelry'): void {
  const feedbackFile = getTenantLogsFile(tenantId);
  if (!fs.existsSync(feedbackFile)) {
    const initialLogs: ImageClassificationLog[] = [
      {
        id: `cls-${tenantId}-1001`,
        tenant_id: tenantId,
        cluster_id: 'GAL-1001',
        image_url: '/assets/products/gold-ring.jpg',
        image_filename: 'cluster-1001-1.jpg',
        predicted_category: 'Rings',
        predicted_tags: ['18K Gold', 'Cluster Ring', 'Diamonds'],
        confidence: 0.94,
        model_name: 'hermes-agent-v1',
        timestamp: new Date().toISOString(),
        status: 'approved',
        admin_feedback: {
          corrected_category: 'Rings',
          corrected_tags: ['18K Gold', 'Cluster Ring', 'Diamonds'],
          reviewer_notes: 'Accurate classification confirmed by Galantes Admin.',
          reviewed_at: new Date().toISOString(),
        },
      },
      {
        id: `cls-${tenantId}-1002`,
        tenant_id: tenantId,
        cluster_id: 'GAL-1002',
        image_url: '/assets/products/gold-necklace.jpg',
        image_filename: 'cluster-1002-1.jpg',
        predicted_category: 'Pendants',
        predicted_tags: ['Yellow Gold', 'Chain'],
        confidence: 0.72,
        model_name: 'hermes-agent-v1',
        timestamp: new Date().toISOString(),
        status: 'corrected',
        admin_feedback: {
          corrected_category: 'Necklaces',
          corrected_tags: ['Layered Gold', '18K Gold', 'Necklace'],
          reviewer_notes: 'Reclassified from Pendant to Layered Necklace by Galantes Admin.',
          reviewed_at: new Date().toISOString(),
        },
      },
    ];
    fs.writeFileSync(feedbackFile, JSON.stringify(initialLogs, null, 2), 'utf8');
  }
}

export function getClassificationLogs(tenantId: string = 'galantesjewelry'): ImageClassificationLog[] {
  ensureFeedbackFile(tenantId);
  try {
    const feedbackFile = getTenantLogsFile(tenantId);
    const raw = fs.readFileSync(feedbackFile, 'utf8');
    const logs = JSON.parse(raw) as ImageClassificationLog[];
    return logs.filter((l) => l.tenant_id === tenantId || !l.tenant_id);
  } catch (e) {
    console.error(`Failed to read classification logs for tenant ${tenantId}:`, e);
    return [];
  }
}

export function recordClassificationLog(
  log: Omit<ImageClassificationLog, 'id' | 'timestamp' | 'status'>,
  tenantId: string = 'galantesjewelry'
): ImageClassificationLog {
  const logs = getClassificationLogs(tenantId);
  const newLog: ImageClassificationLog = {
    ...log,
    tenant_id: tenantId,
    id: `cls-${tenantId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    status: 'pending_review',
  };
  logs.unshift(newLog);
  fs.writeFileSync(getTenantLogsFile(tenantId), JSON.stringify(logs, null, 2), 'utf8');
  return newLog;
}

export function reviewClassificationLog(
  id: string,
  review: {
    status: 'approved' | 'corrected' | 'rejected';
    corrected_category?: string;
    corrected_tags?: string[];
    reviewer_notes?: string;
  },
  tenantId: string = 'galantesjewelry'
): ImageClassificationLog | null {
  const logs = getClassificationLogs(tenantId);
  const index = logs.findIndex((l) => l.id === id);
  if (index === -1) return null;

  logs[index] = {
    ...logs[index],
    status: review.status,
    admin_feedback: {
      corrected_category: review.corrected_category || logs[index].predicted_category,
      corrected_tags: review.corrected_tags || logs[index].predicted_tags,
      reviewer_notes: review.reviewer_notes || `Reviewed by ${tenantId} Administrator`,
      reviewed_at: new Date().toISOString(),
    },
  };

  fs.writeFileSync(getTenantLogsFile(tenantId), JSON.stringify(logs, null, 2), 'utf8');
  return logs[index];
}

export function generateFewShotPromptContext(tenantId: string = 'galantesjewelry'): string {
  const logs = getClassificationLogs(tenantId);
  const reviewed = logs.filter((l) => l.status === 'approved' || l.status === 'corrected');
  if (reviewed.length === 0) return '';

  const examples = reviewed.slice(0, 10).map((item) => {
    const finalCategory = item.admin_feedback?.corrected_category || item.predicted_category;
    const finalTags = item.admin_feedback?.corrected_tags || item.predicted_tags;
    return `[Tenant ${tenantId} Verified Example] Image File: ${item.image_filename} | Cluster: ${item.cluster_id} -> Category: "${finalCategory}" | Tags: [${finalTags.join(', ')}]`;
  });

  return `\n--- TENANT (${tenantId}) HUMAN-VERIFIED FEW-SHOT EXAMPLES FOR LM ACCURACY ---\n${examples.join('\n')}\n-----------------------------------------------------\n`;
}
