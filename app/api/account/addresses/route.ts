import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { OdooService } from '@/lib/odoo/services';

export async function GET() {
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const partnerId = await OdooService.getPartnerByEmail(user.email);
    if (!partnerId) {
      return NextResponse.json([]);
    }

    const addresses = await OdooService.getPartnerAddresses(partnerId);
    return NextResponse.json(addresses);
  } catch (error) {
    console.error('API Address Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const partnerId = await OdooService.getPartnerByEmail(user.email);
    if (!partnerId) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const addressId = await OdooService.savePartnerAddress(partnerId, data);
    return NextResponse.json({ success: true, id: addressId });
  } catch (error) {
    console.error('API Address Save Error:', error);
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await OdooService.deletePartnerAddress(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Address Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}
