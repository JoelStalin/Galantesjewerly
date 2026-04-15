import {
  addAppointmentRecord,
  buildAppointmentInterval,
  sanitizeErrorMessage,
  updateAppointmentRecord,
  type ContactSubmission,
} from '@/lib/appointments';
import {
  createCalendarEvent,
  getCalendarRuntimeConfig,
  isCalendarSlotAvailable,
} from '@/lib/google-calendar';
import { resolveGoogleEnvironmentFromHost } from '@/lib/google-login';
import { getMailRuntimeConfig, sendAppointmentNotification } from '@/lib/mailer';
import { syncAppointmentToOdoo } from '@/lib/odoo-sync';

type ProcessAppointmentInput = {
  submission: ContactSubmission;
  host: string;
  clientIp: string;
  userAgent: string;
  durationMinutesOverride?: number;
  successStatusCode?: number;
  logPrefix?: string;
};

export type AppointmentFlowResponse = {
  statusCode: number;
  body: {
    success?: boolean;
    appointmentId?: string;
    message?: string;
    googleEventLink?: string;
    error?: string;
  };
};

function isClientValidationError(message: string) {
  return [
    'Invalid appointment date or time.',
    'Please select a future appointment time.',
  ].includes(message);
}

export async function processAppointmentSubmission(input: ProcessAppointmentInput): Promise<AppointmentFlowResponse> {
  let recordId = '';

  try {
    const environment = resolveGoogleEnvironmentFromHost(input.host);
    const calendarConfig = await getCalendarRuntimeConfig(environment);
    const mailConfig = await getMailRuntimeConfig(environment);
    const durationMinutes = input.durationMinutesOverride || calendarConfig.durationMinutes;
    const effectiveCalendarConfig = {
      ...calendarConfig,
      durationMinutes,
    };
    const { start, end } = buildAppointmentInterval({
      appointmentDate: input.submission.appointmentDate,
      appointmentTime: input.submission.appointmentTime,
      timezone: effectiveCalendarConfig.timezone,
      durationMinutes: effectiveCalendarConfig.durationMinutes,
    });

    const record = await addAppointmentRecord({
      name: input.submission.name,
      email: input.submission.email,
      phone: input.submission.phone || '',
      inquiryType: input.submission.inquiryType,
      message: input.submission.message,
      appointmentDate: input.submission.appointmentDate,
      appointmentTime: input.submission.appointmentTime,
      timezone: effectiveCalendarConfig.timezone,
      durationMinutes: effectiveCalendarConfig.durationMinutes,
      status: 'received',
      googleEventId: '',
      googleEventLink: '',
      emailDeliveryStatus: 'not_sent',
      errorMessage: '',
      clientIp: input.clientIp,
      userAgent: input.userAgent,
      odooSyncStatus: 'not_attempted',
      odooPartnerId: '',
      odooAppointmentId: '',
      odooErrorMessage: '',
    });
    recordId = record.id;

    const isAvailable = await isCalendarSlotAvailable({
      config: effectiveCalendarConfig,
      start,
      end,
    });

    if (!isAvailable) {
      await updateAppointmentRecord(record.id, {
        status: 'calendar_conflict',
        errorMessage: 'Requested calendar slot is already occupied.',
      });

      return {
        statusCode: 409,
        body: {
          error: 'That appointment time is no longer available. Please select another time.',
        },
      };
    }

    const event = await createCalendarEvent({
      config: effectiveCalendarConfig,
      record,
      submission: input.submission,
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
        submission: input.submission,
        event,
        start,
        end,
      });
    } catch (emailError) {
      const message = sanitizeErrorMessage(emailError);
      console.error(`[${input.logPrefix || 'APPOINTMENTS'}] Appointment email delivery failed:`, message);
      await updateAppointmentRecord(record.id, {
        status: 'email_failed',
        googleEventId: event.id,
        googleEventLink: event.htmlLink,
        emailDeliveryStatus: 'failed',
        errorMessage: message,
      });

      return {
        statusCode: 502,
        body: {
          error: 'The appointment was created, but the email notification failed. Our team has the request recorded.',
          appointmentId: record.id,
          googleEventLink: event.htmlLink,
        },
      };
    }

    await updateAppointmentRecord(record.id, {
      status: 'email_sent',
      googleEventId: event.id,
      googleEventLink: event.htmlLink,
      emailDeliveryStatus: 'sent',
    });

    const odooSync = await syncAppointmentToOdoo({
      record: { ...record, googleEventId: event.id, googleEventLink: event.htmlLink },
      submission: input.submission,
      start,
      end,
      googleEventId: event.id,
      googleEventLink: event.htmlLink,
    });

    await updateAppointmentRecord(record.id, {
      odooSyncStatus: odooSync.status,
      odooPartnerId: odooSync.partnerId,
      odooAppointmentId: odooSync.appointmentId,
      odooErrorMessage: odooSync.errorMessage,
    });

    console.log(`[${input.logPrefix || 'APPOINTMENTS'}] Odoo sync: ${odooSync.status}${odooSync.errorMessage ? ` — ${odooSync.errorMessage}` : ''}`);

    return {
      statusCode: input.successStatusCode || 200,
      body: {
        success: true,
        appointmentId: record.id,
        message: 'Appointment request created successfully.',
        googleEventLink: event.htmlLink,
        ...(odooSync.appointmentId && { odooAppointmentId: odooSync.appointmentId }),
      },
    };
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    console.error(`[${input.logPrefix || 'APPOINTMENTS'}] Appointment request failed:`, message);

    if (recordId) {
      await updateAppointmentRecord(recordId, {
        status: 'calendar_failed',
        emailDeliveryStatus: 'not_sent',
        errorMessage: message,
      });
    }

    if (isClientValidationError(message)) {
      return {
        statusCode: 400,
        body: { error: message },
      };
    }

    return {
      statusCode: 500,
      body: {
        error: 'We could not create the appointment. Please try again or contact the boutique directly.',
      },
    };
  }
}
