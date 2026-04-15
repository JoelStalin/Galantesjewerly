const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT = 'galantes-jewelry-appointments/1.0';
const DEFAULT_PARTNER_MODEL = 'res.partner';
const DEFAULT_APPOINTMENT_MODEL = 'galante.appointment';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

class OdooConfigError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OdooConfigError';
    this.details = details;
  }
}

class OdooRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OdooRequestError';
    this.details = details;
  }
}

function firstDefinedValue(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  throw new OdooConfigError(`Invalid boolean value "${value}" in Odoo configuration.`);
}

function parseIntegerEnv(value, fallback, label) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new OdooConfigError(`${label} must be a positive integer.`);
  }

  return parsed;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeBaseUrl(value) {
  const normalized = normalizeOptionalString(value).replace(/\/+$/, '');

  if (!normalized) {
    return '';
  }

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new OdooConfigError('ODOO_BASE_URL must be a valid http(s) URL.');
  }
}

function getOdooAuthToken(overrides = {}) {
  return normalizeOptionalString(
    firstDefinedValue(
      overrides.authToken,
      process.env.ODOO_BEARER_TOKEN,
      process.env.ODOO_API_KEY,
    ),
  );
}

function getOdooConfig(overrides = {}) {
  const enabled = parseBooleanEnv(
    firstDefinedValue(overrides.enabled, process.env.ODOO_ENABLED),
    true,
  );

  const baseUrl = normalizeBaseUrl(
    firstDefinedValue(overrides.baseUrl, process.env.ODOO_BASE_URL),
  );
  const database = normalizeOptionalString(
    firstDefinedValue(overrides.database, process.env.ODOO_DATABASE, process.env.ODOO_DB),
  );
  const authToken = getOdooAuthToken(overrides);
  const timeoutMs = parseIntegerEnv(
    firstDefinedValue(overrides.timeoutMs, process.env.ODOO_TIMEOUT_MS),
    DEFAULT_TIMEOUT_MS,
    'ODOO_TIMEOUT_MS',
  );

  const config = {
    enabled,
    baseUrl,
    database,
    authToken,
    timeoutMs,
    syncOnAppointmentValidated: parseBooleanEnv(
      firstDefinedValue(
        overrides.syncOnAppointmentValidated,
        process.env.ODOO_SYNC_ON_APPOINTMENT_VALIDATED,
      ),
      true,
    ),
    publicShopUrl: normalizeOptionalString(
      firstDefinedValue(overrides.publicShopUrl, process.env.ODOO_PUBLIC_SHOP_URL),
    ),
    websiteId: normalizeOptionalString(
      firstDefinedValue(overrides.websiteId, process.env.ODOO_WEBSITE_ID),
    ),
    companyId: normalizeOptionalString(
      firstDefinedValue(overrides.companyId, process.env.ODOO_COMPANY_ID),
    ),
    partnerModel: normalizeOptionalString(
      firstDefinedValue(overrides.partnerModel, process.env.ODOO_PARTNER_MODEL),
    ) || DEFAULT_PARTNER_MODEL,
    appointmentModel: normalizeOptionalString(
      firstDefinedValue(overrides.appointmentModel, process.env.ODOO_APPOINTMENT_MODEL),
    ) || DEFAULT_APPOINTMENT_MODEL,
    userAgent: normalizeOptionalString(
      firstDefinedValue(overrides.userAgent, process.env.ODOO_USER_AGENT),
    ) || DEFAULT_USER_AGENT,
  };

  const missing = [];

  if (config.enabled && !config.baseUrl) {
    missing.push('ODOO_BASE_URL');
  }

  if (config.enabled && !config.authToken) {
    missing.push('ODOO_BEARER_TOKEN or ODOO_API_KEY');
  }

  if (config.enabled && !config.database) {
    missing.push('ODOO_DATABASE or ODOO_DB');
  }

  return {
    ...config,
    missing,
    isReady: config.enabled ? missing.length === 0 : false,
  };
}

function assertOdooConfig(config = getOdooConfig()) {
  if (!config.enabled) {
    throw new OdooConfigError('Odoo sync is disabled by configuration.', {
      missing: [],
    });
  }

  if (config.missing.length > 0) {
    throw new OdooConfigError(
      `Odoo configuration is incomplete: ${config.missing.join(', ')}`,
      { missing: config.missing },
    );
  }

  return config;
}

function getOdooHeaders(config = getOdooConfig()) {
  const resolvedConfig = assertOdooConfig(config);

  return {
    Authorization: `bearer ${resolvedConfig.authToken}`,
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
    'User-Agent': resolvedConfig.userAgent,
    'X-Odoo-Database': resolvedConfig.database,
  };
}

function buildOdooJson2Url(model, method, config = getOdooConfig()) {
  const resolvedConfig = assertOdooConfig(config);
  const normalizedModel = normalizeOptionalString(model);
  const normalizedMethod = normalizeOptionalString(method);

  if (!normalizedModel || !normalizedMethod) {
    throw new OdooConfigError('Odoo model and method are required for JSON-2 calls.');
  }

  return `${resolvedConfig.baseUrl}/json/2/${encodeURIComponent(normalizedModel)}/${encodeURIComponent(normalizedMethod)}`;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

function bindAbortSignal(controller, signal) {
  if (!signal) {
    return () => {};
  }

  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => {};
  }

  const onAbort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

function createOdooClient(overrides = {}) {
  function resolveConfig() {
    return getOdooConfig(overrides);
  }

  async function call(model, method, payload = {}, options = {}) {
    const config = assertOdooConfig(resolveConfig());
    const fetchImpl = options.fetchImpl || fetch;
    const controller = new AbortController();
    const clearSignal = bindAbortSignal(controller, options.signal);
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetchImpl(buildOdooJson2Url(model, method, config), {
        method: 'POST',
        headers: getOdooHeaders(config),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw new OdooRequestError(
          body?.message || `Odoo JSON-2 request failed with status ${response.status}.`,
          {
            status: response.status,
            body,
            model,
            method,
          },
        );
      }

      return body;
    } catch (error) {
      if (error instanceof OdooConfigError || error instanceof OdooRequestError) {
        throw error;
      }

      if (error?.name === 'AbortError') {
        throw new OdooRequestError('Odoo JSON-2 request timed out or was aborted.', {
          model,
          method,
          timeoutMs: config.timeoutMs,
        });
      }

      throw new OdooRequestError(`Unable to reach Odoo JSON-2 API: ${error.message}`, {
        model,
        method,
      });
    } finally {
      clearTimeout(timeoutId);
      clearSignal();
    }
  }

  return {
    getConfig: resolveConfig,
    call,
    async searchRead(model, payload = {}, options = {}) {
      return call(model, 'search_read', payload, options);
    },
    async create(model, values, options = {}) {
      return call(model, 'create', values, options);
    },
  };
}

export {
  OdooConfigError,
  OdooRequestError,
  buildOdooJson2Url,
  createOdooClient,
  getOdooAuthToken,
  getOdooConfig,
  getOdooHeaders,
  assertOdooConfig,
  parseBooleanEnv,
};
