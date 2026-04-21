import { NextResponse } from 'next/server';
import {
  CUSTOMER_SESSION_COOKIE,
  getCustomerSessionCookieOptions,
  registerCustomerAccount,
  signCustomerSession,
} from '@/lib/customer-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = await registerCustomerAccount({
      username: String(body.username || '').trim(),
      name: String(body.name || '').trim(),
      email: String(body.email || '').trim(),
      password: String(body.password || ''),
    });

    const token = await signCustomerSession(customer);
    const response = NextResponse.json({
      success: true,
      user: customer,
    });

    response.cookies.set({
      ...getCustomerSessionCookieOptions(request),
      name: CUSTOMER_SESSION_COOKIE,
      value: token,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create the account.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

