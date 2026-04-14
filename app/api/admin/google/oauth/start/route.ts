import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDecryptedGoogleIntegration } from '@/lib/integrations';
import { integrationEnvironments, type IntegrationEnvironment } from '@/lib/integration-types';
import { getGoogleOAuthCookieOptions } from '@/lib/google-login';
import { GOOGLE_ADMIN_OAUTH_SCOPES, getAdminGoogleOAuthRedirectUri } from '@/lib/google-oauth';

const ADMIN_GOOGLE_CONNECT_STATE_COOKIE = 'admin_google_connect_state';
const ADMIN_GOOGLE_CONNECT_ENV_COOKIE = 'admin_google_connect_environment';
const ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE = 'admin_google_connect_redirect_uri';

function parseEnvironment(value: string | null): IntegrationEnvironment {
  if (integrationEnvironments.includes(value as IntegrationEnvironment)) {
    return value as IntegrationEnvironment;
  }

  return 'production';
}

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  try {
    const requestUrl = new URL(request.url);
    const environment = parseEnvironment(requestUrl.searchParams.get('environment'));
    const config = await getDecryptedGoogleIntegration(environment);
    const clientId = config.googleClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
    const clientSecret = config.secrets.googleClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/admin/dashboard?tab=integrations&google_owner_oauth=missing_client', request.url),
      );
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const redirectUri = config.redirectUri || getAdminGoogleOAuthRedirectUri(request);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_ADMIN_OAUTH_SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'consent select_account');

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      ...getGoogleOAuthCookieOptions(request),
      name: ADMIN_GOOGLE_CONNECT_STATE_COOKIE,
      value: state,
    });
    response.cookies.set({
      ...getGoogleOAuthCookieOptions(request),
      name: ADMIN_GOOGLE_CONNECT_ENV_COOKIE,
      value: environment,
    });
    response.cookies.set({
      ...getGoogleOAuthCookieOptions(request),
      name: ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE,
      value: redirectUri,
    });

    return response;
  } catch (error) {
    console.error('[Admin Google OAuth] start failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.redirect(new URL('/admin/dashboard?tab=integrations&google_owner_oauth=error', request.url));
  }
}
