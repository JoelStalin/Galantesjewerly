import crypto from 'node:crypto';
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

const localGoogleSessionSecret = crypto.randomBytes(32).toString('hex');

function normalizeBaseUrl(value: string) {
  const normalizedValue = value.trim().replace(/\/+$/, '');

  if (!normalizedValue) {
    return '';
  }

  try {
    const url = new URL(normalizedValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }

    url.hostname = normalizeHostname(url.hostname);
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function getConfiguredSiteUrl() {
  const candidates = [
    process.env.GOOGLE_PUBLIC_BASE_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate || '');
    if (!normalized) {
      continue;
    }

    return normalized;
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
    localGoogleSessionSecret;

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
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const protocol = isLocal ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  const isProd = process.env.NODE_ENV === 'production';
  return isProd ? 'https://galantesjewelry.com' : 'http://localhost:3000';
}

export function getRequestBaseUrl(request: RequestLike) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = normalizeHostWithPort(forwardedHost || request.headers.get('host') || '');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (host) {
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : forwardedProto;
    return `${protocol}://${host}`;
  }

  if (request.url) {
    try {
      const normalized = normalizeBaseUrl(new URL(request.url).origin);
      if (normalized) {
        return normalized;
      }
    } catch {
      // Fall through to the canonical public base URL.
    }
  }

  const siteUrl = getConfiguredSiteUrl();
  if (siteUrl) {
    return siteUrl;
  }

  return getPublicBaseUrl(request);
}


export function getPublicUrl(pathname: string, request: RequestLike) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(normalizedPath, getPublicBaseUrl(request)).toString();
}

export function getRequestUrl(pathname: string, request: RequestLike) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(normalizedPath, getRequestBaseUrl(request)).toString();
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
  const isProd = process.env.NODE_ENV === 'production' || !request.headers.get('host')?.includes('localhost');
  
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    // Use none for OAuth to survive redirects from Google, but requires Secure
    sameSite: isProd ? 'none' as const : 'lax' as const,
    secure: isProd ? true : shouldUseSecureCookies(request),
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
  const publicBaseUrl = getPublicBaseUrl(request);
  const requestRedirectUri = getRequestUrl('/auth/google/callback', request);

  return {
    environment,
    enabled: stored.enabled,
    clientId: stored.googleClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.CLIENT_ID || '',
    clientSecret: stored.secrets.googleClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET || '',
    redirectUri: stored.redirectUri || process.env.GOOGLE_OAUTH_REDIRECT_URI || process.env.REDIRECT_URI || requestRedirectUri,
    javascriptOrigin: stored.javascriptOrigin || process.env.GOOGLE_OAUTH_JAVASCRIPT_ORIGIN || publicBaseUrl,
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
