import { NextResponse } from 'next/server';
import {
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_USER_COOKIE,
  assertGoogleLoginConfig,
  getExpiredGoogleOAuthCookieOptions,
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

  if (!tokenResponse.ok || tokenPayload.error || !tokenPayload.id_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || 'Google token exchange failed.');
  }

  return tokenPayload;
}

async function verifyGoogleIdToken(idToken: string, clientId: string) {
  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' },
  );
  const tokenInfo = await tokenInfoResponse.json() as GoogleTokenInfoResponse;

  if (!tokenInfoResponse.ok || tokenInfo.error) {
    throw new Error(tokenInfo.error_description || tokenInfo.error || 'Google ID token validation failed.');
  }

  if (tokenInfo.aud !== clientId) {
    throw new Error('Google ID token audience does not match this OAuth client.');
  }

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(tokenInfo.iss || '')) {
    throw new Error('Google ID token issuer is invalid.');
  }

  if (!tokenInfo.sub || !tokenInfo.email) {
    throw new Error('Google ID token is missing required profile fields.');
  }

  if (String(tokenInfo.email_verified) !== 'true') {
    throw new Error('Google account email is not verified.');
  }

  return tokenInfo;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieHeader = request.headers.get('cookie');
  const expectedState = getCookieValue(cookieHeader, GOOGLE_OAUTH_STATE_COOKIE);
  const returnTo = sanitizeReturnTo(getCookieValue(cookieHeader, GOOGLE_OAUTH_RETURN_COOKIE));

  try {
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const error = requestUrl.searchParams.get('error');

    if (error) {
      throw new Error(`Google returned OAuth error: ${error}`);
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      throw new Error('Google OAuth state validation failed.');
    }

    const config = await getGoogleLoginConfig(request);

    if (!config.enabled) {
      throw new Error('Google login is disabled.');
    }

    assertGoogleLoginConfig(config);

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

    const response = NextResponse.redirect(new URL(returnTo, request.url));
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

    return response;
  } catch (error) {
    const response = NextResponse.redirect(new URL('/?google_login=error', request.url));
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

    console.error('[Google OAuth] callback failed:', error instanceof Error ? error.message : 'unknown error');
    return response;
  }
}
