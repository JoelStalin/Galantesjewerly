import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { OdooService } from '@/lib/odoo/services';

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Whitelist — email is auth-managed, cannot change here
  const allowed = ['name', 'phone', 'street', 'street2', 'city', 'zip', 'state_id', 'country_id'] as const;
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  const partnerId = await OdooService.getPartnerByEmail(user.email)
    || await OdooService.findOrCreateCustomer({
      name: user.name || user.username || user.email,
      email: user.email,
    });
  if (!partnerId) {
    return NextResponse.json({ error: 'Partner not found in Odoo' }, { status: 404 });
  }

  const result = await OdooService.updatePartnerProfile(partnerId, update);
  if (!result.success) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
