import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { getClientIp, contactSubmissionSchema } from '@/lib/appointments';
import { processAppointmentSubmission } from '@/lib/appointment-flow';

export const runtime = 'nodejs';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const appointmentPayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional().default(''),
  inquiryType: z.string().trim().min(2).max(80).optional().default('Appointment'),
  message: z.string().trim().max(2000).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().regex(/^\d{2}:\d{2}$/),
  duration: z.coerce.number().int().min(15).max(240).default(60),
});

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
    { error: firstIssue?.message || 'Please check the appointment payload.' },
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

  try {
    const payload = appointmentPayloadSchema.parse(await request.json());
    const message = payload.message || payload.notes || 'Appointment request submitted through /api/v1/appointments.';
    const submission = contactSubmissionSchema.parse({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      inquiryType: payload.inquiryType,
      message,
      appointmentDate: payload.date,
      appointmentTime: payload.time,
      honeypot: '',
    });

    const result = await processAppointmentSubmission({
      submission,
      host: request.headers.get('host') || '',
      clientIp,
      userAgent: request.headers.get('user-agent') || 'unknown',
      durationMinutesOverride: payload.duration,
      successStatusCode: 201,
      logPrefix: 'APPOINTMENTS_V1',
    });

    return NextResponse.json(result.body, { status: result.statusCode });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationErrorResponse(error);
    }

    return NextResponse.json(
      { error: 'We could not create the appointment. Please try again or contact the boutique directly.' },
      { status: 500 },
    );
  }
}
