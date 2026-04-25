import { NextResponse } from 'next/server';
import {
  CUSTOMER_SESSION_COOKIE,
  getCustomerSessionCookieOptions,
  signCustomerSession,
  verifyCustomerEmailToken,
} from '@/lib/customer-auth';
import { getRequestUrl } from '@/lib/google-login';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';

  try {
    const customer = await verifyCustomerEmailToken(token);
    const sessionToken = await signCustomerSession(customer);
    const response = NextResponse.redirect(getRequestUrl('/account/orders', request));

    response.cookies.set({
      ...getCustomerSessionCookieOptions(request),
      name: CUSTOMER_SESSION_COOKIE,
      value: sessionToken,
    });

    return response;
  } catch {
    return NextResponse.redirect(getRequestUrl('/auth/login?verification=failed', request));
  }
}
