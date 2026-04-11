import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  addAppointmentRecord,
  buildAppointmentInterval,
  contactSubmissionSchema,
  getClientIp,
  sanitizeErrorMessage,
  updateAppointmentRecord,
} from '@/lib/appointments';
import {
  createCalendarEvent,
  getCalendarRuntimeConfig,
  isCalendarSlotAvailable,
} from '@/lib/google-calendar';
import { getMailRuntimeConfig, sendAppointmentNotification } from '@/lib/mailer';
import { resolveGoogleEnvironmentFromHost } from '@/lib/google-login';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function validationErrorResponse(error: ZodError) {
  const firstIssue = error.issues[0];
  return NextResponse.json(
    {
      error: firstIssue?.message || 'Please check the appointment form fields.',
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: 'Too many appointment requests. Please wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  let recordId = '';

  try {
    const rawBody = await request.json();
    const submission = contactSubmissionSchema.parse(rawBody);

    if (submission.honeypot) {
      return NextResponse.json({ error: 'Unable to process this request.' }, { status: 400 });
    }

    const environment = resolveGoogleEnvironmentFromHost(request.headers.get('host') || '');
    const calendarConfig = await getCalendarRuntimeConfig(environment);
    const mailConfig = await getMailRuntimeConfig(environment);
    const { start, end } = buildAppointmentInterval({
      appointmentDate: submission.appointmentDate,
      appointmentTime: submission.appointmentTime,
      timezone: calendarConfig.timezone,
      durationMinutes: calendarConfig.durationMinutes,
    });

    const record = await addAppointmentRecord({
      name: submission.name,
      email: submission.email,
      phone: submission.phone || '',
      inquiryType: submission.inquiryType,
      message: submission.message,
      appointmentDate: submission.appointmentDate,
      appointmentTime: submission.appointmentTime,
      timezone: calendarConfig.timezone,
      durationMinutes: calendarConfig.durationMinutes,
      status: 'received',
      googleEventId: '',
      googleEventLink: '',
      emailDeliveryStatus: 'not_sent',
      errorMessage: '',
      clientIp,
      userAgent: request.headers.get('user-agent') || 'unknown',
    });
    recordId = record.id;

    const isAvailable = await isCalendarSlotAvailable({ config: calendarConfig, start, end });

    if (!isAvailable) {
      await updateAppointmentRecord(record.id, {
        status: 'calendar_conflict',
        errorMessage: 'Requested calendar slot is already occupied.',
      });

      return NextResponse.json(
        { error: 'That appointment time is no longer available. Please select another time.' },
        { status: 409 },
      );
    }

    const event = await createCalendarEvent({
      config: calendarConfig,
      record,
      submission,
      start,
      end,
    });

    await updateAppointmentRecord(record.id, {
      status: 'calendar_created',
      googleEventId: event.id,
      googleEventLink: event.htmlLink,
    });

    try {
      await sendAppointmentNotification({
        config: mailConfig,
        record: {
          ...record,
          status: 'calendar_created',
          googleEventId: event.id,
          googleEventLink: event.htmlLink,
        },
        submission,
        event,
      });
    } catch (emailError) {
      const message = sanitizeErrorMessage(emailError);
      console.error('[CONTACT] Appointment email delivery failed:', message);
      await updateAppointmentRecord(record.id, {
        status: 'email_failed',
        googleEventId: event.id,
        googleEventLink: event.htmlLink,
        emailDeliveryStatus: 'failed',
        errorMessage: message,
      });

      return NextResponse.json(
        {
          error: 'The appointment was created, but the email notification failed. Our team has the request recorded.',
          appointmentId: record.id,
          googleEventLink: event.htmlLink,
        },
        { status: 502 },
      );
    }

    await updateAppointmentRecord(record.id, {
      status: 'email_sent',
      googleEventId: event.id,
      googleEventLink: event.htmlLink,
      emailDeliveryStatus: 'sent',
    });

    return NextResponse.json({
      success: true,
      appointmentId: record.id,
      message: 'Appointment request created successfully.',
      googleEventLink: event.htmlLink,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationErrorResponse(error);
    }

    const message = sanitizeErrorMessage(error);
    console.error('[CONTACT] Appointment request failed:', message);

    if (recordId) {
      await updateAppointmentRecord(recordId, {
        status: 'calendar_failed',
        emailDeliveryStatus: 'not_sent',
        errorMessage: message,
      });
    }

    return NextResponse.json(
      { error: 'We could not create the appointment. Please try again or contact the boutique directly.' },
      { status: 500 },
    );
  }
}
