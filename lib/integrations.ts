import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getDataRoot } from '@/lib/runtime-paths';
import {
  googleSecretFields,
  integrationEnvironments,
  type GoogleIntegrationAdminConfig,
  type GoogleSecretField,
  type IntegrationAuditEntry,
  type IntegrationEnvironment,
} from '@/lib/integration-types';

type StoredGoogleIntegration = Omit<GoogleIntegrationAdminConfig, 'secrets'> & {
  encryptedSecrets: Partial<Record<GoogleSecretField, string>>;
};

type IntegrationStore = {
  google: Record<IntegrationEnvironment, StoredGoogleIntegration>;
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

type AuditContext = {
  actor: string;
  ipAddress: string;
  userAgent: string;
};

const dataDir = getDataRoot();
const integrationsFile = path.join(dataDir, 'integrations.json');
const MINIMUM_GOOGLE_SCOPES = ['openid', 'email', 'profile'];

const DEFAULT_GOOGLE_CONFIGS: Record<IntegrationEnvironment, StoredGoogleIntegration> = {
  development: buildDefaultGoogleConfig({
    environment: 'development',
    javascriptOrigin: 'http://localhost:3000',
    redirectUri: 'http://localhost:3000/api/auth/google/callback',
  }),
  staging: buildDefaultGoogleConfig({
    environment: 'staging',
    javascriptOrigin: 'https://staging.galantesjewelry.com',
    redirectUri: 'https://staging.galantesjewelry.com/api/auth/google/callback',
  }),
  production: buildDefaultGoogleConfig({
    environment: 'production',
    javascriptOrigin: 'https://galantesjewelry.com',
    redirectUri: 'https://galantesjewelry.com/api/auth/google/callback',
  }),
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
    audit: [],
  };
}

function isIntegrationEnvironment(value: string): value is IntegrationEnvironment {
  return integrationEnvironments.includes(value as IntegrationEnvironment);
}

function assertGoogleSecretField(value: string): value is GoogleSecretField {
  return googleSecretFields.includes(value as GoogleSecretField);
}

function getEncryptionKey() {
  const source =
    process.env.INTEGRATIONS_SECRET_KEY ||
    process.env.ADMIN_SECRET_KEY ||
    'local_only_integration_secret_for_development';

  return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

function decryptSecret(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(':');

  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted secret payload.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function maskSecret(encryptedValue?: string) {
  if (!encryptedValue) {
    return { isSet: false, maskedValue: '' };
  }

  try {
    const decrypted = decryptSecret(encryptedValue);
    const tail = decrypted.slice(-4);
    return {
      isSet: true,
      maskedValue: tail ? `********${tail}` : '********',
    };
  } catch {
    return {
      isSet: true,
      maskedValue: '********',
    };
  }
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
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    secrets: {
      googleClientSecret: maskSecret(config.encryptedSecrets.googleClientSecret),
      apiKey: maskSecret(config.encryptedSecrets.apiKey),
      accessToken: maskSecret(config.encryptedSecrets.accessToken),
      refreshToken: maskSecret(config.encryptedSecrets.refreshToken),
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
  config: StoredGoogleIntegration,
  context: AuditContext,
  action: IntegrationAuditEntry['action'],
  changedFields: string[],
): IntegrationAuditEntry {
  return {
    id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    actor: context.actor,
    provider: 'google',
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
