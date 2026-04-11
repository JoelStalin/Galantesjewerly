export const integrationEnvironments = ['development', 'staging', 'production'] as const;

export type IntegrationEnvironment = (typeof integrationEnvironments)[number];

export const googleSecretFields = ['googleClientSecret', 'apiKey', 'accessToken', 'refreshToken'] as const;

export type GoogleSecretField = (typeof googleSecretFields)[number];

export type MaskedSecretState = {
  isSet: boolean;
  maskedValue: string;
};

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

export type IntegrationAuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  provider: 'google';
  environment: IntegrationEnvironment;
  action: 'create' | 'update' | 'test';
  changedFields: string[];
  ipAddress: string;
  userAgent: string;
};
