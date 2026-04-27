import { NextResponse } from 'next/server';
import { ShippingEngine } from '@/lib/shipping/engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, packageDetails } = body;

    if (!address || !packageDetails) {
      return NextResponse.json({ error: 'Missing shipping details' }, { status: 400 });
    }

    const rates = await ShippingEngine.getRates(address, packageDetails);
    
    return NextResponse.json({
      success: true,
      rates
    });
  } catch (error) {
    console.error('Shipping Rates API Error:', error);
    return NextResponse.json({ error: 'Failed to calculate shipping' }, { status: 500 });
  }
}
