import { NextResponse } from 'next/server';
import { GOOGLE_USER_COOKIE, getExpiredGoogleOAuthCookieOptions } from '@/lib/google-login';
import { CUSTOMER_SESSION_COOKIE, getExpiredCustomerSessionCookieOptions } from '@/lib/customer-auth';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url));

  response.cookies.set({
    ...getExpiredGoogleOAuthCookieOptions(request),
    name: GOOGLE_USER_COOKIE,
    value: '',
  });

  response.cookies.set({
    ...getExpiredCustomerSessionCookieOptions(request),
    name: CUSTOMER_SESSION_COOKIE,
    value: '',
  });

  return response;
}
