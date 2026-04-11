import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  assertGoogleLoginConfig,
  getGoogleLoginConfig,
  getGoogleOAuthCookieOptions,
  sanitizeReturnTo,
} from '@/lib/google-login';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const config = await getGoogleLoginConfig(request);

    if (!config.enabled) {
      return NextResponse.json({ error: 'Google login is disabled' }, { status: 503 });
    }

    assertGoogleLoginConfig(config);

    const state = crypto.randomBytes(24).toString('base64url');
    const returnTo = sanitizeReturnTo(requestUrl.searchParams.get('returnTo'));
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'select_account');

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      ...getGoogleOAuthCookieOptions(request),
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: state,
    });
    response.cookies.set({
      ...getGoogleOAuthCookieOptions(request),
      name: GOOGLE_OAUTH_RETURN_COOKIE,
      value: returnTo,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google login could not start';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
