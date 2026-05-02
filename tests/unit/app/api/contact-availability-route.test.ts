/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCalendarRuntimeConfig: vi.fn(),
  isCalendarSlotAvailable: vi.fn(),
  resolveGoogleEnvironmentFromHost: vi.fn(),
  listAppointmentRecords: vi.fn(),
}));

vi.mock('@/lib/google-calendar', () => ({
  APPOINTMENT_CONFLICT_BUFFER_MINUTES: 5,
  getCalendarRuntimeConfig: mocks.getCalendarRuntimeConfig,
  isCalendarSlotAvailable: mocks.isCalendarSlotAvailable,
}));

vi.mock('@/lib/appointments', () => ({
  listAppointmentRecords: mocks.listAppointmentRecords,
  buildAppointmentInterval: vi.fn((input) => ({
    start: new Date(`${input.appointmentDate}T${input.appointmentTime}:00.000Z`),
    end: new Date(`${input.appointmentDate}T${input.appointmentTime}:00.000Z`),
  })),
}));

vi.mock('@/lib/google-login', () => ({
  resolveGoogleEnvironmentFromHost: mocks.resolveGoogleEnvironmentFromHost,
}));

describe('GET /api/contact/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveGoogleEnvironmentFromHost.mockReturnValue('production');
    mocks.getCalendarRuntimeConfig.mockResolvedValue({
      timezone: 'America/New_York',
      durationMinutes: 60,
      startTime: '10:00',
      endTime: '18:00',
      slotIntervalMinutes: 30,
      availableWeekdays: [1, 2, 4, 6],
    });
    mocks.listAppointmentRecords.mockResolvedValue([]);
  });

  it('returns schedule metadata when no date is provided', async () => {
    const { GET } = await import('@/app/api/contact/availability/route');
    const response = await GET(new Request('https://galantesjewelry.com/api/contact/availability', {
      headers: { host: 'galantesjewelry.com' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      availableSlots: [],
      timezone: 'America/New_York',
      durationMinutes: 60,
      startTime: '10:00',
      endTime: '18:00',
      slotIntervalMinutes: 30,
      availableWeekdays: [1, 2, 4, 6],
      conflictBufferMinutes: 5,
    });
    expect(mocks.isCalendarSlotAvailable).not.toHaveBeenCalled();
  });

  it('rejects a time-only request without a date', async () => {
    const { GET } = await import('@/app/api/contact/availability/route');
    const response = await GET(new Request('https://galantesjewelry.com/api/contact/availability?appointmentTime=10:00', {
      headers: { host: 'galantesjewelry.com' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'An appointment date is required when checking a specific time.',
    });
  });

  it('marks a locally booked slot as unavailable', async () => {
    mocks.listAppointmentRecords.mockResolvedValueOnce([
      {
        appointmentDate: '2026-05-04',
        appointmentTime: '09:00',
        status: 'calendar_created',
      },
    ]);

    const { GET } = await import('@/app/api/contact/availability/route');
    const response = await GET(new Request('https://galantesjewelry.com/api/contact/availability?appointmentDate=2026-05-04&appointmentTime=09:00', {
      headers: { host: 'galantesjewelry.com' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      available: false,
      conflictBufferMinutes: 5,
    });
    expect(mocks.isCalendarSlotAvailable).not.toHaveBeenCalled();
  });
});
