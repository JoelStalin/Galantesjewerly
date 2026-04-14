import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { integrationEnvironments, type IntegrationEnvironment } from '@/lib/integration-types';
import { storeGoogleOAuthTokens } from '@/lib/integrations';
import { getExpiredGoogleOAuthCookieOptions, getPublicUrl } from '@/lib/google-login';
import {
  exchangeGoogleOAuthCode,
  getAdminGoogleOAuthRedirectUri,
  getGoogleOAuthEmail,
  getGoogleOAuthRuntimeConfig,
} from '@/lib/google-oauth';

const ADMIN_GOOGLE_CONNECT_STATE_COOKIE = 'admin_google_connect_state';
const ADMIN_GOOGLE_CONNECT_ENV_COOKIE = 'admin_google_connect_environment';
const ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE = 'admin_google_connect_redirect_uri';

function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === cookieName) {
      return rest.join('=') || null;
    }
  }

  return null;
}

function parseEnvironment(value: string | null): IntegrationEnvironment {
  if (integrationEnvironments.includes(value as IntegrationEnvironment)) {
    return value as IntegrationEnvironment;
  }

  return 'production';
}

function getAuditContext(request: Request, actor: string) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ipAddress = forwardedFor.split(',')[0]?.trim() || 'local';

  return {
    actor,
    ipAddress,
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

function redirectWithStatus(request: Request, status: string) {
  const response = NextResponse.redirect(
    getPublicUrl(`/admin/dashboard?tab=integrations&google_owner_oauth=${status}`, request),
  );
  response.cookies.set({
    ...getExpiredGoogleOAuthCookieOptions(request),
    name: ADMIN_GOOGLE_CONNECT_STATE_COOKIE,
    value: '',
  });
  response.cookies.set({
    ...getExpiredGoogleOAuthCookieOptions(request),
    name: ADMIN_GOOGLE_CONNECT_ENV_COOKIE,
    value: '',
  });
  response.cookies.set({
    ...getExpiredGoogleOAuthCookieOptions(request),
    name: ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE,
    value: '',
  });
  return response;
}

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.redirect(getPublicUrl('/admin/login', request));
  }

  const requestUrl = new URL(request.url);
  const cookieHeader = request.headers.get('cookie');
  const expectedState = getCookieValue(cookieHeader, ADMIN_GOOGLE_CONNECT_STATE_COOKIE);
  const environment = parseEnvironment(getCookieValue(cookieHeader, ADMIN_GOOGLE_CONNECT_ENV_COOKIE));
  const redirectUri = getCookieValue(cookieHeader, ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE)
    || getAdminGoogleOAuthRedirectUri(request);

  try {
    const error = requestUrl.searchParams.get('error');
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');

    if (error) {
      throw new Error(`Google returned OAuth error: ${error}`);
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      throw new Error('Google OAuth state validation failed.');
    }

    const runtimeConfig = await getGoogleOAuthRuntimeConfig(environment);
    if (!runtimeConfig.clientId || !runtimeConfig.clientSecret) {
      throw new Error('Google OAuth Client ID and Client Secret are required before connecting the owner account.');
    }

    const tokenPayload = await exchangeGoogleOAuthCode({
      code,
      clientId: runtimeConfig.clientId,
      clientSecret: runtimeConfig.clientSecret,
      redirectUri,
    });

    if (!tokenPayload.refresh_token && !runtimeConfig.refreshToken) {
      throw new Error('Google did not return a refresh token. Disconnect access in Google Account permissions and connect again.');
    }

    const connectedGoogleEmail = await getGoogleOAuthEmail(tokenPayload.access_token || runtimeConfig.accessToken);
    await storeGoogleOAuthTokens(
      {
        environment,
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        scopes: tokenPayload.scope,
        connectedGoogleEmail,
      },
      getAuditContext(request, session.user || 'admin'),
    );

    return redirectWithStatus(request, 'connected');
  } catch (error) {
    console.error('[Admin Google OAuth] callback failed:', error instanceof Error ? error.message : 'unknown error');
    return redirectWithStatus(request, 'error');
  }
}
