export const appointmentMockModes = [
  'success',
  'conflict',
  'calendar_error',
  'mail_error',
  'odoo_error',
] as const;

export type AppointmentTestMode = (typeof appointmentMockModes)[number] | '';

const falseLikeModes = new Set(['', '0', 'false', 'off', 'no', 'disabled']);
const truthySuccessModes = new Set(['1', 'true', 'on', 'enabled']);

export function getAppointmentTestMode(): AppointmentTestMode {
  const rawValue = (process.env.APPOINTMENT_TEST_MODE || '').trim().toLowerCase();

  if (falseLikeModes.has(rawValue)) {
    return '';
  }

  if (truthySuccessModes.has(rawValue)) {
    return 'success';
  }

  if (appointmentMockModes.includes(rawValue as Exclude<AppointmentTestMode, ''>)) {
    return rawValue as Exclude<AppointmentTestMode, ''>;
  }

  return 'success';
}

export function isAppointmentTestModeEnabled() {
  return getAppointmentTestMode() !== '';
}
