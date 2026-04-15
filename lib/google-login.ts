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

function getGoogleSessionKey() {
  const secret =
    process.env.GOOGLE_SESSION_SECRET ||
    process.env.ADMIN_SECRET_KEY ||
    'local_only_google_login_secret_for_development';

  return new TextEncoder().encode(secret);
}

export function resolveGoogleEnvironmentFromHost(host: string): IntegrationEnvironment {
  const normalizedHost = host.split(':')[0]?.toLowerCase() || '';

  if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1') {
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
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, '');

  if (siteUrl) {
    return siteUrl;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || '';
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (host && !host.startsWith('0.0.0.0')) {
    return `${forwardedProto}://${host}`;
  }

  return 'https://galantesjewelry.com';
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

export function getPublicUrl(pathname: string, request: RequestLike) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (request.url) {
    return new URL(normalizedPath, request.url).toString();
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();

  if (host) {
    const protocol = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${protocol}://${host}${normalizedPath}`;
  }

  const fallbackOrigin = process.env.SITE_URL || 'http://localhost:3000';
  return new URL(normalizedPath, fallbackOrigin).toString();
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
