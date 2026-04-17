import { NextResponse } from 'next/server';
import {
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_USER_COOKIE,
  assertGoogleLoginConfig,
  getExpiredGoogleOAuthCookieOptions,
  getGoogleRedirectBaseUrl,
  getGoogleLoginConfig,
  getGoogleUserCookieOptions,
  sanitizeReturnTo,
  signGoogleUserSession,
} from '@/lib/google-login';

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

type GoogleTokenInfoResponse = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
  error?: string;
  error_description?: string;
};

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

async function exchangeCodeForTokens(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  console.log('[Google OAuth] Exchanging code for tokens...');
  console.log('[Google OAuth] Redirect URI:', input.redirectUri);
  console.log('[Google OAuth] Client ID:', input.clientId?.substring(0, 20) + '...');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

  const tokenPayload = await tokenResponse.json() as GoogleTokenResponse;

  console.log('[Google OAuth] Token response status:', tokenResponse.status);
  if (tokenPayload.error) {
    console.error('[Google OAuth] Token error:', tokenPayload.error, tokenPayload.error_description);
  }

  if (!tokenResponse.ok || tokenPayload.error || !tokenPayload.id_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || 'Google token exchange failed.');
  }

  console.log('[Google OAuth] Token exchange successful');
  return tokenPayload;
}

async function verifyGoogleIdToken(idToken: string, clientId: string) {
  console.log('[Google OAuth] Verifying ID token...');
  console.log('[Google OAuth] Expected Client ID:', clientId?.substring(0, 20) + '...');

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' },
  );
  const tokenInfo = await tokenInfoResponse.json() as GoogleTokenInfoResponse;

  console.log('[Google OAuth] Token info response status:', tokenInfoResponse.status);

  if (!tokenInfoResponse.ok || tokenInfo.error) {
    console.error('[Google OAuth] Token info error:', tokenInfo.error, tokenInfo.error_description);
    throw new Error(tokenInfo.error_description || tokenInfo.error || 'Google ID token validation failed.');
  }

  console.log('[Google OAuth] Token Info:', {
    aud: tokenInfo.aud?.substring(0, 20) + '...',
    iss: tokenInfo.iss,
    email: tokenInfo.email,
    email_verified: tokenInfo.email_verified,
    sub: tokenInfo.sub?.substring(0, 10) + '...',
  });

  if (tokenInfo.aud !== clientId) {
    console.error('[Google OAuth] Audience mismatch. Expected:', clientId, 'Got:', tokenInfo.aud);
    throw new Error('Google ID token audience does not match this OAuth client.');
  }

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(tokenInfo.iss || '')) {
    console.error('[Google OAuth] Invalid issuer:', tokenInfo.iss);
    throw new Error('Google ID token issuer is invalid.');
  }

  if (!tokenInfo.sub || !tokenInfo.email) {
    console.error('[Google OAuth] Missing required fields. Sub:', tokenInfo.sub, 'Email:', tokenInfo.email);
    throw new Error('Google ID token is missing required profile fields.');
  }

  if (String(tokenInfo.email_verified) !== 'true') {
    console.error('[Google OAuth] Email not verified. Value:', tokenInfo.email_verified);
    throw new Error('Google account email is not verified.');
  }

  console.log('[Google OAuth] Token verification successful');
  return tokenInfo;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieHeader = request.headers.get('cookie');
  const expectedState = getCookieValue(cookieHeader, GOOGLE_OAUTH_STATE_COOKIE);
  const returnTo = sanitizeReturnTo(getCookieValue(cookieHeader, GOOGLE_OAUTH_RETURN_COOKIE));
  let redirectBaseUrl = '';

  console.log('[Google OAuth] Callback initiated');
  console.log('[Google OAuth] Request URL:', requestUrl.toString());
  console.log('[Google OAuth] Expected state:', expectedState?.substring(0, 10) + '...');
  console.log('[Google OAuth] Return To:', returnTo);

  try {
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const error = requestUrl.searchParams.get('error');

    console.log('[Google OAuth] Query params - Code:', code ? 'present' : 'missing', 'State:', state?.substring(0, 10) + '...', 'Error:', error);

    if (error) {
      console.error('[Google OAuth] OAuth error from Google:', error);
      throw new Error(`Google returned OAuth error: ${error}`);
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      console.error('[Google OAuth] State validation failed', {
        code: !!code,
        state: !!state,
        expectedState: !!expectedState,
        stateMatch: state === expectedState,
      });
      throw new Error('Google OAuth state validation failed.');
    }

    console.log('[Google OAuth] State validation passed');

    const config = await getGoogleLoginConfig(request);

    console.log('[Google OAuth] Config loaded - Enabled:', config.enabled, 'Client ID:', config.clientId?.substring(0, 20) + '...');

    if (!config.enabled) {
      throw new Error('Google login is disabled.');
    }

    assertGoogleLoginConfig(config);
    redirectBaseUrl = getGoogleRedirectBaseUrl(config.redirectUri, request);

    console.log('[Google OAuth] Redirect base URL:', redirectBaseUrl);

    const tokenPayload = await exchangeCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
    const tokenInfo = await verifyGoogleIdToken(tokenPayload.id_token || '', config.clientId);
    const sessionToken = await signGoogleUserSession({
      sub: tokenInfo.sub || '',
      email: tokenInfo.email || '',
      name: tokenInfo.name,
      picture: tokenInfo.picture,
    });

    console.log('[Google OAuth] User authenticated:', tokenInfo.email);

    // Sync with Odoo (Equipo Senior: Account Merging Logic)
    try {
      const { OdooService } = await import('@/lib/odoo/services');
      await OdooService.syncAuthenticatedUser({
        name: tokenInfo.name || '',
        email: tokenInfo.email || '',
        google_id: tokenInfo.sub,
      });
      console.log('[Google OAuth] Odoo Sync Successful');
    } catch (odooError) {
      console.error('[Google OAuth] Odoo Sync Failed (Non-blocking):', odooError);
      // We don't block the login if Odoo sync fails, but we log it for the next audit.
    }

    const response = NextResponse.redirect(new URL(returnTo, redirectBaseUrl).toString());
    response.cookies.set({
      ...getGoogleUserCookieOptions(request),
      name: GOOGLE_USER_COOKIE,
      value: sessionToken,
    });
    response.cookies.set({
      ...getExpiredGoogleOAuthCookieOptions(request),
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: '',
    });
    response.cookies.set({
      ...getExpiredGoogleOAuthCookieOptions(request),
      name: GOOGLE_OAUTH_RETURN_COOKIE,
      value: '',
    });

    console.log('[Google OAuth] Callback completed successfully');
    return response;
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error instanceof Error ? error.message : 'unknown error');
    console.error('[Google OAuth] Full error:', error);

    const response = NextResponse.redirect(
      new URL('/?google_login=error', redirectBaseUrl || getGoogleRedirectBaseUrl(undefined, request)).toString(),
    );
    response.cookies.set({
      ...getExpiredGoogleOAuthCookieOptions(request),
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: '',
    });
    response.cookies.set({
      ...getExpiredGoogleOAuthCookieOptions(request),
      name: GOOGLE_OAUTH_RETURN_COOKIE,
      value: '',
    });

    return response;
  }
}
