import { ShippingRate, ShippingAddress, PackageDetails } from './types';
import { getFedExRates } from './fedex';

const DEFAULT_ORIGIN: ShippingAddress = {
  street: '82681 Overseas Highway',
  city: 'Islamorada',
  state: 'FL',
  zip: '33036',
  country: 'United States',
};

/**
 * Galante's Jewelry Shipping Engine
 * Calculates real-time rates including high-value insurance.
 */
export class ShippingEngine {
  
  static async getRates(address: ShippingAddress, pkg: PackageDetails): Promise<ShippingRate[]> {
    const insurancePremium = pkg.value * 0.015; // 1.5% of value for high-value shipping insurance
    const rates: ShippingRate[] = [];

    // 1. Local Pick-up (Always Free, Always available for Islamorada/Florida)
    rates.push({
      carrier: 'pickup',
      serviceName: 'In-Store Pick-up (Islamorada)',
      price: 0,
      currency: 'USD',
      estimatedDays: 0,
      insuranceIncluded: true,
      insuranceValue: pkg.value
    });

    // 2. Carrier options are shown as individual selectable rates.
    // USPS and UPS remain deterministic fallbacks while FedEx can now use the live API.
    rates.push(await this.fetchUSPS(address, pkg, insurancePremium));
    rates.push(await this.fetchUPS(address, pkg, insurancePremium));
    rates.push(...await this.fetchFedEx(address, pkg, insurancePremium));

    return rates.sort((left, right) => {
      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return left.serviceName.localeCompare(right.serviceName);
    });
  }

  private static async fetchUSPS(address: ShippingAddress, pkg: PackageDetails, insurance: number): Promise<ShippingRate> {
    // Placeholder for actual USPS Web Tools API call
    return {
      carrier: 'usps',
      serviceName: 'USPS Priority Mail Express (Insured)',
      price: 35.00 + insurance,
      currency: 'USD',
      estimatedDays: 2,
      insuranceIncluded: true,
      insuranceValue: pkg.value
    };
  }

  private static async fetchUPS(address: ShippingAddress, pkg: PackageDetails, insurance: number): Promise<ShippingRate> {
    // Placeholder for UPS Rating API call
    return {
      carrier: 'ups',
      serviceName: 'UPS Next Day Air (Secure)',
      price: 55.00 + insurance,
      currency: 'USD',
      estimatedDays: 1,
      insuranceIncluded: true,
      insuranceValue: pkg.value
    };
  }

  private static async fetchFedEx(address: ShippingAddress, pkg: PackageDetails, insurance: number): Promise<ShippingRate[]> {
    return getFedExRates(address || DEFAULT_ORIGIN, pkg, insurance);
  }
}
