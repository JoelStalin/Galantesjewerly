import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { getDataRoot } from '@/lib/runtime-paths';

export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional().default(''),
  inquiryType: z.string().trim().min(2).max(80),
  message: z.string().trim().min(5).max(2000),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/),
  honeypot: z.string().optional().default(''),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

export type AppointmentStatus =
  | 'received'
  | 'calendar_conflict'
  | 'calendar_created'
  | 'email_sent'
  | 'email_failed'
  | 'calendar_failed'
  | 'validation_failed';

export type EmailDeliveryStatus = 'not_sent' | 'sent' | 'failed' | 'skipped';
export type OdooSyncStatus = 'not_attempted' | 'synced' | 'failed' | 'skipped';

export type AppointmentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  phone: string;
  inquiryType: string;
  message: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  durationMinutes: number;
  status: AppointmentStatus;
  googleEventId: string;
  googleEventLink: string;
  odooSyncStatus: OdooSyncStatus;
  odooPartnerId: string;
  odooAppointmentId: string;
  odooErrorMessage: string;
  emailDeliveryStatus: EmailDeliveryStatus;
  errorMessage: string;
  clientIp: string;
  userAgent: string;
};

type AppointmentStore = {
  records: AppointmentRecord[];
};

type AppointmentListOptions = {
  limit?: number;
  odooSyncStatus?: OdooSyncStatus;
};

const appointmentsFile = path.join(getDataRoot(), 'appointments.json');

function emptyStore(): AppointmentStore {
  return { records: [] };
}

async function readStore(): Promise<AppointmentStore> {
  try {
    const fileContent = await fs.readFile(appointmentsFile, 'utf-8');
    const parsed = JSON.parse(fileContent) as Partial<AppointmentStore>;
    return { records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: AppointmentStore) {
  await fs.mkdir(path.dirname(appointmentsFile), { recursive: true });
  await fs.writeFile(appointmentsFile, JSON.stringify(store, null, 2), 'utf-8');
}

export function createAppointmentId() {
  return `appt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function addAppointmentRecord(input: Omit<AppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const store = await readStore();
  const now = new Date().toISOString();
  const record: AppointmentRecord = {
    id: createAppointmentId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  store.records = [record, ...store.records].slice(0, 1000);
  await writeStore(store);
  return record;
}

export async function updateAppointmentRecord(id: string, updates: Partial<AppointmentRecord>) {
  const store = await readStore();
  const index = store.records.findIndex((record) => record.id === id);

  if (index === -1) {
    return null;
  }

  store.records[index] = {
    ...store.records[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.records[index];
}

export async function listAppointmentRecords(
  limitOrOptions: number | AppointmentListOptions = 100,
) {
  const store = await readStore();
  const options = typeof limitOrOptions === 'number'
    ? { limit: limitOrOptions }
    : limitOrOptions;
  const filteredRecords = options.odooSyncStatus
    ? store.records.filter((record) => record.odooSyncStatus === options.odooSyncStatus)
    : store.records;

  return filteredRecords.slice(0, options.limit ?? 100);
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim() || 'local';
}

export function sanitizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }

  return 'Unknown error';
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const valueFor = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
  const asUtc = Date.UTC(
    valueFor('year'),
    valueFor('month') - 1,
    valueFor('day'),
    valueFor('hour'),
    valueFor('minute'),
    valueFor('second'),
  );

  return asUtc - date.getTime();
}

export function buildAppointmentInterval(input: {
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  durationMinutes: number;
}) {
  const [year, month, day] = input.appointmentDate.split('-').map(Number);
  const [hour, minute] = input.appointmentTime.split(':').map(Number);

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error('Invalid appointment date or time.');
  }

  const localUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = new Date(localUtc);
  const firstOffset = getTimeZoneOffsetMs(input.timezone, firstGuess);
  const secondGuess = new Date(localUtc - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(input.timezone, secondGuess);
  const start = new Date(localUtc - secondOffset);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

  if (start.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new Error('Please select a future appointment time.');
  }

  return { start, end };
}
