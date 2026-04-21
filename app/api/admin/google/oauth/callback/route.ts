import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { integrationEnvironments, type IntegrationEnvironment } from '@/lib/integration-types';
import { storeGoogleOAuthTokens } from '@/lib/integrations';
import { getExpiredGoogleOAuthCookieOptions, getRequestUrl } from '@/lib/google-login';
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

function redirectWithStatus(request: Request, status: string, detail?: string) {
  const params = new URLSearchParams({
    tab: 'integrations',
    google_owner_oauth: status,
  });
  if (detail) {
    params.set('oauth_detail', detail);
  }
  const response = NextResponse.redirect(
    getRequestUrl(`/admin/dashboard?${params.toString()}`, request),
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
    console.error('[Admin Google OAuth] callback: no admin session found — user not logged in or session cookie lost through redirect.');
    return NextResponse.redirect(getRequestUrl('/admin/login', request));
  }

  const requestUrl = new URL(request.url);
  const cookieHeader = request.headers.get('cookie');

  // --- Detailed cookie diagnostics ---
  const allCookieNames = (cookieHeader || '').split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
  const expectedState = getCookieValue(cookieHeader, ADMIN_GOOGLE_CONNECT_STATE_COOKIE);
  const environment = parseEnvironment(getCookieValue(cookieHeader, ADMIN_GOOGLE_CONNECT_ENV_COOKIE));
  const redirectUri = getCookieValue(cookieHeader, ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE)
    || getAdminGoogleOAuthRedirectUri(request);

  const error = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  console.log('[Admin Google OAuth] callback diagnostics:', {
    hasCode: !!code,
    hasState: !!state,
    hasExpectedState: !!expectedState,
    stateMatch: state === expectedState,
    environment,
    redirectUri,
    cookieCount: allCookieNames.length,
    hasCookieHeader: !!cookieHeader,
    cookieNames: allCookieNames,
    hasStateCookie: allCookieNames.includes(ADMIN_GOOGLE_CONNECT_STATE_COOKIE),
    hasEnvCookie: allCookieNames.includes(ADMIN_GOOGLE_CONNECT_ENV_COOKIE),
    hasRedirectCookie: allCookieNames.includes(ADMIN_GOOGLE_CONNECT_REDIRECT_COOKIE),
    googleError: error || 'none',
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
  });

  try {
    if (error) {
      const errorDesc = requestUrl.searchParams.get('error_description') || error;
      console.error(`[Admin Google OAuth] Google returned error: ${error} — ${errorDesc}`);
      throw new Error(`Google returned OAuth error: ${errorDesc}`);
    }

    if (!code) {
      throw new Error('Google did not return an authorization code.');
    }

    // --- State validation with detailed error messages ---
    if (!expectedState) {
      console.error('[Admin Google OAuth] STATE COOKIE MISSING. The browser did not send the state cookie back.',
        'This usually means: (1) Cloudflare Access intercepted the callback and dropped cookies,',
        '(2) The cookie was set as Secure but the callback arrived via HTTP,',
        '(3) The cookie expired (maxAge=600s = 10 minutes),',
        '(4) A different domain/subdomain received the callback than the one that set the cookie.',
      );
      throw new Error(
        'OAuth state cookie was not sent by the browser. '
        + 'Verify that the callback URL is excluded from Cloudflare Access policies '
        + 'and that both the start and callback hit the same domain (e.g., galantesjewelry.com).'
      );
    }

    if (!state) {
      throw new Error('Google did not return the state parameter in the callback URL.');
    }

    if (state !== expectedState) {
      console.error('[Admin Google OAuth] STATE MISMATCH.',
        { stateFromGoogle: state.substring(0, 8) + '...', stateFromCookie: expectedState.substring(0, 8) + '...' },
        'This means the cookie was present but contains a different value than what Google returned.',
        'Possible cause: user started two OAuth flows and the second overwrote the first cookie.',
      );
      throw new Error(
        'OAuth state mismatch — the state from Google does not match the cookie. '
        + 'Please try again. If using multiple browser tabs, close them and retry in a single tab.'
      );
    }

    const runtimeConfig = await getGoogleOAuthRuntimeConfig(environment);
    if (!runtimeConfig.clientId || !runtimeConfig.clientSecret) {
      throw new Error('Google OAuth Client ID and Client Secret are required before connecting the owner account.');
    }

    console.log('[Admin Google OAuth] state validated, exchanging code for tokens...', {
      environment,
      redirectUri,
      clientIdPrefix: runtimeConfig.clientId.substring(0, 12) + '...',
    });

    const tokenPayload = await exchangeGoogleOAuthCode({
      code,
      clientId: runtimeConfig.clientId,
      clientSecret: runtimeConfig.clientSecret,
      redirectUri,
    });

    console.log('[Admin Google OAuth] token exchange successful:', {
      hasAccessToken: !!tokenPayload.access_token,
      hasRefreshToken: !!tokenPayload.refresh_token,
      scopes: tokenPayload.scope,
    });

    if (!tokenPayload.refresh_token && !runtimeConfig.refreshToken) {
      throw new Error('Google did not return a refresh token. Disconnect access in Google Account permissions (https://myaccount.google.com/permissions) and connect again.');
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

    console.log(`[Admin Google OAuth] SUCCESS — connected as ${connectedGoogleEmail} for ${environment}`);
    return redirectWithStatus(request, 'connected');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[Admin Google OAuth] callback FAILED:', message);
    return redirectWithStatus(request, 'error', encodeURIComponent(message.substring(0, 200)));
  }
}
