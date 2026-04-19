import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyGoogleUserSession, GOOGLE_USER_COOKIE } from '@/lib/google-login';
import { OdooService } from '@/lib/odoo/services';

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(GOOGLE_USER_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifyGoogleUserSession(token);
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
  const allowed = ['name', 'phone', 'street', 'street2', 'city', 'zip'] as const;
  const update: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body[key] === 'string') {
      update[key] = body[key].trim();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  const partnerId = await OdooService.getPartnerByEmail(user.email);
  if (!partnerId) {
    return NextResponse.json({ error: 'Partner not found in Odoo' }, { status: 404 });
  }

  const result = await OdooService.updatePartnerProfile(partnerId, update);
  if (!result.success) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
