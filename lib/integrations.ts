import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getDataRoot } from '@/lib/runtime-paths';
import {
  appointmentSecretFields,
  googleSecretFields,
  integrationEnvironments,
  type AppointmentIntegrationAdminConfig,
  type AppointmentSecretField,
  type GoogleIntegrationAdminConfig,
  type GoogleSecretField,
  type IntegrationAuditEntry,
  type IntegrationEnvironment,
} from '@/lib/integration-types';
import { decryptSecret, encryptSecret, maskEncryptedSecret } from '@/lib/secure-settings';

type StoredGoogleIntegration = Omit<GoogleIntegrationAdminConfig, 'secrets'> & {
  encryptedSecrets: Partial<Record<GoogleSecretField, string>>;
};

type StoredAppointmentIntegration = Omit<AppointmentIntegrationAdminConfig, 'secrets'> & {
  encryptedSecrets: Partial<Record<AppointmentSecretField, string>>;
};

type IntegrationStore = {
  google: Record<IntegrationEnvironment, StoredGoogleIntegration>;
  appointments: Record<IntegrationEnvironment, StoredAppointmentIntegration>;
  audit: IntegrationAuditEntry[];
};

type UpdateGoogleIntegrationInput = {
  provider?: 'google';
  environment: IntegrationEnvironment;
  enabled?: boolean;
  googleClientId?: string;
  javascriptOrigin?: string;
  redirectUri?: string;
  scopes?: string[] | string;
  secrets?: Partial<Record<GoogleSecretField, string>>;
  clearSecrets?: GoogleSecretField[];
};

type StoreGoogleOAuthTokensInput = {
  environment: IntegrationEnvironment;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[] | string;
  connectedGoogleEmail?: string;
};

type UpdateAppointmentIntegrationInput = {
  provider?: 'appointments';
  environment: IntegrationEnvironment;
  googleCalendarEnabled?: boolean;
  googleCalendarId?: string;
  googleServiceAccountEmail?: string;
  gmailNotificationsEnabled?: boolean;
  gmailRecipientInbox?: string;
  gmailSender?: string;
  appointmentDurationMinutes?: number;
  appointmentTimezone?: string;
  appointmentStartTime?: string;
  appointmentEndTime?: string;
  appointmentSlotIntervalMinutes?: number;
  appointmentAvailableWeekdays?: number[];
  secrets?: Partial<Record<AppointmentSecretField, string>>;
  clearSecrets?: AppointmentSecretField[];
};

type AuditContext = {
  actor: string;
  ipAddress: string;
  userAgent: string;
};

const dataDir = getDataRoot();
const integrationsFile = path.join(dataDir, 'integrations.json');
const MINIMUM_GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '18:00';
const DEFAULT_SLOT_INTERVAL_MINUTES = 30;
const DEFAULT_AVAILABLE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_GMAIL_SENDER = 'joelstalin2105@gmail.com';
const DEFAULT_GMAIL_RECIPIENT = 'ceo@galantesjewelry.com';

const DEFAULT_GOOGLE_CONFIGS: Record<IntegrationEnvironment, StoredGoogleIntegration> = {
  development: buildDefaultGoogleConfig({
    environment: 'development',
    javascriptOrigin: 'http://localhost:3000',
    redirectUri: 'http://localhost:3000/auth/google/callback',
  }),
  staging: buildDefaultGoogleConfig({
    environment: 'staging',
    javascriptOrigin: 'https://staging.galantesjewelry.com',
    redirectUri: 'https://staging.galantesjewelry.com/auth/google/callback',
  }),
  production: buildDefaultGoogleConfig({
    environment: 'production',
    javascriptOrigin: 'https://galantesjewelry.com',
    redirectUri: 'https://galantesjewelry.com/auth/google/callback',
  }),
};

const DEFAULT_APPOINTMENT_CONFIGS: Record<IntegrationEnvironment, StoredAppointmentIntegration> = {
  development: buildDefaultAppointmentConfig('development'),
  staging: buildDefaultAppointmentConfig('staging'),
  production: buildDefaultAppointmentConfig('production'),
};

function buildDefaultGoogleConfig(input: {
  environment: IntegrationEnvironment;
  javascriptOrigin: string;
  redirectUri: string;
}): StoredGoogleIntegration {
  return {
    provider: 'google',
    environment: input.environment,
    enabled: false,
    googleClientId: '',
    javascriptOrigin: input.javascriptOrigin,
    redirectUri: input.redirectUri,
    scopes: MINIMUM_GOOGLE_SCOPES,
    connectedGoogleEmail: '',
    oauthConnectedAt: null,
    encryptedSecrets: {},
    updatedAt: null,
    updatedBy: null,
  };
}

function buildDefaultAppointmentConfig(environment: IntegrationEnvironment): StoredAppointmentIntegration {
  return {
    provider: 'appointments',
    environment,
    googleCalendarEnabled: false,
    googleCalendarId: '',
    googleServiceAccountEmail: '',
    gmailNotificationsEnabled: false,
    gmailRecipientInbox: DEFAULT_GMAIL_RECIPIENT,
    gmailSender: DEFAULT_GMAIL_SENDER,
    appointmentDurationMinutes: DEFAULT_DURATION_MINUTES,
    appointmentTimezone: DEFAULT_TIMEZONE,
    appointmentStartTime: DEFAULT_START_TIME,
    appointmentEndTime: DEFAULT_END_TIME,
    appointmentSlotIntervalMinutes: DEFAULT_SLOT_INTERVAL_MINUTES,
    appointmentAvailableWeekdays: DEFAULT_AVAILABLE_WEEKDAYS,
    encryptedSecrets: {},
    updatedAt: null,
    updatedBy: null,
  };
}

function emptyStore(): IntegrationStore {
  return {
    google: {
      development: { ...DEFAULT_GOOGLE_CONFIGS.development },
      staging: { ...DEFAULT_GOOGLE_CONFIGS.staging },
      production: { ...DEFAULT_GOOGLE_CONFIGS.production },
    },
    appointments: {
      development: { ...DEFAULT_APPOINTMENT_CONFIGS.development },
      staging: { ...DEFAULT_APPOINTMENT_CONFIGS.staging },
      production: { ...DEFAULT_APPOINTMENT_CONFIGS.production },
    },
    audit: [],
  };
}

function isIntegrationEnvironment(value: string): value is IntegrationEnvironment {
  return integrationEnvironments.includes(value as IntegrationEnvironment);
}

function assertGoogleSecretField(value: string): value is GoogleSecretField {
  return googleSecretFields.includes(value as GoogleSecretField);
}

function assertAppointmentSecretField(value: string): value is AppointmentSecretField {
  return appointmentSecretFields.includes(value as AppointmentSecretField);
}

function toAdminConfig(config: StoredGoogleIntegration): GoogleIntegrationAdminConfig {
  return {
    provider: config.provider,
    environment: config.environment,
    enabled: config.enabled,
    googleClientId: config.googleClientId,
    javascriptOrigin: config.javascriptOrigin,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    connectedGoogleEmail: config.connectedGoogleEmail || '',
    oauthConnectedAt: config.oauthConnectedAt || null,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    secrets: {
      googleClientSecret: maskEncryptedSecret(config.encryptedSecrets.googleClientSecret),
      apiKey: maskEncryptedSecret(config.encryptedSecrets.apiKey),
      accessToken: maskEncryptedSecret(config.encryptedSecrets.accessToken),
      refreshToken: maskEncryptedSecret(config.encryptedSecrets.refreshToken),
    },
  };
}

function toAppointmentAdminConfig(config: StoredAppointmentIntegration): AppointmentIntegrationAdminConfig {
  return {
    provider: config.provider,
    environment: config.environment,
    googleCalendarEnabled: config.googleCalendarEnabled,
    googleCalendarId: config.googleCalendarId,
    googleServiceAccountEmail: config.googleServiceAccountEmail,
    gmailNotificationsEnabled: config.gmailNotificationsEnabled,
    gmailRecipientInbox: config.gmailRecipientInbox,
    gmailSender: config.gmailSender,
    appointmentDurationMinutes: config.appointmentDurationMinutes,
    appointmentTimezone: config.appointmentTimezone,
    appointmentStartTime: config.appointmentStartTime,
    appointmentEndTime: config.appointmentEndTime,
    appointmentSlotIntervalMinutes: config.appointmentSlotIntervalMinutes,
    appointmentAvailableWeekdays: config.appointmentAvailableWeekdays,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    secrets: {
      googlePrivateKey: maskEncryptedSecret(config.encryptedSecrets.googlePrivateKey),
      gmailSmtpPassword: maskEncryptedSecret(config.encryptedSecrets.gmailSmtpPassword),
      sendGridApiKey: maskEncryptedSecret(config.encryptedSecrets.sendGridApiKey),
    },
  };
}

function normalizeScopeInput(value: string[] | string | undefined) {
  const rawScopes = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : MINIMUM_GOOGLE_SCOPES;

  const normalized = rawScopes
    .map((scope) => String(scope).trim())
    .filter(Boolean);

  const deduped = Array.from(new Set([...MINIMUM_GOOGLE_SCOPES, ...normalized]));
  return deduped;
}

function validateNoWildcard(value: string, label: string) {
  if (value.includes('*')) {
    throw new Error(`${label} cannot contain wildcards.`);
  }
}

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function validateHttpsUnlessLocalhost(url: URL, label: string) {
  if (url.protocol === 'https:') {
    return;
  }

  if (url.protocol === 'http:' && isLocalhost(url.hostname)) {
    return;
  }

  throw new Error(`${label} must use HTTPS except for localhost.`);
}

function validateJavaScriptOrigin(value: string) {
  validateNoWildcard(value, 'Authorized JavaScript origin');
  const url = new URL(value);
  validateHttpsUnlessLocalhost(url, 'Authorized JavaScript origin');

  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Authorized JavaScript origin must not include path, query, fragment, or userinfo.');
  }

  return url.origin;
}

function validateRedirectUri(value: string) {
  validateNoWildcard(value, 'Authorized redirect URI');
  const url = new URL(value);
  validateHttpsUnlessLocalhost(url, 'Authorized redirect URI');

  if (url.hash || url.username || url.password) {
    throw new Error('Authorized redirect URI must not include fragment or userinfo.');
  }

  if (url.pathname.includes('/../') || url.pathname.includes('\\..')) {
    throw new Error('Authorized redirect URI must not contain path traversal.');
  }

  return url.toString();
}

async function ensureStoreFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(integrationsFile);
  } catch {
    await writeStore(emptyStore());
  }
}

async function readStore(): Promise<IntegrationStore> {
  await ensureStoreFile();

  try {
    const fileContent = await fs.readFile(integrationsFile, 'utf-8');
    const parsed = JSON.parse(fileContent) as Partial<IntegrationStore>;
    const nextStore = emptyStore();

    for (const environment of integrationEnvironments) {
      nextStore.google[environment] = {
        ...nextStore.google[environment],
        ...(parsed.google?.[environment] || {}),
        provider: 'google',
        environment,
        connectedGoogleEmail: parsed.google?.[environment]?.connectedGoogleEmail || '',
        oauthConnectedAt: parsed.google?.[environment]?.oauthConnectedAt || null,
      };
    }

    for (const environment of integrationEnvironments) {
      nextStore.appointments[environment] = {
        ...nextStore.appointments[environment],
        ...(parsed.appointments?.[environment] || {}),
        provider: 'appointments',
        environment,
      };
    }

    nextStore.audit = Array.isArray(parsed.audit) ? parsed.audit.slice(0, 100) : [];
    return nextStore;
  } catch {
    const nextStore = emptyStore();
    await writeStore(nextStore);
    return nextStore;
  }
}

async function writeStore(store: IntegrationStore) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(integrationsFile, JSON.stringify(store, null, 2), 'utf-8');
}

function buildAuditEntry(
  config: StoredGoogleIntegration | StoredAppointmentIntegration,
  context: AuditContext,
  action: IntegrationAuditEntry['action'],
  changedFields: string[],
): IntegrationAuditEntry {
  return {
    id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    actor: context.actor,
    provider: config.provider,
    environment: config.environment,
    action,
    changedFields,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

export async function getGoogleIntegrationConfigs() {
  const store = await readStore();

  return {
    configs: integrationEnvironments.map((environment) => toAdminConfig(store.google[environment])),
    audit: store.audit,
  };
}

export async function getAppointmentIntegrationConfigs() {
  const store = await readStore();

  return {
    configs: integrationEnvironments.map((environment) => toAppointmentAdminConfig(store.appointments[environment])),
    audit: store.audit,
  };
}

export async function getIntegrationAdminPayload() {
  const store = await readStore();

  return {
    configs: integrationEnvironments.map((environment) => toAdminConfig(store.google[environment])),
    appointmentConfigs: integrationEnvironments.map((environment) => toAppointmentAdminConfig(store.appointments[environment])),
    audit: store.audit,
  };
}

export async function getGoogleIntegrationForEnvironment(environment: IntegrationEnvironment) {
  const store = await readStore();
  return store.google[environment];
}

export async function getDecryptedGoogleIntegration(environment: IntegrationEnvironment) {
  const config = await getGoogleIntegrationForEnvironment(environment);

  return {
    ...config,
    secrets: Object.fromEntries(
      googleSecretFields.map((field) => {
        const encryptedValue = config.encryptedSecrets[field];
        return [field, encryptedValue ? decryptSecret(encryptedValue) : ''];
      }),
    ) as Record<GoogleSecretField, string>,
  };
}

export async function getAppointmentIntegrationForEnvironment(environment: IntegrationEnvironment) {
  const store = await readStore();
  return store.appointments[environment];
}

export async function getDecryptedAppointmentIntegration(environment: IntegrationEnvironment) {
  const config = await getAppointmentIntegrationForEnvironment(environment);

  return {
    ...config,
    secrets: Object.fromEntries(
      appointmentSecretFields.map((field) => {
        const encryptedValue = config.encryptedSecrets[field];
        return [field, encryptedValue ? decryptSecret(encryptedValue) : ''];
      }),
    ) as Record<AppointmentSecretField, string>,
  };
}

export async function updateGoogleIntegrationConfig(input: UpdateGoogleIntegrationInput, context: AuditContext) {
  if (!isIntegrationEnvironment(input.environment)) {
    throw new Error('Invalid integration environment.');
  }

  const store = await readStore();
  const current = store.google[input.environment];
  const next: StoredGoogleIntegration = {
    ...current,
    encryptedSecrets: { ...current.encryptedSecrets },
  };
  const changedFields = new Set<string>();

  if (typeof input.enabled === 'boolean' && input.enabled !== current.enabled) {
    next.enabled = input.enabled;
    changedFields.add('enabled');
  }

  if (typeof input.googleClientId === 'string' && input.googleClientId.trim() !== current.googleClientId) {
    next.googleClientId = input.googleClientId.trim();
    changedFields.add('googleClientId');
  }

  if (typeof input.javascriptOrigin === 'string') {
    const normalizedOrigin = validateJavaScriptOrigin(input.javascriptOrigin.trim());
    if (normalizedOrigin !== current.javascriptOrigin) {
      next.javascriptOrigin = normalizedOrigin;
      changedFields.add('javascriptOrigin');
    }
  }

  if (typeof input.redirectUri === 'string') {
    const normalizedRedirectUri = validateRedirectUri(input.redirectUri.trim());
    if (normalizedRedirectUri !== current.redirectUri) {
      next.redirectUri = normalizedRedirectUri;
      changedFields.add('redirectUri');
    }
  }

  if (input.scopes !== undefined) {
    const scopes = normalizeScopeInput(input.scopes);
    if (JSON.stringify(scopes) !== JSON.stringify(current.scopes)) {
      next.scopes = scopes;
      changedFields.add('scopes');
    }
  }

  for (const field of input.clearSecrets || []) {
    if (!assertGoogleSecretField(field)) {
      continue;
    }

    if (next.encryptedSecrets[field]) {
      delete next.encryptedSecrets[field];
      changedFields.add(field);
    }
  }

  for (const [field, value] of Object.entries(input.secrets || {})) {
    if (!assertGoogleSecretField(field)) {
      continue;
    }

    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) {
      continue;
    }

    next.encryptedSecrets[field] = encryptSecret(trimmedValue);
    changedFields.add(field);
  }

  if (changedFields.size > 0) {
    next.updatedAt = new Date().toISOString();
    next.updatedBy = context.actor;
    store.google[input.environment] = next;
    store.audit = [
      buildAuditEntry(next, context, current.updatedAt ? 'update' : 'create', [...changedFields]),
      ...store.audit,
    ].slice(0, 100);
    await writeStore(store);
  }

  return {
    config: toAdminConfig(next),
    changedFields: [...changedFields],
    audit: store.audit,
  };
}

export async function storeGoogleOAuthTokens(input: StoreGoogleOAuthTokensInput, context: AuditContext) {
  if (!isIntegrationEnvironment(input.environment)) {
    throw new Error('Invalid integration environment.');
  }

  const store = await readStore();
  const current = store.google[input.environment];
  const next: StoredGoogleIntegration = {
    ...current,
    encryptedSecrets: { ...current.encryptedSecrets },
  };
  const changedFields = new Set<string>();

  if (input.accessToken) {
    next.encryptedSecrets.accessToken = encryptSecret(input.accessToken);
    changedFields.add('accessToken');
  }

  if (input.refreshToken) {
    next.encryptedSecrets.refreshToken = encryptSecret(input.refreshToken);
    changedFields.add('refreshToken');
  }

  if (input.scopes !== undefined) {
    const scopes = normalizeScopeInput(input.scopes);
    if (JSON.stringify(scopes) !== JSON.stringify(current.scopes)) {
      next.scopes = scopes;
      changedFields.add('scopes');
    }
  }

  if (input.connectedGoogleEmail !== undefined && input.connectedGoogleEmail !== current.connectedGoogleEmail) {
    next.connectedGoogleEmail = normalizeEmail(input.connectedGoogleEmail);
    changedFields.add('connectedGoogleEmail');
  }

  next.oauthConnectedAt = new Date().toISOString();
  changedFields.add('oauthConnectedAt');
  next.enabled = true;
  changedFields.add('enabled');
  next.updatedAt = new Date().toISOString();
  next.updatedBy = context.actor;
  store.google[input.environment] = next;
  store.audit = [
    buildAuditEntry(next, context, current.updatedAt ? 'update' : 'create', [...changedFields]),
    ...store.audit,
  ].slice(0, 100);
  await writeStore(store);

  return {
    config: toAdminConfig(next),
    changedFields: [...changedFields],
    audit: store.audit,
  };
}

function normalizeEmail(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeOptionalText(value?: string) {
  return String(value || '').trim();
}

function normalizeDuration(value?: number) {
  const duration = Number(value);

  if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
    throw new Error('Appointment duration must be between 15 and 240 minutes.');
  }

  return Math.round(duration);
}

function validateTimeString(value?: string, label = 'Appointment time') {
  const normalized = normalizeOptionalText(value);

  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new Error(`${label} must use HH:MM format.`);
  }

  const [hours, minutes] = normalized.split(':').map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`${label} is invalid.`);
  }

  return normalized;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function validateSlotInterval(value?: number) {
  const interval = Number(value);

  if (!Number.isFinite(interval) || interval < 15 || interval > 240) {
    throw new Error('Appointment slot interval must be between 15 and 240 minutes.');
  }

  return Math.round(interval);
}

function validateAvailableWeekdays(value?: number[]) {
  const normalized = Array.isArray(value)
    ? Array.from(new Set(value.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    : DEFAULT_AVAILABLE_WEEKDAYS;

  if (normalized.length === 0) {
    throw new Error('At least one appointment weekday must be enabled.');
  }

  return normalized.sort((left, right) => left - right);
}

function validateTimeZone(value?: string) {
  const timezone = normalizeOptionalText(value) || DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new Error('Appointment timezone is invalid.');
  }
}

export async function updateAppointmentIntegrationConfig(input: UpdateAppointmentIntegrationInput, context: AuditContext) {
  if (!isIntegrationEnvironment(input.environment)) {
    throw new Error('Invalid integration environment.');
  }

  const store = await readStore();
  const current = store.appointments[input.environment];
  const next: StoredAppointmentIntegration = {
    ...current,
    encryptedSecrets: { ...current.encryptedSecrets },
  };
  const changedFields = new Set<string>();

  if (typeof input.googleCalendarEnabled === 'boolean' && input.googleCalendarEnabled !== current.googleCalendarEnabled) {
    next.googleCalendarEnabled = input.googleCalendarEnabled;
    changedFields.add('googleCalendarEnabled');
  }

  if (typeof input.gmailNotificationsEnabled === 'boolean' && input.gmailNotificationsEnabled !== current.gmailNotificationsEnabled) {
    next.gmailNotificationsEnabled = input.gmailNotificationsEnabled;
    changedFields.add('gmailNotificationsEnabled');
  }

  const textFields = [
    ['googleCalendarId', normalizeOptionalText(input.googleCalendarId)],
    ['googleServiceAccountEmail', normalizeEmail(input.googleServiceAccountEmail)],
    ['gmailRecipientInbox', normalizeEmail(input.gmailRecipientInbox)],
    ['gmailSender', normalizeEmail(input.gmailSender)],
  ] as const;

  for (const [field, value] of textFields) {
    if (input[field] === undefined) {
      continue;
    }

    if (value !== current[field]) {
      next[field] = value;
      changedFields.add(field);
    }
  }

  if (input.appointmentDurationMinutes !== undefined) {
    const duration = normalizeDuration(input.appointmentDurationMinutes);
    if (duration !== current.appointmentDurationMinutes) {
      next.appointmentDurationMinutes = duration;
      changedFields.add('appointmentDurationMinutes');
    }
  }

  if (input.appointmentTimezone !== undefined) {
    const timezone = validateTimeZone(input.appointmentTimezone);
    if (timezone !== current.appointmentTimezone) {
      next.appointmentTimezone = timezone;
      changedFields.add('appointmentTimezone');
    }
  }

  if (input.appointmentStartTime !== undefined) {
    const startTime = validateTimeString(input.appointmentStartTime, 'Appointment start time');
    if (startTime !== current.appointmentStartTime) {
      next.appointmentStartTime = startTime;
      changedFields.add('appointmentStartTime');
    }
  }

  if (input.appointmentEndTime !== undefined) {
    const endTime = validateTimeString(input.appointmentEndTime, 'Appointment end time');
    if (endTime !== current.appointmentEndTime) {
      next.appointmentEndTime = endTime;
      changedFields.add('appointmentEndTime');
    }
  }

  if (input.appointmentSlotIntervalMinutes !== undefined) {
    const interval = validateSlotInterval(input.appointmentSlotIntervalMinutes);
    if (interval !== current.appointmentSlotIntervalMinutes) {
      next.appointmentSlotIntervalMinutes = interval;
      changedFields.add('appointmentSlotIntervalMinutes');
    }
  }

  if (input.appointmentAvailableWeekdays !== undefined) {
    const weekdays = validateAvailableWeekdays(input.appointmentAvailableWeekdays);
    if (JSON.stringify(weekdays) !== JSON.stringify(current.appointmentAvailableWeekdays)) {
      next.appointmentAvailableWeekdays = weekdays;
      changedFields.add('appointmentAvailableWeekdays');
    }
  }

  const effectiveStartTime = input.appointmentStartTime !== undefined
    ? next.appointmentStartTime
    : current.appointmentStartTime;
  const effectiveEndTime = input.appointmentEndTime !== undefined
    ? next.appointmentEndTime
    : current.appointmentEndTime;
  const effectiveDuration = input.appointmentDurationMinutes !== undefined
    ? next.appointmentDurationMinutes
    : current.appointmentDurationMinutes;
  const effectiveInterval = input.appointmentSlotIntervalMinutes !== undefined
    ? next.appointmentSlotIntervalMinutes
    : current.appointmentSlotIntervalMinutes;

  if (timeToMinutes(effectiveStartTime) >= timeToMinutes(effectiveEndTime)) {
    throw new Error('Appointment end time must be later than the start time.');
  }

  if (timeToMinutes(effectiveStartTime) + effectiveDuration > timeToMinutes(effectiveEndTime)) {
    throw new Error('Appointment duration does not fit inside the configured booking window.');
  }

  if (effectiveInterval > effectiveDuration) {
    throw new Error('Appointment slot interval cannot be longer than the appointment duration.');
  }

  for (const field of input.clearSecrets || []) {
    if (!assertAppointmentSecretField(field)) {
      continue;
    }

    if (next.encryptedSecrets[field]) {
      delete next.encryptedSecrets[field];
      changedFields.add(field);
    }
  }

  for (const [field, value] of Object.entries(input.secrets || {})) {
    if (!assertAppointmentSecretField(field)) {
      continue;
    }

    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) {
      continue;
    }

    next.encryptedSecrets[field] = encryptSecret(trimmedValue);
    changedFields.add(field);
  }

  if (changedFields.size > 0) {
    next.updatedAt = new Date().toISOString();
    next.updatedBy = context.actor;
    store.appointments[input.environment] = next;
    store.audit = [
      buildAuditEntry(next, context, current.updatedAt ? 'update' : 'create', [...changedFields]),
      ...store.audit,
    ].slice(0, 100);
    await writeStore(store);
  }

  return {
    config: toAppointmentAdminConfig(next),
    changedFields: [...changedFields],
    audit: store.audit,
  };
}

export async function recordGoogleIntegrationTest(environment: IntegrationEnvironment, context: AuditContext) {
  if (!isIntegrationEnvironment(environment)) {
    throw new Error('Invalid integration environment.');
  }

  const store = await readStore();
  const config = store.google[environment];
  const auditEntry = buildAuditEntry(config, context, 'test', ['connectionTest']);
  store.audit = [auditEntry, ...store.audit].slice(0, 100);
  await writeStore(store);
  return auditEntry;
}

export async function recordAppointmentIntegrationTest(environment: IntegrationEnvironment, context: AuditContext) {
  if (!isIntegrationEnvironment(environment)) {
    throw new Error('Invalid integration environment.');
  }

  const store = await readStore();
  const config = store.appointments[environment];
  const auditEntry = buildAuditEntry(config, context, 'test', ['appointmentIntegrationTest']);
  store.audit = [auditEntry, ...store.audit].slice(0, 100);
  await writeStore(store);
  return auditEntry;
}
