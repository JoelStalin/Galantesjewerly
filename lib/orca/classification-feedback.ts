import fs from 'node:fs';
import path from 'node:path';

export interface ImageClassificationLog {
  id: string;
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

export interface FewShotExample {
  image_description: string;
  category: string;
  tags: string[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data/inventory-agent');
const FEEDBACK_FILE = path.join(DATA_DIR, 'orca-classification-feedback.json');

export function ensureFeedbackFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FEEDBACK_FILE)) {
    // Seed with initial realistic classification logs if file doesn't exist
    const initialLogs: ImageClassificationLog[] = [
      {
        id: 'cls-1001',
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
          reviewer_notes: 'Accurate classification confirmed.',
          reviewed_at: new Date().toISOString(),
        },
      },
      {
        id: 'cls-1002',
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
          reviewer_notes: 'Reclassified from Pendant to Layered Necklace.',
          reviewed_at: new Date().toISOString(),
        },
      },
    ];
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(initialLogs, null, 2), 'utf8');
  }
}

export function getClassificationLogs(): ImageClassificationLog[] {
  ensureFeedbackFile();
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf8');
    return JSON.parse(raw) as ImageClassificationLog[];
  } catch (e) {
    console.error('Failed to read classification logs:', e);
    return [];
  }
}

export function recordClassificationLog(log: Omit<ImageClassificationLog, 'id' | 'timestamp' | 'status'>): ImageClassificationLog {
  const logs = getClassificationLogs();
  const newLog: ImageClassificationLog = {
    ...log,
    id: `cls-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    status: 'pending_review',
  };
  logs.unshift(newLog);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(logs, null, 2), 'utf8');
  return newLog;
}

export function reviewClassificationLog(
  id: string,
  review: {
    status: 'approved' | 'corrected' | 'rejected';
    corrected_category?: string;
    corrected_tags?: string[];
    reviewer_notes?: string;
  }
): ImageClassificationLog | null {
  const logs = getClassificationLogs();
  const index = logs.findIndex((l) => l.id === id);
  if (index === -1) return null;

  logs[index] = {
    ...logs[index],
    status: review.status,
    admin_feedback: {
      corrected_category: review.corrected_category || logs[index].predicted_category,
      corrected_tags: review.corrected_tags || logs[index].predicted_tags,
      reviewer_notes: review.reviewer_notes,
      reviewed_at: new Date().toISOString(),
    },
  };

  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(logs, null, 2), 'utf8');
  return logs[index];
}

export function generateFewShotPromptContext(): string {
  const logs = getClassificationLogs();
  const reviewed = logs.filter((l) => l.status === 'approved' || l.status === 'corrected');
  if (reviewed.length === 0) return '';

  const examples = reviewed.slice(0, 10).map((item) => {
    const finalCategory = item.admin_feedback?.corrected_category || item.predicted_category;
    const finalTags = item.admin_feedback?.corrected_tags || item.predicted_tags;
    return `[Verified Example] Image File: ${item.image_filename} | Cluster: ${item.cluster_id} -> Category: "${finalCategory}" | Tags: [${finalTags.join(', ')}]`;
  });

  return `\n--- HUMAN-VERIFIED FEW-SHOT EXAMPLES FOR LM ACCURACY ---\n${examples.join('\n')}\n-----------------------------------------------------\n`;
}
