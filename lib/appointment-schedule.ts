export type AppointmentScheduleConfig = {
  timezone: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  slotIntervalMinutes: number;
  availableWeekdays: number[];
};

export type AppointmentSlot = {
  time: string;
  label: string;
};

function parseTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getDateWeekday(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay();
}

export function isAllowedAppointmentDate(
  appointmentDate: string,
  config: Pick<AppointmentScheduleConfig, 'availableWeekdays'>,
) {
  return config.availableWeekdays.includes(getDateWeekday(appointmentDate));
}

export function isAllowedAppointmentTime(
  appointmentTime: string,
  config: Pick<AppointmentScheduleConfig, 'startTime' | 'endTime' | 'durationMinutes' | 'slotIntervalMinutes'>,
) {
  const startMinutes = parseTime(config.startTime);
  const endMinutes = parseTime(config.endTime);
  const appointmentMinutes = parseTime(appointmentTime);
  const lastStartMinutes = endMinutes - config.durationMinutes;

  if (appointmentMinutes < startMinutes || appointmentMinutes > lastStartMinutes) {
    return false;
  }

  return (appointmentMinutes - startMinutes) % config.slotIntervalMinutes === 0;
}

export function assertAppointmentSlotAllowed(
  appointmentDate: string,
  appointmentTime: string,
  config: AppointmentScheduleConfig,
) {
  if (!isAllowedAppointmentDate(appointmentDate, config)) {
    throw new Error('Appointments are not offered on the selected day.');
  }

  if (!isAllowedAppointmentTime(appointmentTime, config)) {
    throw new Error('The selected appointment time is outside the available schedule.');
  }
}

export function listScheduleSlotsForDate(
  appointmentDate: string,
  config: AppointmentScheduleConfig,
): AppointmentSlot[] {
  if (!isAllowedAppointmentDate(appointmentDate, config)) {
    return [];
  }

  const slots: AppointmentSlot[] = [];
  const startMinutes = parseTime(config.startTime);
  const lastStartMinutes = parseTime(config.endTime) - config.durationMinutes;

  for (let current = startMinutes; current <= lastStartMinutes; current += config.slotIntervalMinutes) {
    const time = formatTime(current);
    slots.push({
      time,
      label: new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(`2000-01-01T${time}:00`)),
    });
  }

  return slots;
}
