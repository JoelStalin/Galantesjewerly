import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppointmentsPanel from '@/components/admin/AppointmentsPanel';
import type { AppointmentRecord } from '@/lib/appointments';

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
  status: 'email_sent',
  googleEventId: 'google-event-1',
  googleEventLink: 'https://calendar.google.com/event?id=1',
  odooSyncStatus: 'synced',
  odooPartnerId: '77',
  odooAppointmentId: '88',
  odooErrorMessage: '',
  emailDeliveryStatus: 'sent',
  errorMessage: '',
  clientIp: 'local',
  userAgent: 'vitest',
};

describe('AppointmentsPanel', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Odoo sync details from the admin API response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        records: [baseRecord],
      }),
    });

    render(<AppointmentsPanel />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('synced')).toBeInTheDocument();
    expect(screen.getByText('Appointment #88')).toBeInTheDocument();
    expect(screen.getByText('Partner #77')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/appointments?limit=150', {
      cache: 'no-store',
    });
  });

  it('requests filtered appointments when the Odoo sync filter changes', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ records: [baseRecord] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          records: [
            {
              ...baseRecord,
              id: 'appt_456',
              odooSyncStatus: 'failed',
              odooAppointmentId: '',
              odooPartnerId: '',
              odooErrorMessage: 'Invalid apikey',
            },
          ],
        }),
      });

    render(<AppointmentsPanel />);

    await screen.findByText('Jane Doe');
    fireEvent.change(screen.getByLabelText('Odoo sync'), {
      target: { value: 'failed' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/admin/appointments?limit=150&odooSyncStatus=failed',
        { cache: 'no-store' },
      );
    });

    expect(await screen.findByText('Invalid apikey')).toBeInTheDocument();
  });
});
