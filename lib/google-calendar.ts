import { google, type calendar_v3 } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import { getDecryptedAppointmentIntegration } from '@/lib/integrations';
import { getGoogleOAuthRuntimeConfig, refreshGoogleOAuthAccessToken } from '@/lib/google-oauth';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import type { AppointmentRecord, ContactSubmission } from '@/lib/appointments';

export type CalendarRuntimeConfig = {
  environment: IntegrationEnvironment;
  enabled: boolean;
  calendarId: string;
  serviceAccountEmail: string;
  privateKey: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRefreshToken: string;
  oauthConnectedGoogleEmail: string;
  timezone: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  slotIntervalMinutes: number;
  availableWeekdays: number[];
};

export type CreatedCalendarEvent = {
  id: string;
  htmlLink: string;
};

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
// Cache TTL: 45 min for OAuth (refresh tokens revoked/rotated), 4 h for JWT service accounts
const OAUTH_CACHE_TTL_MS = 45 * 60 * 1000;
const JWT_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const authClientCache = new Map<string, { client: OAuth2Client | JWT; expiresAt: number }>();

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n').trim();
}

export async function getCalendarRuntimeConfig(environment: IntegrationEnvironment): Promise<CalendarRuntimeConfig> {
  const stored = await getDecryptedAppointmentIntegration(environment);
  const googleOAuth = await getGoogleOAuthRuntimeConfig(environment);
  const isTestMode = getAppointmentTestMode() === 'true';

  return {
    environment,
    enabled: isTestMode || stored.googleCalendarEnabled,
    calendarId: stored.googleCalendarId || process.env.GOOGLE_CALENDAR_ID || 'primary',
    serviceAccountEmail: stored.googleServiceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: normalizePrivateKey(stored.secrets.googlePrivateKey || process.env.GOOGLE_PRIVATE_KEY || ''),
    oauthClientId: googleOAuth.clientId,
    oauthClientSecret: googleOAuth.clientSecret,
    oauthRefreshToken: googleOAuth.refreshToken,
    oauthConnectedGoogleEmail: googleOAuth.connectedGoogleEmail,
    timezone: stored.appointmentTimezone || 'America/New_York',
    durationMinutes: stored.appointmentDurationMinutes || 60,
    startTime: stored.appointmentStartTime || '09:00',
    endTime: stored.appointmentEndTime || '18:00',
    slotIntervalMinutes: stored.appointmentSlotIntervalMinutes || 30,
    availableWeekdays: stored.appointmentAvailableWeekdays?.length
      ? stored.appointmentAvailableWeekdays
      : [0, 1, 2, 3, 4, 5, 6],
  };
}

function hasServiceAccountConfig(config: CalendarRuntimeConfig) {
  return Boolean(config.serviceAccountEmail && config.privateKey);
}

function hasGoogleOAuthConfig(config: CalendarRuntimeConfig) {
  return Boolean(config.oauthClientId && config.oauthClientSecret && config.oauthRefreshToken);
}

function assertCalendarConfig(config: CalendarRuntimeConfig) {
  if (getAppointmentTestMode()) {
    return true;
  }

  const missing = [
    !config.enabled ? 'Google Calendar integration is disabled' : '',
    !config.calendarId ? 'Google Calendar ID' : '',
    !hasServiceAccountConfig(config) && !hasGoogleOAuthConfig(config)
      ? 'Google service account credentials or connected Google OAuth account'
      : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.warn(`[Google Calendar] Configuration is incomplete: ${missing.join(', ')}. Calendar sync will be disabled.`);
    return false;
  }
  return true;
}

function getAppointmentTestMode() {
  return process.env.APPOINTMENT_TEST_MODE || '';
}

function cacheKey(config: CalendarRuntimeConfig) {
  if (hasGoogleOAuthConfig(config)) {
    return `oauth:${config.oauthClientId}:${config.calendarId}`;
  }

  return `service:${config.serviceAccountEmail}:${config.calendarId}`;
}

async function getCalendarAuthClient(config: CalendarRuntimeConfig) {
  if (!assertCalendarConfig(config)) {
    throw new Error('Google Calendar is not configured. Please check your settings in the admin panel.');
  }

  const key = cacheKey(config);
  const cached = authClientCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  if (hasGoogleOAuthConfig(config)) {
    const oauth2Client = new OAuth2Client(config.oauthClientId, config.oauthClientSecret);
    oauth2Client.setCredentials({ refresh_token: config.oauthRefreshToken });

    // Verify token integrity before the transaction. google-auth-library refreshes expired access tokens automatically.
    try {
      await refreshGoogleOAuthAccessToken({
        environment: config.environment,
        clientId: config.oauthClientId,
        clientSecret: config.oauthClientSecret,
        refreshToken: config.oauthRefreshToken,
        accessToken: '',
        connectedGoogleEmail: config.oauthConnectedGoogleEmail,
      });
    } catch (err) {
      // Evict any stale cache entry so the next request retries fresh
      authClientCache.delete(key);
      throw err;
    }
    authClientCache.set(key, { client: oauth2Client, expiresAt: Date.now() + OAUTH_CACHE_TTL_MS });

    return oauth2Client;
  }

  const jwtClient = new JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: [GOOGLE_CALENDAR_SCOPE],
  });
  await jwtClient.authorize();
  authClientCache.set(key, { client: jwtClient, expiresAt: Date.now() + JWT_CACHE_TTL_MS });

  return jwtClient;
}

async function getCalendarClient(config: CalendarRuntimeConfig) {
  const auth = await getCalendarAuthClient(config);

  return google.calendar({
    version: 'v3',
    auth,
  });
}

function calendarApiError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Google Calendar API request failed.');
  }

  return 'Google Calendar API request failed.';
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

  try {
    const calendar = await getCalendarClient(input.config);
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
  } catch (error) {
    throw new Error(calendarApiError(error));
  }
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
  const event: calendar_v3.Schema$Event = {
    summary: `${record.id} - ${submission.name}`,
    description: [
      `Galantes Jewelry appointment request`,
      `Appointment ID: ${record.id}`,
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
    // Co-Work Mode: Include CEO and Customer
    attendees: [
      { email: 'ceo@galantesjewelry.com', displayName: 'Galantes CEO', responseStatus: 'accepted' },
      { email: submission.email, displayName: submission.name, responseStatus: 'needsAction' }
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 }
      ],
    },
    extendedProperties: {
      private: {
        galantesAppointmentId: record.id,
        inquiryType: submission.inquiryType,
        customerEmail: submission.email,
      },
    },
  };

  try {
    const calendar = await getCalendarClient(input.config);
    const response = await calendar.events.insert({
      calendarId: input.config.calendarId || 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });

    return {
      id: response.data.id || '',
      htmlLink: response.data.htmlLink || '',
    };
  } catch (error) {
    throw new Error(calendarApiError(error));
  }
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

  try {
    const calendar = await getCalendarClient(config);
    await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: later.toISOString(),
        timeZone: config.timezone,
        items: [{ id: config.calendarId }],
      },
    });
  } catch (error) {
    throw new Error(calendarApiError(error));
  }

  return {
    calendarId: config.calendarId,
    timezone: config.timezone,
    durationMinutes: config.durationMinutes,
  };
}
