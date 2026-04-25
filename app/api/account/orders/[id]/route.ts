import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { OdooService } from '@/lib/odoo/services';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orderId = parseInt(resolvedParams.id, 10);
    const order = await OdooService.getOrderFullDetails(orderId, user.email);
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('API Order Detail Error:', error);
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 });
  }
}
