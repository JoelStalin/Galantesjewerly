/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOdooJson2Url,
  createOdooClient,
  getOdooConfig,
  getOdooHeaders,
} from '@/src/config/odooClient.js';

const ORIGINAL_ENV = { ...process.env };

describe('odooClient config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ODOO_BEARER_TOKEN;
    delete process.env.ODOO_API_KEY;
    delete process.env.ODOO_DATABASE;
    delete process.env.ODOO_DB;
    delete process.env.ODOO_BASE_URL;
    delete process.env.ODOO_PASSWORD;
    delete process.env.ODOO_TIMEOUT_MS;
    delete process.env.ODOO_ENABLED;
    delete process.env.ODOO_SYNC_ON_APPOINTMENT_VALIDATED;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads aliases and normalizes the Odoo runtime config', () => {
    process.env.ODOO_ENABLED = 'true';
    process.env.ODOO_BASE_URL = 'https://odoo.example.com/';
    process.env.ODOO_API_KEY = 'secret-key';
    process.env.ODOO_DB = 'galantes_prod';
    process.env.ODOO_TIMEOUT_MS = '45000';
    process.env.ODOO_SYNC_ON_APPOINTMENT_VALIDATED = 'false';

    const config = getOdooConfig();

    expect(config.baseUrl).toBe('https://odoo.example.com');
    expect(config.authToken).toBe('secret-key');
    expect(config.database).toBe('galantes_prod');
    expect(config.timeoutMs).toBe(45000);
    expect(config.syncOnAppointmentValidated).toBe(false);
    expect(config.isReady).toBe(true);
  });

  it('marks the config as incomplete when required Odoo values are missing', () => {
    process.env.ODOO_ENABLED = 'true';

    const config = getOdooConfig();

    expect(config.isReady).toBe(false);
    expect(config.missing).toContain('ODOO_BASE_URL');
    expect(config.missing).toContain('ODOO_BEARER_TOKEN or ODOO_API_KEY or ODOO_PASSWORD');
    expect(config.missing).toContain('ODOO_DATABASE or ODOO_DB');
  });

  it('treats the admin password as a valid fallback when no API key exists', () => {
    process.env.ODOO_ENABLED = 'true';
    process.env.ODOO_BASE_URL = 'https://odoo.example.com';
    process.env.ODOO_PASSWORD = 'admin-password';
    process.env.ODOO_DB = 'galantes_prod';

    const config = getOdooConfig();

    expect(config.password).toBe('admin-password');
    expect(config.missing).not.toContain('ODOO_BEARER_TOKEN or ODOO_API_KEY');
    expect(config.isReady).toBe(true);
  });

  it('builds JSON-2 headers with bearer auth and database selection', () => {
    const headers = getOdooHeaders({
      ...getOdooConfig({
        enabled: true,
        baseUrl: 'https://odoo.example.com',
        authToken: 'odoo-token',
        database: 'galantes_prod',
      }),
      missing: [],
      isReady: true,
    });

    expect(headers.Authorization).toBe('bearer odoo-token');
    expect(headers['X-Odoo-Database']).toBe('galantes_prod');
    expect(headers['Content-Type']).toContain('application/json');
  });

  it('builds JSON-2 headers with bearer auth when only the password fallback exists', () => {
    const headers = getOdooHeaders({
      ...getOdooConfig({
        enabled: true,
        baseUrl: 'https://odoo.example.com',
        password: 'admin-password',
        database: 'galantes_prod',
      }),
      missing: [],
      isReady: true,
    });

    expect(headers.Authorization).toBe('bearer admin-password');
    expect(headers['X-Odoo-Database']).toBe('galantes_prod');
  });

  it('builds the correct JSON-2 endpoint URL', () => {
    const url = buildOdooJson2Url(
      'res.partner',
      'search_read',
      {
        ...getOdooConfig({
          enabled: true,
          baseUrl: 'https://odoo.example.com',
          authToken: 'odoo-token',
          database: 'galantes_prod',
        }),
        missing: [],
        isReady: true,
      },
    );

    expect(url).toBe('https://odoo.example.com/json/2/res.partner/search_read');
  });
});

describe('odooClient requests', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ODOO_BEARER_TOKEN;
    delete process.env.ODOO_API_KEY;
    delete process.env.ODOO_DATABASE;
    delete process.env.ODOO_DB;
    delete process.env.ODOO_BASE_URL;
    delete process.env.ODOO_PASSWORD;
    delete process.env.ODOO_TIMEOUT_MS;
    delete process.env.ODOO_ENABLED;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts JSON-2 requests through the configured endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 7, name: 'Client' }]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const client = createOdooClient({
      enabled: true,
      baseUrl: 'https://odoo.example.com',
      authToken: 'odoo-token',
      database: 'galantes_prod',
      timeoutMs: 1000,
    });

    const response = await client.searchRead(
      'res.partner',
      {
        domain: [['email', '=', 'client@example.com']],
        fields: ['name', 'email'],
      },
      { fetchImpl },
    );

    expect(response).toEqual([{ id: 7, name: 'Client' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://odoo.example.com/json/2/res.partner/search_read',
    );
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'bearer odoo-token',
        'X-Odoo-Database': 'galantes_prod',
      }),
    });
  });

  it('raises a request error when Odoo returns an error payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid apikey' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const client = createOdooClient({
      enabled: true,
      baseUrl: 'https://odoo.example.com',
      authToken: 'bad-token',
      database: 'galantes_prod',
    });

    await expect(
      client.call('res.partner', 'search_read', {}, { fetchImpl }),
    ).rejects.toMatchObject({
      name: 'OdooRequestError',
      details: expect.objectContaining({
        status: 401,
      }),
    });
  });

  it('raises a config error when the client is enabled without credentials', async () => {
    const client = createOdooClient({
      enabled: true,
      baseUrl: 'https://odoo.example.com',
      database: 'galantes_prod',
    });

    await expect(
      client.call('res.partner', 'search_read', {}, { fetchImpl: vi.fn() }),
    ).rejects.toMatchObject({ name: 'OdooConfigError' });
  });
});
