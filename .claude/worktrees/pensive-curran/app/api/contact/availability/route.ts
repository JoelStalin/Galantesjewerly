import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAppointmentInterval } from '@/lib/appointments';
import { getCalendarRuntimeConfig, isCalendarSlotAvailable } from '@/lib/google-calendar';
import { resolveGoogleEnvironmentFromHost } from '@/lib/google-login';

const availabilitySchema = z.object({
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = availabilitySchema.parse({
      appointmentDate: url.searchParams.get('appointmentDate'),
      appointmentTime: url.searchParams.get('appointmentTime'),
    });
    const environment = resolveGoogleEnvironmentFromHost(request.headers.get('host') || '');
    const calendarConfig = await getCalendarRuntimeConfig(environment);
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not check availability.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
