import { NextResponse } from 'next/server';
import { OdooService } from '@/lib/odoo/services';
import {
  CUSTOMER_SESSION_COOKIE,
  getCustomerSessionCookieOptions,
  registerCustomerAccount,
  signCustomerSession,
} from '@/lib/customer-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const customer = await registerCustomerAccount({
      username,
      name,
      email,
      password: String(body.password || ''),
    });

    try {
      await OdooService.syncCustomerProfile({
        username,
        name,
        email,
        authMethod: 'password',
        registeredAt: new Date().toISOString(),
      });
    } catch (odooError) {
      console.error('Customer register Odoo sync failed (non-blocking):', odooError);
    }

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

