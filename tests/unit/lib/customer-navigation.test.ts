import { describe, expect, it } from 'vitest';
import { buildCustomerLoginHref } from '@/lib/customer-navigation';

describe('customer navigation', () => {
  it('returns to the current page after login', () => {
    expect(buildCustomerLoginHref('/cart')).toBe('/auth/login?returnTo=%2Fcart');
    expect(buildCustomerLoginHref('/shop?category=rings&page=2')).toBe(
      '/auth/login?returnTo=%2Fshop%3Fcategory%3Drings%26page%3D2',
    );
  });

  it('does not build a returnTo loop on auth pages', () => {
    expect(buildCustomerLoginHref('/auth/login')).toBe('/auth/login');
    expect(buildCustomerLoginHref('/auth/register')).toBe('/auth/login');
  });
});
