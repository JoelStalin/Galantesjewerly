import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  contactSubmissionSchema,
  getClientIp,
} from '@/lib/appointments';
import { processAppointmentSubmission } from '@/lib/appointment-flow';

export const runtime = 'nodejs';

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

  try {
    const rawBody = await request.json();
    const submission = contactSubmissionSchema.parse(rawBody);

    if (submission.honeypot) {
      return NextResponse.json({ error: 'Unable to process this request.' }, { status: 400 });
    }

    const result = await processAppointmentSubmission({
      submission,
      host: request.headers.get('host') || '',
      clientIp,
      userAgent: request.headers.get('user-agent') || 'unknown',
      logPrefix: 'CONTACT',
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
