/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  getAllowedShippingCities,
  normalizeCityList,
  sanitizeShippingSettings,
  validateShippingCity,
} from '@/lib/shipping-settings';

describe('shipping settings helpers', () => {
  it('normalizes and deduplicates shipping city lists', () => {
    expect(normalizeCityList(['  Miami  ', 'miami', 'Key Largo', '', 'Key   Largo'])).toEqual([
      'Miami',
      'Key Largo',
    ]);
  });

  it('filters restricted cities to the configured catalog', () => {
    expect(
      sanitizeShippingSettings({
        shipping_cities: ['Miami', 'Islamorada'],
        restricted_shipping_cities: ['Islamorada', 'Santo Domingo'],
      }),
    ).toMatchObject({
      shipping_cities: ['Miami', 'Islamorada'],
      restricted_shipping_cities: ['Islamorada'],
    });
  });

  it('returns the restricted subset when restrictions exist', () => {
    expect(
      getAllowedShippingCities({
        shipping_cities: ['Miami', 'Islamorada', 'Key Largo'],
        restricted_shipping_cities: ['Islamorada', 'Key Largo'],
      }),
    ).toEqual(['Islamorada', 'Key Largo']);
  });

  it('rejects cities that are not currently allowed', () => {
    expect(
      validateShippingCity(
        {
          shipping_cities: ['Miami', 'Islamorada'],
          restricted_shipping_cities: ['Islamorada'],
        },
        'Miami',
      ),
    ).toEqual({
      valid: false,
      message: 'Shipping is not available for the selected city.',
    });
  });

  it('accepts any non-empty city when no catalog is configured', () => {
    expect(
      validateShippingCity(
        {
          shipping_cities: [],
          restricted_shipping_cities: [],
        },
        'Santo Domingo',
      ),
    ).toEqual({
      valid: true,
      city: 'Santo Domingo',
    });
  });
});
