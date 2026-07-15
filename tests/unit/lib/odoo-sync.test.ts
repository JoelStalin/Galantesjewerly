import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOdooAppointmentPayload, syncAppointmentToOdoo } from '@/lib/odoo-sync';
import type { AppointmentRecord, ContactSubmission } from '@/lib/appointments';

const baseRecord: AppointmentRecord = {
  id: 'appt_123',
  createdAt: '2026-04-14T10:00:00.000Z',
  updatedAt: '2026-04-14T10:00:00.000Z',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+13055550199',
  inquiryType: 'Bridal',
  message: 'Private consultation request',
  appointmentDate: '2026-04-20',
  appointmentTime: '10:00',
  timezone: 'America/New_York',
  durationMinutes: 60,
  status: 'calendar_created',
  googleEventId: 'google-event-1',
  googleEventLink: 'https://calendar.google.com/event?id=1',
  odooSyncStatus: 'not_attempted',
  odooPartnerId: '',
  odooAppointmentId: '',
  odooErrorMessage: '',
  emailDeliveryStatus: 'not_sent',
  errorMessage: '',
  clientIp: 'local',
  userAgent: 'vitest',
};

const baseSubmission: ContactSubmission = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+13055550199',
  inquiryType: 'Bridal',
  message: 'Private consultation request',
  appointmentDate: '2026-04-20',
  appointmentTime: '10:00',
  honeypot: '',
};

describe('odoo-sync', () => {
  beforeEach(() => {
    delete process.env.APPOINTMENT_TEST_MODE;
  });

  it('builds the API payload expected by the Odoo action method', () => {
    const start = new Date('2026-04-20T14:00:00.000Z');
    const end = new Date('2026-04-20T15:00:00.000Z');
    const payload = buildOdooAppointmentPayload({
      record: baseRecord,
      submission: baseSubmission,
      start,
      end,
      googleEventId: baseRecord.googleEventId,
      googleEventLink: baseRecord.googleEventLink,
      companyId: '1',
      websiteId: '2',
    });

    expect(payload.external_reference).toBe('appt_123');
    expect(payload.customer_email).toBe('jane@example.com');
    expect(payload.company_id).toBe('1');
    expect(payload.website_id).toBe('2');
    expect(payload.appointment_datetime).toBe(start.toISOString());
  });

  it('returns mocked synced ids in appointment test mode', async () => {
    process.env.APPOINTMENT_TEST_MODE = 'success';

    const result = await syncAppointmentToOdoo({
      record: baseRecord,
      submission: baseSubmission,
      start: new Date('2026-04-20T14:00:00.000Z'),
      end: new Date('2026-04-20T15:00:00.000Z'),
      googleEventId: baseRecord.googleEventId,
      googleEventLink: baseRecord.googleEventLink,
    });

    expect(result.status).toBe('synced');
    expect(result.partnerId).toContain('mock-partner-');
    expect(result.appointmentId).toContain('mock-odoo-');
  });

  it('skips sync when Odoo is disabled', async () => {
    const result = await syncAppointmentToOdoo(
      {
        record: baseRecord,
        submission: baseSubmission,
        start: new Date('2026-04-20T14:00:00.000Z'),
        end: new Date('2026-04-20T15:00:00.000Z'),
        googleEventId: baseRecord.googleEventId,
        googleEventLink: baseRecord.googleEventLink,
      },
      {
        client: {
          getConfig: () => ({
            enabled: false,
            isReady: false,
            syncOnAppointmentValidated: true,
            appointmentModel: 'galante.appointment',
          }),
          call: vi.fn(),
        },
      },
    );

    expect(result.status).toBe('skipped');
  });

  it('maps successful Odoo responses into synced ids', async () => {
    const result = await syncAppointmentToOdoo(
      {
        record: baseRecord,
        submission: baseSubmission,
        start: new Date('2026-04-20T14:00:00.000Z'),
        end: new Date('2026-04-20T15:00:00.000Z'),
        googleEventId: baseRecord.googleEventId,
        googleEventLink: baseRecord.googleEventLink,
      },
      {
        client: {
          getConfig: () => ({
            enabled: true,
            isReady: true,
            syncOnAppointmentValidated: true,
            appointmentModel: 'galante.appointment',
            companyId: '1',
            websiteId: '2',
          }),
          call: vi.fn().mockResolvedValue({
            partner_id: 77,
            appointment_id: 88,
          }),
        },
      },
    );

    expect(result).toEqual({
      status: 'synced',
      partnerId: '77',
      appointmentId: '88',
      errorMessage: '',
    });
  });

  it('returns a failed result when the Odoo request throws', async () => {
    const result = await syncAppointmentToOdoo(
      {
        record: baseRecord,
        submission: baseSubmission,
        start: new Date('2026-04-20T14:00:00.000Z'),
        end: new Date('2026-04-20T15:00:00.000Z'),
        googleEventId: baseRecord.googleEventId,
        googleEventLink: baseRecord.googleEventLink,
      },
      {
        client: {
          getConfig: () => ({
            enabled: true,
            isReady: true,
            syncOnAppointmentValidated: true,
            appointmentModel: 'galante.appointment',
          }),
          call: vi.fn().mockRejectedValue(new Error('Odoo unavailable')),
        },
      },
    );

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('Odoo unavailable');
  });
});
