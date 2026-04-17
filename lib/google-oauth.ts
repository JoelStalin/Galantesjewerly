import { getDecryptedGoogleIntegration } from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import { getRequestUrl } from '@/lib/google-login';

export const GOOGLE_ADMIN_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

export type GoogleOAuthRuntimeConfig = {
  environment: IntegrationEnvironment;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  connectedGoogleEmail: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function getAdminGoogleOAuthRedirectUri(request: Request) {
  return getRequestUrl('/api/admin/google/oauth/callback', request);
}

export async function getGoogleOAuthRuntimeConfig(
  environment: IntegrationEnvironment,
): Promise<GoogleOAuthRuntimeConfig> {
  const stored = await getDecryptedGoogleIntegration(environment);

  return {
    environment,
    clientId: stored.googleClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.CLIENT_ID || '',
    clientSecret: stored.secrets.googleClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET || '',
    refreshToken: stored.secrets.refreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
    accessToken: stored.secrets.accessToken || '',
    connectedGoogleEmail: stored.connectedGoogleEmail || '',
  };
}

export function assertGoogleOAuthRuntimeConfig(config: GoogleOAuthRuntimeConfig) {
  const missing = [
    !config.clientId ? 'Google OAuth Client ID' : '',
    !config.clientSecret ? 'Google OAuth Client Secret' : '',
    !config.refreshToken ? 'Google OAuth refresh token' : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Google OAuth is not connected: ${missing.join(', ')}`);
  }
}

export async function refreshGoogleOAuthAccessToken(config: GoogleOAuthRuntimeConfig) {
  assertGoogleOAuthRuntimeConfig(config);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const payload = await response.json() as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google OAuth token refresh failed.');
  }

  return payload.access_token;
}

export async function exchangeGoogleOAuthCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });
  const payload = await response.json() as GoogleTokenResponse;

  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google OAuth token exchange failed.');
  }

  return payload;
}

export async function getGoogleOAuthEmail(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json() as { email?: string; verified_email?: boolean; error?: string };

  if (!response.ok || payload.error || !payload.email) {
    throw new Error(payload.error || 'Could not read the connected Google email.');
  }

  if (payload.verified_email === false) {
    throw new Error('Connected Google email is not verified.');
  }

  return payload.email;
}
