import { google, calendar_v3 } from 'googleapis';
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

function getCalendarClient(config: CalendarRuntimeConfig) {
  assertCalendarConfig(config);

  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

function getAppointmentTestMode() {
  return process.env.APPOINTMENT_TEST_MODE || '';
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

  const calendar = getCalendarClient(input.config);
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: input.start.toISOString(),
      timeMax: input.end.toISOString(),
      timeZone: input.config.timezone,
      items: [{ id: input.config.calendarId }],
    },
  });
  const busy = response.data.calendars?.[input.config.calendarId]?.busy || [];

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

  const calendar = getCalendarClient(input.config);
  const { record, submission } = input;
  const phoneLine = submission.phone ? `Phone: ${submission.phone}\n` : '';
  const event: calendar_v3.Schema$Event = {
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

  const response = await calendar.events.insert({
    calendarId: input.config.calendarId,
    requestBody: event,
    sendUpdates: 'none',
  });

  return {
    id: response.data.id || '',
    htmlLink: response.data.htmlLink || '',
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

  const calendar = getCalendarClient(config);
  const now = new Date();
  const later = new Date(now.getTime() + 15 * 60 * 1000);

  await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: later.toISOString(),
      timeZone: config.timezone,
      items: [{ id: config.calendarId }],
    },
  });

  return {
    calendarId: config.calendarId,
    timezone: config.timezone,
    durationMinutes: config.durationMinutes,
  };
}
