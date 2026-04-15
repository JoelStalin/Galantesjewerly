import { SignJWT, jwtVerify } from 'jose';
import { getDecryptedGoogleIntegration } from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import { shouldUseSecureCookies } from '@/lib/auth';

export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
export const GOOGLE_OAUTH_RETURN_COOKIE = 'google_oauth_return_to';
export const GOOGLE_USER_COOKIE = 'google_user_session';
export const GOOGLE_USER_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type GoogleUserSessionPayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  exp?: number;
  iat?: number;
};

type GoogleLoginConfig = {
  environment: IntegrationEnvironment;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  javascriptOrigin: string;
  scopes: string[];
};

type RequestLike = {
  headers: Headers;
  url?: string;
};

function getConfiguredSiteUrl() {
  const candidates = [
    process.env.GOOGLE_PUBLIC_BASE_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.trim().replace(/\/+$/, '');
    if (!normalized) {
      continue;
    }

    try {
      const url = new URL(normalized);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString().replace(/\/+$/, '');
      }
    } catch {
      continue;
    }
  }

  return '';
}

function isLoopbackHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '::', '[::]'].includes(hostname);
}

function normalizeHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  if (normalized === '0.0.0.0' || normalized === '::' || normalized === '[::]') {
    return 'localhost';
  }

  return normalized;
}

function normalizeHostWithPort(host: string) {
  const trimmed = host.trim();

  if (!trimmed) {
    return '';
  }

  const ipv6LoopbackMatch = trimmed.match(/^\[(::|::1)\](?::(\d+))?$/i);
  if (ipv6LoopbackMatch) {
    const [, , port] = ipv6LoopbackMatch;
    return port ? `localhost:${port}` : 'localhost';
  }

  const [hostname, ...rest] = trimmed.split(':');
  const normalizedHostname = normalizeHostname(hostname);
  const port = rest.join(':');

  return port ? `${normalizedHostname}:${port}` : normalizedHostname;
}

function getGoogleSessionKey() {
  const secret =
    process.env.GOOGLE_SESSION_SECRET ||
    process.env.ADMIN_SECRET_KEY ||
    'local_only_google_login_secret_for_development';

  return new TextEncoder().encode(secret);
}

export function resolveGoogleEnvironmentFromHost(host: string): IntegrationEnvironment {
  const normalizedHost = normalizeHostname(host.split(':')[0] || '');

  if (isLoopbackHostname(normalizedHost)) {
    return 'development';
  }

  if (normalizedHost.startsWith('staging.')) {
    return 'staging';
  }

  return 'production';
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

export function getPublicBaseUrl(request: RequestLike) {
  const siteUrl = getConfiguredSiteUrl();

  if (siteUrl) {
    return siteUrl;
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = normalizeHostWithPort(forwardedHost || request.headers.get('host') || '');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (host) {
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : forwardedProto;
    return `${protocol}://${host}`;
  }

  return 'https://galantesjewelry.com';
}

export function getPublicUrl(pathname: string, request: RequestLike) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(normalizedPath, getPublicBaseUrl(request)).toString();
}

export function getGoogleRedirectBaseUrl(redirectUri: string | undefined, request: RequestLike) {
  const normalizedRedirectUri = redirectUri?.trim();

  if (normalizedRedirectUri) {
    try {
      return new URL(normalizedRedirectUri).origin;
    } catch {
      // Fall through to the canonical public base URL.
    }
  }

  return getPublicBaseUrl(request);
}
export function getGoogleOAuthCookieOptions(request: RequestLike, maxAge = 600) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(request),
  };
}

export function getExpiredGoogleOAuthCookieOptions(request: RequestLike) {
  return {
    ...getGoogleOAuthCookieOptions(request, 0),
    expires: new Date(0),
    maxAge: 0,
  };
}

export function getGoogleUserCookieOptions(request: RequestLike) {
  return {
    httpOnly: true,
    maxAge: GOOGLE_USER_SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(request),
  };
}

export async function getGoogleLoginConfig(request: RequestLike): Promise<GoogleLoginConfig> {
  const environment = resolveGoogleEnvironmentFromHost(request.headers.get('host') || '');
  const stored = await getDecryptedGoogleIntegration(environment);

  return {
    environment,
    enabled: stored.enabled,
    clientId: stored.googleClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: stored.secrets.googleClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    redirectUri: stored.redirectUri || process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
    javascriptOrigin: stored.javascriptOrigin || process.env.GOOGLE_OAUTH_JAVASCRIPT_ORIGIN || '',
    scopes: stored.scopes.length > 0
      ? stored.scopes
      : (process.env.GOOGLE_OAUTH_SCOPES || 'openid email profile').split(/[\s,]+/).filter(Boolean),
  };
}

export function assertGoogleLoginConfig(config: GoogleLoginConfig) {
  const missingFields = [
    !config.clientId ? 'GOOGLE_CLIENT_ID' : '',
    !config.clientSecret ? 'GOOGLE_CLIENT_SECRET' : '',
    !config.redirectUri ? 'GOOGLE_REDIRECT_URI' : '',
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new Error(`Google OAuth is missing: ${missingFields.join(', ')}`);
  }
}

export async function signGoogleUserSession(payload: Omit<GoogleUserSessionPayload, 'exp' | 'iat'>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getGoogleSessionKey());
}

export async function verifyGoogleUserSession(token: string): Promise<GoogleUserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getGoogleSessionKey());
    return payload as GoogleUserSessionPayload;
  } catch {
    return null;
  }
}
