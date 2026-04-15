import { importPKCS8, SignJWT } from 'jose';
import { getDecryptedAppointmentIntegration } from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import type { AppointmentRecord, ContactSubmission } from '@/lib/appointments';

export type CalendarRuntimeConfig = {
  enabled: boolean;
  calendarId: string;
  serviceAccountEmail: string;
  privateKey: string;
  timezone: string;
  durationMinutes: number;
};

export type CreatedCalendarEvent = {
  id: string;
  htmlLink: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarApiError = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type FreeBusyResponse = {
  calendars?: Record<string, {
    busy?: Array<{ start?: string; end?: string }>;
  }>;
};

type CalendarEventResponse = {
  id?: string;
  htmlLink?: string;
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n').trim();
}

export async function getCalendarRuntimeConfig(environment: IntegrationEnvironment): Promise<CalendarRuntimeConfig> {
  const stored = await getDecryptedAppointmentIntegration(environment);

  return {
    enabled: stored.googleCalendarEnabled,
    calendarId: stored.googleCalendarId || process.env.GOOGLE_CALENDAR_ID || '',
    serviceAccountEmail: stored.googleServiceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: normalizePrivateKey(stored.secrets.googlePrivateKey || process.env.GOOGLE_PRIVATE_KEY || ''),
    timezone: stored.appointmentTimezone || 'America/New_York',
    durationMinutes: stored.appointmentDurationMinutes || 60,
  };
}

function assertCalendarConfig(config: CalendarRuntimeConfig) {
  const missing = [
    !config.enabled ? 'Google Calendar integration is disabled' : '',
    !config.calendarId ? 'Google Calendar ID' : '',
    !config.serviceAccountEmail ? 'Google service account email' : '',
    !config.privateKey ? 'Google private key' : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Google Calendar is not configured: ${missing.join(', ')}`);
  }
}

function getAppointmentTestMode() {
  return process.env.APPOINTMENT_TEST_MODE || '';
}

function cacheKey(config: CalendarRuntimeConfig) {
  return `${config.serviceAccountEmail}:${config.calendarId}`;
}

async function getAccessToken(config: CalendarRuntimeConfig) {
  assertCalendarConfig(config);

  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const privateKey = await importPKCS8(config.privateKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: GOOGLE_CALENDAR_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(config.serviceAccountEmail)
    .setSubject(config.serviceAccountEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const payload = await response.json() as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google Calendar token request failed.');
  }

  tokenCache.set(key, {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max((payload.expires_in || 3600) - 60, 60) * 1000,
  });

  return payload.access_token;
}

async function calendarApiRequest<T>(
  config: CalendarRuntimeConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  const accessToken = await getAccessToken(config);
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) as T & GoogleCalendarApiError : {} as T & GoogleCalendarApiError;

  if (!response.ok) {
    throw new Error(payload.error?.message || `Google Calendar API failed with status ${response.status}.`);
  }

  return payload as T;
}

export async function isCalendarSlotAvailable(input: {
  config: CalendarRuntimeConfig;
  start: Date;
  end: Date;
}) {
  const testMode = getAppointmentTestMode();

  if (testMode === 'conflict') {
    return false;
  }

  if (testMode === 'calendar_error') {
    throw new Error('Mock Google Calendar failure.');
  }

  if (testMode) {
    return true;
  }

  const response = await calendarApiRequest<FreeBusyResponse>(
    input.config,
    '/freeBusy',
    {
      method: 'POST',
      body: JSON.stringify({
        timeMin: input.start.toISOString(),
        timeMax: input.end.toISOString(),
        timeZone: input.config.timezone,
        items: [{ id: input.config.calendarId }],
      }),
    },
  );
  const busy = response.calendars?.[input.config.calendarId]?.busy || [];

  return busy.length === 0;
}

export async function createCalendarEvent(input: {
  config: CalendarRuntimeConfig;
  record: AppointmentRecord;
  submission: ContactSubmission;
  start: Date;
  end: Date;
}): Promise<CreatedCalendarEvent> {
  if (getAppointmentTestMode()) {
    return {
      id: `mock-event-${input.record.id}`,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${input.record.id}`,
    };
  }

  const { record, submission } = input;
  const phoneLine = submission.phone ? `Phone: ${submission.phone}\n` : '';
  const event = {
    summary: `${submission.name} - ${submission.inquiryType}`,
    description: [
      `Galantes Jewelry appointment request`,
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      phoneLine.trim(),
      `Inquiry type: ${submission.inquiryType}`,
      `Requested date: ${submission.appointmentDate}`,
      `Requested time: ${submission.appointmentTime}`,
      `Timezone: ${record.timezone}`,
      '',
      'Message:',
      submission.message,
    ].filter(Boolean).join('\n'),
    start: {
      dateTime: input.start.toISOString(),
      timeZone: input.config.timezone,
    },
    end: {
      dateTime: input.end.toISOString(),
      timeZone: input.config.timezone,
    },
    attendees: [{ email: submission.email, displayName: submission.name }],
    extendedProperties: {
      private: {
        galantesAppointmentId: record.id,
        inquiryType: submission.inquiryType,
        customerEmail: submission.email,
      },
    },
  };

  const calendarId = encodeURIComponent(input.config.calendarId);
  const response = await calendarApiRequest<CalendarEventResponse>(
    input.config,
    `/calendars/${calendarId}/events?sendUpdates=none`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    },
  );

  return {
    id: response.id || '',
    htmlLink: response.htmlLink || '',
  };
}

export async function testCalendarConnection(environment: IntegrationEnvironment) {
  const config = await getCalendarRuntimeConfig(environment);

  if (getAppointmentTestMode()) {
    return {
      calendarId: config.calendarId || 'mock-calendar',
      timezone: config.timezone,
      durationMinutes: config.durationMinutes,
    };
  }

  const now = new Date();
  const later = new Date(now.getTime() + 15 * 60 * 1000);

  await calendarApiRequest<FreeBusyResponse>(
    config,
    '/freeBusy',
    {
      method: 'POST',
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: later.toISOString(),
        timeZone: config.timezone,
        items: [{ id: config.calendarId }],
      }),
    },
  );

  return {
    calendarId: config.calendarId,
    timezone: config.timezone,
    durationMinutes: config.durationMinutes,
  };
}
