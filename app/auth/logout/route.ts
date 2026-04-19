import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GOOGLE_USER_COOKIE, getExpiredGoogleOAuthCookieOptions } from '@/lib/google-login';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url));
  
  // Clear the session cookie
  response.cookies.set({
    ...getExpiredGoogleOAuthCookieOptions(request),
    name: GOOGLE_USER_COOKIE,
    value: '',
  });

  return response;
}
