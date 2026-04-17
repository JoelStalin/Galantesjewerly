import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAppointmentInterval } from '@/lib/appointments';
import { listScheduleSlotsForDate } from '@/lib/appointment-schedule';
import { getCalendarRuntimeConfig, isCalendarSlotAvailable } from '@/lib/google-calendar';
import { resolveGoogleEnvironmentFromHost } from '@/lib/google-login';

export const runtime = 'nodejs';

const availabilitySchema = z.object({
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = availabilitySchema.parse({
      appointmentDate: url.searchParams.get('appointmentDate'),
      appointmentTime: url.searchParams.get('appointmentTime') || undefined,
    });
    const environment = resolveGoogleEnvironmentFromHost(request.headers.get('host') || '');
    const calendarConfig = await getCalendarRuntimeConfig(environment);

    if (payload.appointmentTime) {
      const { start, end } = buildAppointmentInterval({
        appointmentDate: payload.appointmentDate,
        appointmentTime: payload.appointmentTime,
        timezone: calendarConfig.timezone,
        durationMinutes: calendarConfig.durationMinutes,
      });
      const available = await isCalendarSlotAvailable({ config: calendarConfig, start, end });

      return NextResponse.json({
        available,
        timezone: calendarConfig.timezone,
        durationMinutes: calendarConfig.durationMinutes,
        startTime: calendarConfig.startTime,
        endTime: calendarConfig.endTime,
        slotIntervalMinutes: calendarConfig.slotIntervalMinutes,
        availableWeekdays: calendarConfig.availableWeekdays,
      });
    }

    const scheduleSlots = listScheduleSlotsForDate(payload.appointmentDate, calendarConfig);
    const availableSlots = [];

    for (const slot of scheduleSlots) {
      let start;
      let end;
      try {
        ({ start, end } = buildAppointmentInterval({
          appointmentDate: payload.appointmentDate,
          appointmentTime: slot.time,
          timezone: calendarConfig.timezone,
          durationMinutes: calendarConfig.durationMinutes,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Please select a future appointment time.') {
          continue;
        }
        throw error;
      }
      const available = await isCalendarSlotAvailable({ config: calendarConfig, start, end });

      if (available) {
        availableSlots.push(slot);
      }
    }

    return NextResponse.json({
      availableSlots,
      timezone: calendarConfig.timezone,
      durationMinutes: calendarConfig.durationMinutes,
      startTime: calendarConfig.startTime,
      endTime: calendarConfig.endTime,
      slotIntervalMinutes: calendarConfig.slotIntervalMinutes,
      availableWeekdays: calendarConfig.availableWeekdays,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not check availability.';
    const status = message.includes('not configured') || message.includes('disabled') || message.includes('incomplete')
      ? 503
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
