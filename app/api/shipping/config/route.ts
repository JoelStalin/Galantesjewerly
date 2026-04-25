import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';
import { getAllowedShippingCities, getShippingCityCatalog } from '@/lib/shipping-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettings();
    const catalog = getShippingCityCatalog(settings);
    const allowedCities = getAllowedShippingCities(settings);

    return NextResponse.json({
      success: true,
      cities: allowedCities,
      catalog,
      restrictedCities: settings.restricted_shipping_cities || [],
      freeformCityAllowed: allowedCities.length === 0,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        cities: [],
        catalog: [],
        restrictedCities: [],
        freeformCityAllowed: true,
      },
      { status: 500 },
    );
  }
}
