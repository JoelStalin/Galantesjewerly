import nodemailer from 'nodemailer';
import { getDecryptedAppointmentIntegration } from '@/lib/integrations';
import { getGoogleOAuthRuntimeConfig, refreshGoogleOAuthAccessToken } from '@/lib/google-oauth';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import type { AppointmentRecord, ContactSubmission } from '@/lib/appointments';
import type { CreatedCalendarEvent } from '@/lib/google-calendar';

export type MailRuntimeConfig = {
  environment: IntegrationEnvironment;
  enabled: boolean;
  recipientInbox: string;
  sender: string;
  smtpPassword: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRefreshToken: string;
  oauthConnectedGoogleEmail: string;
};

export async function getMailRuntimeConfig(environment: IntegrationEnvironment): Promise<MailRuntimeConfig> {
  const stored = await getDecryptedAppointmentIntegration(environment);
  const googleOAuth = await getGoogleOAuthRuntimeConfig(environment);

  return {
    environment,
    enabled: stored.gmailNotificationsEnabled,
    recipientInbox: stored.gmailRecipientInbox || process.env.GMAIL_NOTIFICATION_TO || '',
    sender: stored.gmailSender || process.env.GMAIL_SMTP_USER || googleOAuth.connectedGoogleEmail || '',
    smtpPassword: stored.secrets.gmailSmtpPassword || process.env.GMAIL_SMTP_PASS || '',
    oauthClientId: googleOAuth.clientId,
    oauthClientSecret: googleOAuth.clientSecret,
    oauthRefreshToken: googleOAuth.refreshToken,
    oauthConnectedGoogleEmail: googleOAuth.connectedGoogleEmail,
  };
}

function hasGoogleOAuthConfig(config: MailRuntimeConfig) {
  return Boolean(config.oauthClientId && config.oauthClientSecret && config.oauthRefreshToken);
}

function assertMailConfig(config: MailRuntimeConfig) {
  const missing = [
    !config.enabled ? 'Gmail notifications are disabled' : '',
    !config.recipientInbox ? 'Gmail recipient inbox' : '',
    !config.sender ? 'Gmail sender' : '',
    !config.smtpPassword && !hasGoogleOAuthConfig(config)
      ? 'Gmail SMTP app password or connected Google OAuth account'
      : '',
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

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function encodeSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(sanitizeHeader(value), 'utf8').toString('base64')}?=`;
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sendWithGmailApi(input: {
  config: MailRuntimeConfig;
  subject: string;
  text: string;
  replyTo: string;
}) {
  assertMailConfig(input.config);
  const accessToken = await refreshGoogleOAuthAccessToken({
    environment: input.config.environment,
    clientId: input.config.oauthClientId,
    clientSecret: input.config.oauthClientSecret,
    refreshToken: input.config.oauthRefreshToken,
    accessToken: '',
    connectedGoogleEmail: input.config.oauthConnectedGoogleEmail,
  });
  const rawMessage = [
    `From: ${sanitizeHeader(input.config.sender)}`,
    `To: ${sanitizeHeader(input.config.recipientInbox)}`,
    `Reply-To: ${sanitizeHeader(input.replyTo)}`,
    `Subject: ${encodeSubject(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.text,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Url(rawMessage) }),
  });
  const payload = await response.json() as { id?: string; error?: { message?: string } };

  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || `Gmail API send failed with status ${response.status}.`);
  }

  return { messageId: payload.id };
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

  const subject = `Galantes appointment: ${input.submission.name} - ${input.submission.inquiryType}`;
  const text = buildPlainText(input);

  if (!input.config.smtpPassword && hasGoogleOAuthConfig(input.config)) {
    return sendWithGmailApi({
      config: input.config,
      subject,
      text,
      replyTo: input.submission.email,
    });
  }

  const transporter = createTransport(input.config);

  return transporter.sendMail({
    from: input.config.sender,
    to: input.config.recipientInbox,
    replyTo: input.submission.email,
    subject,
    text,
  });
}

export async function testMailConnection(environment: IntegrationEnvironment) {
  const config = await getMailRuntimeConfig(environment);

  if (getAppointmentTestMode()) {
    return {
      sender: config.sender || 'joelstalin2105@gmail.com',
      recipientInbox: config.recipientInbox || 'ceo@galantesjewelry.com',
    };
  }

  if (!config.smtpPassword && hasGoogleOAuthConfig(config)) {
    await refreshGoogleOAuthAccessToken({
      environment,
      clientId: config.oauthClientId,
      clientSecret: config.oauthClientSecret,
      refreshToken: config.oauthRefreshToken,
      accessToken: '',
      connectedGoogleEmail: config.oauthConnectedGoogleEmail,
    });

    return {
      sender: config.sender,
      recipientInbox: config.recipientInbox,
      authMode: 'google_oauth_gmail_api',
    };
  }

  const transporter = createTransport(config);

  await transporter.verify();

  return {
    sender: config.sender,
    recipientInbox: config.recipientInbox,
    authMode: 'gmail_smtp',
  };
}
