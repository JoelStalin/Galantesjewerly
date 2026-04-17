import type { AppointmentRecord, ContactSubmission } from '@/lib/appointments';
import { createOdooClient, getOdooConfig } from '@/src/config/odooClient.js';

type OdooClientLike = {
  getConfig: () => {
    enabled: boolean;
    isReady: boolean;
    syncOnAppointmentValidated: boolean;
    appointmentModel: string;
    companyId?: string;
    websiteId?: string;
    missing?: string[];
  };
  call: (
    model: string,
    method: string,
    payload?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type OdooSyncResult = {
  status: 'synced' | 'failed' | 'skipped';
  partnerId: string;
  appointmentId: string;
  errorMessage: string;
};

function getAppointmentTestMode() {
  return process.env.APPOINTMENT_TEST_MODE || '';
}

function normalizeOptionalString(value: unknown) {
  return String(value || '').trim();
}

function normalizeIntegerString(value: unknown) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return '';
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

export function buildOdooAppointmentPayload(input: {
  record: AppointmentRecord;
  submission: ContactSubmission;
  start: Date;
  end: Date;
  googleEventId: string;
  googleEventLink: string;
  companyId?: string;
  websiteId?: string;
}) {
  return {
    external_reference: input.record.id,
    name: input.submission.name,
    email: input.submission.email,
    phone: input.submission.phone || '',
    inquiry_type: input.submission.inquiryType,
    notes: input.submission.message,
    appointment_datetime: input.start.toISOString(),
    appointment_end: input.end.toISOString(),
    duration_minutes: input.record.durationMinutes,
    timezone: input.record.timezone,
    google_event_id: input.googleEventId,
    google_event_link: input.googleEventLink,
    source: 'nextjs',
    company_id: normalizeIntegerString(input.companyId),
    website_id: normalizeIntegerString(input.websiteId),
    customer_name: input.submission.name,
    customer_email: input.submission.email,
    customer_phone: input.submission.phone || '',
    status: 'confirmed',
  };
}

export async function syncAppointmentToOdoo(
  input: {
    record: AppointmentRecord;
    submission: ContactSubmission;
    start: Date;
    end: Date;
    googleEventId: string;
    googleEventLink: string;
  },
  options: {
    client?: OdooClientLike;
    requestOptions?: Record<string, unknown>;
  } = {},
): Promise<OdooSyncResult> {
  const testMode = getAppointmentTestMode();

  if (testMode === 'odoo_error') {
    return {
      status: 'failed',
      partnerId: '',
      appointmentId: '',
      errorMessage: 'Mock Odoo sync failure.',
    };
  }

  if (testMode) {
    return {
      status: 'synced',
      partnerId: `mock-partner-${input.record.id}`,
      appointmentId: `mock-odoo-${input.record.id}`,
      errorMessage: '',
    };
  }

  const client = options.client || createOdooClient();
  const config = client.getConfig();

  if (!config.enabled) {
    return {
      status: 'skipped',
      partnerId: '',
      appointmentId: '',
      errorMessage: 'Odoo sync is disabled.',
    };
  }

  if (!config.syncOnAppointmentValidated) {
    return {
      status: 'skipped',
      partnerId: '',
      appointmentId: '',
      errorMessage: 'Odoo sync is disabled for validated appointments.',
    };
  }

  if (!config.isReady) {
    return {
      status: 'skipped',
      partnerId: '',
      appointmentId: '',
      errorMessage: `Odoo configuration is incomplete: ${(config.missing || []).join(', ')}`,
    };
  }

  try {
    const response = await client.call(
      config.appointmentModel,
      'create_from_api',
      buildOdooAppointmentPayload({
        ...input,
        companyId: config.companyId,
        websiteId: config.websiteId,
      }),
      options.requestOptions,
    ) as Record<string, unknown> | null;

    return {
      status: 'synced',
      partnerId: normalizeOptionalString(response?.partner_id),
      appointmentId: normalizeOptionalString(
        response?.appointment_id ?? response?.id,
      ),
      errorMessage: '',
    };
  } catch (error) {
    return {
      status: 'failed',
      partnerId: '',
      appointmentId: '',
      errorMessage: error instanceof Error ? error.message : 'Odoo sync failed.',
    };
  }
}

export function getOdooSyncConfig() {
  return getOdooConfig();
}
