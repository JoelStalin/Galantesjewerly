const crypto = require('node:crypto');
const { google } = require('googleapis');
const { getAuthorizedClient } = require('../config/googleAuth');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const DEFAULT_TIMEZONE = process.env.APPOINTMENT_TIMEZONE || 'America/New_York';

function sanitizeText(value, maxLength) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 180).toLowerCase();
}

function normalizeDuration(value) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
    const error = new Error('Appointment duration must be an integer between 15 and 240 minutes.');
    error.statusCode = 400;
    throw error;
  }

  return duration;
}

function getTimeZoneOffsetMs(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const valueFor = (type) => Number(parts.find((part) => part.type === type)?.value || '0');
  const utcValue = Date.UTC(
    valueFor('year'),
    valueFor('month') - 1,
    valueFor('day'),
    valueFor('hour'),
    valueFor('minute'),
    valueFor('second'),
  );

  return utcValue - date.getTime();
}

function buildDateTimeRange(input) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const timePattern = /^\d{2}:\d{2}$/;

  if (!datePattern.test(input.date) || !timePattern.test(input.time)) {
    const error = new Error('date and time must use YYYY-MM-DD and HH:mm formats.');
    error.statusCode = 400;
    throw error;
  }

  const [year, month, day] = input.date.split('-').map(Number);
  const [hour, minute] = input.time.split(':').map(Number);
  const localUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = new Date(localUtc);
  const firstOffset = getTimeZoneOffsetMs(input.timezone, firstGuess);
  const secondGuess = new Date(localUtc - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(input.timezone, secondGuess);
  const start = new Date(localUtc - secondOffset);
  const end = new Date(start.getTime() + input.duration * 60 * 1000);

  if (start.getTime() < Date.now() - 5 * 60 * 1000) {
    const error = new Error('Appointment date/time must be in the future.');
    error.statusCode = 400;
    throw error;
  }

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function getCalendarClient() {
  const auth = await getAuthorizedClient();
  return google.calendar({ version: 'v3', auth });
}

async function assertSlotAvailable(calendar, range, timezone) {
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: range.startIso,
      timeMax: range.endIso,
      timeZone: timezone,
      items: [{ id: CALENDAR_ID }],
    },
  });
  const busy = response.data.calendars?.[CALENDAR_ID]?.busy || [];

  if (busy.length > 0) {
    const error = new Error('Requested appointment slot is already occupied.');
    error.statusCode = 409;
    throw error;
  }
}

function buildEventResource(input, range) {
  const appointmentId = input.appointmentId || `appt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const name = sanitizeText(input.name, 120);
  const email = sanitizeEmail(input.email);
  const notes = sanitizeText(input.notes || input.message || '', 2000);

  return {
    appointmentId,
    requestBody: {
      summary: `${appointmentId} - ${name}`,
      description: [
        `Appointment ID: ${appointmentId}`,
        `Name: ${name}`,
        `Email: ${email}`,
        notes ? `Notes: ${notes}` : '',
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: range.startIso,
        timeZone: input.timezone,
      },
      end: {
        dateTime: range.endIso,
        timeZone: input.timezone,
      },
      attendees: [
        {
          email,
          displayName: name,
          responseStatus: 'needsAction',
        },
      ],
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 30 }],
      },
      extendedProperties: {
        private: {
          galantesAppointmentId: appointmentId,
          source: 'express-api-v1',
        },
      },
    },
  };
}

async function createAppointmentEvent(input) {
  const duration = normalizeDuration(input.duration);
  const timezone = sanitizeText(input.timezone || DEFAULT_TIMEZONE, 80) || DEFAULT_TIMEZONE;
  const range = buildDateTimeRange({
    date: sanitizeText(input.date, 10),
    time: sanitizeText(input.time, 5),
    duration,
    timezone,
  });
  const calendar = await getCalendarClient();

  await assertSlotAvailable(calendar, range, timezone);

  const eventResource = buildEventResource({
    ...input,
    duration,
    timezone,
  }, range);
  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: eventResource.requestBody,
    sendUpdates: 'all',
  });

  return {
    appointmentId: eventResource.appointmentId,
    calendarId: CALENDAR_ID,
    start: range.start,
    end: range.end,
    startIso: range.startIso,
    endIso: range.endIso,
    eventId: response.data.id || '',
    eventLink: response.data.htmlLink || '',
    event: response.data,
  };
}

module.exports = {
  CALENDAR_ID,
  DEFAULT_TIMEZONE,
  buildDateTimeRange,
  createAppointmentEvent,
  sanitizeEmail,
  sanitizeText,
};
