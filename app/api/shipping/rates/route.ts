import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ShippingEngine } from '@/lib/shipping/engine';
import { getSettings } from '@/lib/db';
import { validateShippingCity } from '@/lib/shipping-settings';

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional().default(''),
  zip: z.string().min(1),
  country: z.string().optional().default('United States'),
});

const packageSchema = z.object({
  weightLbs: z.number().positive(),
  value: z.number().nonnegative(),
});

async function getShippingSettingsWithFallback(timeoutMs = 1200) {
  try {
    const settingsPromise = getSettings();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([settingsPromise, timeoutPromise]) || {};
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = addressSchema.parse(body.address);
    const packageDetails = packageSchema.parse(body.packageDetails);

    const settings = await getShippingSettingsWithFallback();
    const cityCheck = validateShippingCity(settings, address.city);
    if (!cityCheck.valid) {
      return NextResponse.json({ error: cityCheck.message || 'Shipping is not available for the selected city.' }, { status: 400 });
    }

    const rates = await ShippingEngine.getRates(address, packageDetails);
    
    return NextResponse.json({
      success: true,
      rates
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid shipping details' }, { status: 400 });
    }
    console.error('Shipping Rates API Error:', error);
    return NextResponse.json({ error: 'Failed to calculate shipping' }, { status: 500 });
  }
}
