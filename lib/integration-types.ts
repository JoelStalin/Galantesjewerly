export const integrationEnvironments = ['development', 'staging', 'production'] as const;

export type IntegrationEnvironment = (typeof integrationEnvironments)[number];

import type { MaskedSecretState } from '@/lib/secure-settings';

export const googleSecretFields = ['googleClientSecret', 'apiKey', 'accessToken', 'refreshToken'] as const;

export type GoogleSecretField = (typeof googleSecretFields)[number];

export const appointmentSecretFields = ['googlePrivateKey', 'gmailSmtpPassword'] as const;

export type AppointmentSecretField = (typeof appointmentSecretFields)[number];

export type GoogleIntegrationAdminConfig = {
  provider: 'google';
  environment: IntegrationEnvironment;
  enabled: boolean;
  googleClientId: string;
  javascriptOrigin: string;
  redirectUri: string;
  scopes: string[];
  secrets: Record<GoogleSecretField, MaskedSecretState>;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AppointmentIntegrationAdminConfig = {
  provider: 'appointments';
  environment: IntegrationEnvironment;
  googleCalendarEnabled: boolean;
  googleCalendarId: string;
  googleServiceAccountEmail: string;
  gmailNotificationsEnabled: boolean;
  gmailRecipientInbox: string;
  gmailSender: string;
  appointmentDurationMinutes: number;
  appointmentTimezone: string;
  secrets: Record<AppointmentSecretField, MaskedSecretState>;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type IntegrationAuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  provider: 'google' | 'appointments';
  environment: IntegrationEnvironment;
  action: 'create' | 'update' | 'test';
  changedFields: string[];
  ipAddress: string;
  userAgent: string;
};
