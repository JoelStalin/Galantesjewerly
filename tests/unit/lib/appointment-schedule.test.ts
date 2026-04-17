import { describe, expect, it } from 'vitest';
import {
  assertAppointmentSlotAllowed,
  isAllowedAppointmentDate,
  isAllowedAppointmentTime,
  listScheduleSlotsForDate,
} from '@/lib/appointment-schedule';

const schedule = {
  timezone: 'America/New_York',
  durationMinutes: 60,
  startTime: '09:00',
  endTime: '17:00',
  slotIntervalMinutes: 30,
  availableWeekdays: [1, 2, 3, 4, 5],
};

describe('appointment schedule', () => {
  it('accepts dates on enabled weekdays', () => {
    expect(isAllowedAppointmentDate('2026-04-20', schedule)).toBe(true); // Monday
    expect(isAllowedAppointmentDate('2026-04-19', schedule)).toBe(false); // Sunday
  });

  it('accepts only aligned times inside the booking window', () => {
    expect(isAllowedAppointmentTime('09:00', schedule)).toBe(true);
    expect(isAllowedAppointmentTime('16:00', schedule)).toBe(true);
    expect(isAllowedAppointmentTime('16:30', schedule)).toBe(false);
    expect(isAllowedAppointmentTime('08:30', schedule)).toBe(false);
  });

  it('lists all valid slots for an enabled day', () => {
    const slots = listScheduleSlotsForDate('2026-04-20', schedule);

    expect(slots[0]?.time).toBe('09:00');
    expect(slots.at(-1)?.time).toBe('16:00');
    expect(slots).toHaveLength(15);
  });

  it('returns no slots for a disabled day', () => {
    expect(listScheduleSlotsForDate('2026-04-19', schedule)).toEqual([]);
  });

  it('throws a user-safe message for invalid weekdays or times', () => {
    expect(() => assertAppointmentSlotAllowed('2026-04-19', '10:00', schedule)).toThrow(
      'Appointments are not offered on the selected day.',
    );

    expect(() => assertAppointmentSlotAllowed('2026-04-20', '16:30', schedule)).toThrow(
      'The selected appointment time is outside the available schedule.',
    );
  });
});
