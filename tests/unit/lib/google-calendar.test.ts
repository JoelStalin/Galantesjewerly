/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/integrations', () => ({
  getDecryptedAppointmentIntegration: vi.fn(async () => ({
    provider: 'appointments',
    environment: 'production',
    googleCalendarEnabled: true,
    googleCalendarId: 'primary',
    googleServiceAccountEmail: 'calendar-bot@example.com',
    gmailNotificationsEnabled: false,
    gmailRecipientInbox: 'appointments@example.com',
    gmailSender: 'sender@example.com',
    appointmentDurationMinutes: 60,
    appointmentTimezone: 'America/New_York',
    appointmentStartTime: '09:00',
    appointmentEndTime: '18:00',
    appointmentSlotIntervalMinutes: 30,
    appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
    updatedAt: null,
    updatedBy: null,
    secrets: {
      googlePrivateKey: '',
      gmailSmtpPassword: '',
      sendGridApiKey: '',
    },
  })),
}));

vi.mock('@/lib/google-oauth', () => ({
  getGoogleOAuthRuntimeConfig: vi.fn(async () => ({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    connectedGoogleEmail: '',
  })),
  refreshGoogleOAuthAccessToken: vi.fn(async () => undefined),
}));

describe('Google Calendar fallback mode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('APPOINTMENT_TEST_MODE', '');
  });

  it('falls back to local availability and synthetic events when credentials are missing', async () => {
    const { getCalendarRuntimeConfig, isCalendarSlotAvailable, createCalendarEvent, testCalendarConnection } = await import('@/lib/google-calendar');

    const config = await getCalendarRuntimeConfig('production');
    const available = await isCalendarSlotAvailable({
      config,
      start: new Date(Date.now() + 60 * 60 * 1000),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const event = await createCalendarEvent({
      config,
      record: {
        id: 'appt_test_123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Test Client',
        email: 'client@example.com',
        phone: '',
        inquiryType: 'General Inquiry',
        message: 'Testing fallback',
        appointmentDate: '2026-06-01',
        appointmentTime: '10:30',
        timezone: 'America/New_York',
        durationMinutes: 60,
        status: 'received',
        googleEventId: '',
        googleEventLink: '',
        odooSyncStatus: 'not_attempted',
        odooPartnerId: '',
        odooAppointmentId: '',
        odooErrorMessage: '',
        emailDeliveryStatus: 'not_sent',
        errorMessage: '',
        clientIp: 'local',
        userAgent: 'vitest',
      },
      submission: {
        name: 'Test Client',
        email: 'client@example.com',
        phone: '',
        inquiryType: 'General Inquiry',
        message: 'Testing fallback',
        appointmentDate: '2026-06-01',
        appointmentTime: '10:30',
        honeypot: '',
      },
      start: new Date(Date.now() + 60 * 60 * 1000),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const connection = await testCalendarConnection('production');

    expect(available).toBe(true);
    expect(event.id).toMatch(/^local-event-/);
    expect(event.htmlLink).toContain('calendar.google.com/calendar/event');
    expect(connection.calendarId).toBe('primary');
    expect(connection.timezone).toBe('America/New_York');
  });
});
