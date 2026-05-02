/**
 * @vitest-environment node
 */
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileStore = new Map<string, string>();
const dataRoot = 'C:/virtual-data';
const integrationsFilePath = path.join(dataRoot, 'integrations.json');
const loadIntegrationsSnapshotFromOdoo = vi.fn(async () => ({
  google: {
    development: {
      provider: 'google',
      environment: 'development',
      enabled: false,
      googleClientId: 'odoo-client',
      javascriptOrigin: 'http://localhost:3000',
      redirectUri: 'http://localhost:3000/auth/google/callback',
      scopes: ['openid', 'email', 'profile'],
      connectedGoogleEmail: '',
      oauthConnectedAt: null,
      encryptedSecrets: {},
      updatedAt: null,
      updatedBy: null,
    },
    staging: {
      provider: 'google',
      environment: 'staging',
      enabled: false,
      googleClientId: 'odoo-client',
      javascriptOrigin: 'https://staging.galantesjewelry.com',
      redirectUri: 'https://staging.galantesjewelry.com/auth/google/callback',
      scopes: ['openid', 'email', 'profile'],
      connectedGoogleEmail: '',
      oauthConnectedAt: null,
      encryptedSecrets: {},
      updatedAt: null,
      updatedBy: null,
    },
    production: {
      provider: 'google',
      environment: 'production',
      enabled: true,
      googleClientId: 'odoo-client',
      javascriptOrigin: 'https://galantesjewelry.com',
      redirectUri: 'https://galantesjewelry.com/auth/google/callback',
      scopes: ['openid', 'email', 'profile'],
      connectedGoogleEmail: 'odoo@example.com',
      oauthConnectedAt: '2026-01-01T00:00:00.000Z',
      encryptedSecrets: {},
      updatedAt: null,
      updatedBy: null,
    },
  },
  appointments: {
    development: {
      provider: 'appointments',
      environment: 'development',
      googleCalendarEnabled: true,
      googleCalendarId: 'odoo-calendar',
      googleServiceAccountEmail: 'odoo-calendar@example.com',
      gmailNotificationsEnabled: false,
      gmailRecipientInbox: 'appointments@example.com',
      gmailSender: 'sender@example.com',
      appointmentDurationMinutes: 30,
      appointmentTimezone: 'UTC',
      appointmentStartTime: '09:00',
      appointmentEndTime: '18:00',
      appointmentSlotIntervalMinutes: 30,
      appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
      encryptedSecrets: {},
      updatedAt: null,
      updatedBy: null,
    },
    staging: {
      provider: 'appointments',
      environment: 'staging',
      googleCalendarEnabled: true,
      googleCalendarId: 'odoo-calendar',
      googleServiceAccountEmail: 'odoo-calendar@example.com',
      gmailNotificationsEnabled: false,
      gmailRecipientInbox: 'appointments@example.com',
      gmailSender: 'sender@example.com',
      appointmentDurationMinutes: 30,
      appointmentTimezone: 'UTC',
      appointmentStartTime: '09:00',
      appointmentEndTime: '18:00',
      appointmentSlotIntervalMinutes: 30,
      appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
      encryptedSecrets: {},
      updatedAt: null,
      updatedBy: null,
    },
    production: {
      provider: 'appointments',
      environment: 'production',
      googleCalendarEnabled: true,
      googleCalendarId: 'odoo-calendar',
      googleServiceAccountEmail: 'odoo-calendar@example.com',
      gmailNotificationsEnabled: false,
      gmailRecipientInbox: 'appointments@example.com',
      gmailSender: 'sender@example.com',
      appointmentDurationMinutes: 30,
      appointmentTimezone: 'UTC',
      appointmentStartTime: '09:00',
      appointmentEndTime: '18:00',
      appointmentSlotIntervalMinutes: 30,
      appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
      encryptedSecrets: {},
      updatedAt: null,
      updatedBy: null,
    },
  },
  audit: [],
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async (filePath: string) => {
      if (!fileStore.has(filePath)) {
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }
      return fileStore.get(filePath)!;
    }),
    writeFile: vi.fn(async (filePath: string, content: string) => {
      fileStore.set(filePath, content);
    }),
  },
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (filePath: string) => {
    if (!fileStore.has(filePath)) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
    return fileStore.get(filePath)!;
  }),
  writeFile: vi.fn(async (filePath: string, content: string) => {
    fileStore.set(filePath, content);
  }),
}));

vi.mock('@/lib/runtime-paths', () => ({
  getDataRoot: () => dataRoot,
}));

vi.mock('@/lib/odoo-cms-sync', () => ({
  loadIntegrationsSnapshotFromOdoo,
  syncIntegrationsSnapshotToOdoo: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/secure-settings', () => ({
  decryptSecret: vi.fn((value: string) => value.replace(/^enc:/, '')),
  encryptSecret: vi.fn((value: string) => `enc:${value}`),
  maskEncryptedSecret: vi.fn((value: string) => value),
}));

describe('integration persistence', () => {
  beforeEach(() => {
    fileStore.clear();
    loadIntegrationsSnapshotFromOdoo.mockClear();
    vi.resetModules();
  });

  it('prefers the local integrations file over the Odoo snapshot', async () => {
    const localStore = {
      google: {
        development: {
          provider: 'google',
          environment: 'development',
          enabled: false,
          googleClientId: 'local-client-dev',
          javascriptOrigin: 'http://localhost:3000',
          redirectUri: 'http://localhost:3000/auth/google/callback',
          scopes: ['openid', 'email', 'profile'],
          connectedGoogleEmail: '',
          oauthConnectedAt: null,
          encryptedSecrets: {
            googleClientSecret: 'enc:local-secret-dev',
          },
          updatedAt: null,
          updatedBy: null,
        },
        staging: {
          provider: 'google',
          environment: 'staging',
          enabled: false,
          googleClientId: 'local-client-staging',
          javascriptOrigin: 'https://staging.galantesjewelry.com',
          redirectUri: 'https://staging.galantesjewelry.com/auth/google/callback',
          scopes: ['openid', 'email', 'profile'],
          connectedGoogleEmail: '',
          oauthConnectedAt: null,
          encryptedSecrets: {
            googleClientSecret: 'enc:local-secret-staging',
          },
          updatedAt: null,
          updatedBy: null,
        },
        production: {
          provider: 'google',
          environment: 'production',
          enabled: true,
          googleClientId: 'local-client-prod',
          javascriptOrigin: 'https://galantesjewelry.com',
          redirectUri: 'https://galantesjewelry.com/auth/google/callback',
          scopes: ['openid', 'email', 'profile'],
          connectedGoogleEmail: 'local@example.com',
          oauthConnectedAt: '2026-01-01T00:00:00.000Z',
          encryptedSecrets: {
            googleClientSecret: 'enc:local-secret-prod',
          },
          updatedAt: null,
          updatedBy: null,
        },
      },
      appointments: {
        development: {
          provider: 'appointments',
          environment: 'development',
          googleCalendarEnabled: true,
          googleCalendarId: 'local-calendar-dev',
          googleServiceAccountEmail: 'local-calendar-dev@example.com',
          gmailNotificationsEnabled: false,
          gmailRecipientInbox: 'appointments@example.com',
          gmailSender: 'sender@example.com',
          appointmentDurationMinutes: 60,
          appointmentTimezone: 'America/New_York',
          appointmentStartTime: '09:00',
          appointmentEndTime: '18:00',
          appointmentSlotIntervalMinutes: 30,
          appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
          encryptedSecrets: {
            googlePrivateKey: 'enc:local-private-key-dev',
          },
          updatedAt: null,
          updatedBy: null,
        },
        staging: {
          provider: 'appointments',
          environment: 'staging',
          googleCalendarEnabled: true,
          googleCalendarId: 'local-calendar-staging',
          googleServiceAccountEmail: 'local-calendar-staging@example.com',
          gmailNotificationsEnabled: false,
          gmailRecipientInbox: 'appointments@example.com',
          gmailSender: 'sender@example.com',
          appointmentDurationMinutes: 60,
          appointmentTimezone: 'America/New_York',
          appointmentStartTime: '09:00',
          appointmentEndTime: '18:00',
          appointmentSlotIntervalMinutes: 30,
          appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
          encryptedSecrets: {
            googlePrivateKey: 'enc:local-private-key-staging',
          },
          updatedAt: null,
          updatedBy: null,
        },
        production: {
          provider: 'appointments',
          environment: 'production',
          googleCalendarEnabled: true,
          googleCalendarId: 'local-calendar-prod',
          googleServiceAccountEmail: 'local-calendar-prod@example.com',
          gmailNotificationsEnabled: false,
          gmailRecipientInbox: 'appointments@example.com',
          gmailSender: 'sender@example.com',
          appointmentDurationMinutes: 60,
          appointmentTimezone: 'America/New_York',
          appointmentStartTime: '09:00',
          appointmentEndTime: '18:00',
          appointmentSlotIntervalMinutes: 30,
          appointmentAvailableWeekdays: [1, 2, 3, 4, 5],
          encryptedSecrets: {
            googlePrivateKey: 'enc:local-private-key-prod',
          },
          updatedAt: null,
          updatedBy: null,
        },
      },
      audit: [],
    };

    fileStore.set(integrationsFilePath, JSON.stringify(localStore));

    const { getGoogleIntegrationForEnvironment, getAppointmentIntegrationForEnvironment } = await import('@/lib/integrations');

    await expect(getGoogleIntegrationForEnvironment('production')).resolves.toMatchObject({
      googleClientId: 'local-client-prod',
      connectedGoogleEmail: 'local@example.com',
      encryptedSecrets: {
        googleClientSecret: 'enc:local-secret-prod',
      },
    });

    await expect(getAppointmentIntegrationForEnvironment('production')).resolves.toMatchObject({
      googleCalendarId: 'local-calendar-prod',
      googleServiceAccountEmail: 'local-calendar-prod@example.com',
      encryptedSecrets: {
        googlePrivateKey: 'enc:local-private-key-prod',
      },
    });

    expect(loadIntegrationsSnapshotFromOdoo).not.toHaveBeenCalled();
  });
});
