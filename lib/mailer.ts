import nodemailer from 'nodemailer';
import { getDecryptedAppointmentIntegration } from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import type { AppointmentRecord, ContactSubmission } from '@/lib/appointments';
import type { CreatedCalendarEvent } from '@/lib/google-calendar';

export type MailRuntimeConfig = {
  enabled: boolean;
  recipientInbox: string;
  sender: string;
  smtpPassword: string;
};

export async function getMailRuntimeConfig(environment: IntegrationEnvironment): Promise<MailRuntimeConfig> {
  const stored = await getDecryptedAppointmentIntegration(environment);

  return {
    enabled: stored.gmailNotificationsEnabled,
    recipientInbox: stored.gmailRecipientInbox || process.env.GMAIL_NOTIFICATION_TO || '',
    sender: stored.gmailSender || process.env.GMAIL_SMTP_USER || '',
    smtpPassword: stored.secrets.gmailSmtpPassword || process.env.GMAIL_SMTP_PASS || '',
  };
}

function assertMailConfig(config: MailRuntimeConfig) {
  const missing = [
    !config.enabled ? 'Gmail notifications are disabled' : '',
    !config.recipientInbox ? 'Gmail recipient inbox' : '',
    !config.sender ? 'Gmail sender' : '',
    !config.smtpPassword ? 'Gmail SMTP app password' : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Gmail notifications are not configured: ${missing.join(', ')}`);
  }
}

function createTransport(config: MailRuntimeConfig) {
  assertMailConfig(config);

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.sender,
      pass: config.smtpPassword,
    },
  });
}

function getAppointmentTestMode() {
  return process.env.APPOINTMENT_TEST_MODE || '';
}

function buildPlainText(input: {
  record: AppointmentRecord;
  submission: ContactSubmission;
  event: CreatedCalendarEvent;
}) {
  const { record, submission, event } = input;

  return [
    'New Galantes Jewelry appointment request',
    '',
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    `Phone: ${submission.phone || 'Not provided'}`,
    `Inquiry type: ${submission.inquiryType}`,
    `Date: ${submission.appointmentDate}`,
    `Time: ${submission.appointmentTime}`,
    `Timezone: ${record.timezone}`,
    `Duration: ${record.durationMinutes} minutes`,
    `Calendar event ID: ${event.id || 'Not returned'}`,
    `Calendar event link: ${event.htmlLink || 'Not returned'}`,
    '',
    'Message:',
    submission.message,
    '',
    `Local audit ID: ${record.id}`,
  ].join('\n');
}

export async function sendAppointmentNotification(input: {
  config: MailRuntimeConfig;
  record: AppointmentRecord;
  submission: ContactSubmission;
  event: CreatedCalendarEvent;
}) {
  if (getAppointmentTestMode() === 'mail_error') {
    throw new Error('Mock Gmail delivery failure.');
  }

  if (getAppointmentTestMode()) {
    return { messageId: `mock-${input.record.id}` };
  }

  const transporter = createTransport(input.config);
  const subject = `Galantes appointment: ${input.submission.name} - ${input.submission.inquiryType}`;

  return transporter.sendMail({
    from: input.config.sender,
    to: input.config.recipientInbox,
    replyTo: input.submission.email,
    subject,
    text: buildPlainText(input),
  });
}

export async function testMailConnection(environment: IntegrationEnvironment) {
  const config = await getMailRuntimeConfig(environment);

  if (getAppointmentTestMode()) {
    return {
      sender: config.sender || 'ceo@galantesjewelry.com',
      recipientInbox: config.recipientInbox || 'ceo@galantesjewelry.com',
    };
  }

  const transporter = createTransport(config);

  await transporter.verify();

  return {
    sender: config.sender,
    recipientInbox: config.recipientInbox,
  };
}
