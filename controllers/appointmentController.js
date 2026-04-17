const sgMail = require('@sendgrid/mail');
const {
  buildAuthUrl,
  exchangeCodeAndSaveToken,
} = require('../config/googleAuth');
const {
  createAppointmentEvent,
  sanitizeEmail,
  sanitizeText,
} = require('../services/calendarService');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertRequired(value, fieldName) {
  if (!value) {
    throw createHttpError(400, `${fieldName} is required.`);
  }
}

function validateAppointmentPayload(body) {
  const payload = body || {};
  const name = sanitizeText(payload.name, 120);
  const email = sanitizeEmail(payload.email);
  const date = sanitizeText(payload.date, 10);
  const time = sanitizeText(payload.time, 5);
  const notes = sanitizeText(payload.notes || payload.message || '', 2000);
  const duration = Number(payload.duration);

  assertRequired(name, 'name');
  assertRequired(email, 'email');
  assertRequired(date, 'date');
  assertRequired(time, 'time');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createHttpError(400, 'email must be valid.');
  }

  if (!Number.isInteger(duration)) {
    throw createHttpError(400, 'duration must be an integer number of minutes.');
  }

  return {
    name,
    email,
    date,
    time,
    duration,
    notes,
    timezone: sanitizeText(payload.timezone || process.env.APPOINTMENT_TIMEZONE || 'America/New_York', 80),
  };
}

function toIcsDate(value) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildIcsAttachment(input) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Galantes Jewelry//Appointments API//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.appointmentId}@galantesjewelry.com`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(input.start)}`,
    `DTEND:${toIcsDate(input.end)}`,
    `SUMMARY:${escapeIcsText(`${input.appointmentId} - ${input.name}`)}`,
    `DESCRIPTION:${escapeIcsText(input.notes || 'Appointment request')}`,
    input.eventLink ? `URL:${input.eventLink}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Appointment reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return {
    content: Buffer.from(ics, 'utf8').toString('base64'),
    filename: 'appointment.ics',
    type: 'text/calendar',
    disposition: 'attachment',
  };
}

async function sendAppointmentEmail(payload, eventResult) {
  const apiKey = process.env.SENDGRID_API_KEY || '';
  const from = process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_SMTP_USER || '';
  const adminTo = process.env.SENDGRID_ADMIN_TO || process.env.GMAIL_NOTIFICATION_TO || '';

  if (!apiKey || !from) {
    throw createHttpError(500, 'SendGrid is not configured.');
  }

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    to: payload.email,
    bcc: adminTo ? [adminTo] : undefined,
    from,
    replyTo: adminTo || from,
    subject: process.env.SENDGRID_APPOINTMENT_SUBJECT || 'Appointment confirmation',
    text: [
      `Your appointment request was created.`,
      `Name: ${payload.name}`,
      `Date: ${payload.date}`,
      `Time: ${payload.time}`,
      `Duration: ${payload.duration} minutes`,
      `Calendar link: ${eventResult.eventLink || 'Not returned by Google Calendar'}`,
      '',
      payload.notes,
    ].join('\n'),
    attachments: [
      buildIcsAttachment({
        ...payload,
        appointmentId: eventResult.appointmentId,
        eventLink: eventResult.eventLink,
        start: eventResult.start,
        end: eventResult.end,
      }),
    ],
  });
}

async function handleCreateAppointment(request, response, next) {
  try {
    const payload = validateAppointmentPayload(request.body);
    const eventResult = await createAppointmentEvent(payload);

    await sendAppointmentEmail(payload, eventResult);

    response.status(201).json({
      success: true,
      appointmentId: eventResult.appointmentId,
      googleEventId: eventResult.eventId,
      googleEventLink: eventResult.eventLink,
      start: eventResult.startIso,
      end: eventResult.endIso,
    });
  } catch (error) {
    next(error);
  }
}

function handleGoogleAuthStart(_request, response, next) {
  try {
    response.redirect(buildAuthUrl());
  } catch (error) {
    next(error);
  }
}

async function handleGoogleAuthCallback(request, response, next) {
  try {
    const code = sanitizeText(request.query.code, 4096);

    if (!code) {
      throw createHttpError(400, 'Missing Google OAuth authorization code.');
    }

    await exchangeCodeAndSaveToken(code);
    response.status(200).send('Google Calendar authorization saved. You can close this window.');
  } catch (error) {
    next(error);
  }
}

function googleErrorMetadata(error) {
  const googleError = error.response?.data?.error || error.errors?.[0] || {};
  const reason = googleError.reason || googleError.status || error.code || '';

  if (String(reason).includes('rateLimitExceeded') || String(reason).includes('userRateLimitExceeded')) {
    return { statusCode: 429, publicMessage: 'Google Calendar rate limit exceeded. Try again later.' };
  }

  if (String(error.message || '').includes('invalid_grant')) {
    return { statusCode: 401, publicMessage: 'Google OAuth authorization expired or was revoked.' };
  }

  return {
    statusCode: error.statusCode || error.code || 500,
    publicMessage: error.publicMessage || error.message || 'Appointment request failed.',
  };
}

function globalErrorHandler(error, _request, response, _next) {
  const { statusCode, publicMessage } = googleErrorMetadata(error);
  const safeStatus = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  console.error('[appointments-api]', {
    statusCode: safeStatus,
    message: String(error.message || 'Appointment request failed.').slice(0, 300),
  });

  response.status(safeStatus).json({
    success: false,
    error: publicMessage,
  });
}

module.exports = {
  handleCreateAppointment,
  handleGoogleAuthStart,
  handleGoogleAuthCallback,
  globalErrorHandler,
};
