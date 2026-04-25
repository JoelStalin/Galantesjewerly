/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getAuthenticatedCustomerFromCookies: vi.fn(),
  getCompanySettings: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    ...actual,
    getSettings: mocks.getSettings,
  };
});

vi.mock('@/lib/customer-auth', () => ({
  getAuthenticatedCustomerFromCookies: mocks.getAuthenticatedCustomerFromCookies,
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    getCompanySettings: mocks.getCompanySettings,
  },
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('next/font/google', () => ({
  Outfit: () => ({
    variable: '--font-outfit',
    className: 'font-outfit',
    style: { fontFamily: 'Outfit' },
  }),
}));

describe('app layout metadata', () => {
  it('uses the admin brand_name as the browser title', async () => {
    mocks.getSettings.mockResolvedValue({
      brand_name: 'Galantes Bespoke',
      brand_tagline: 'By The Sea',
      site_title: 'Old SEO Title',
      site_description: 'Luxury jewelry boutique in Islamorada',
      favicon_url: '/favicon.ico',
      logo_url: '/logo.png',
      hero_image_url: '/hero.jpg',
      instagram_url: '',
      facebook_url: '',
      whatsapp_number: '',
      contact_phone: '',
      contact_address: '',
      navigation_links: [],
    });
    mocks.getCompanySettings.mockResolvedValue({});

    const { generateMetadata } = await import('@/app/layout');
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('Galantes Bespoke');
    expect(metadata.openGraph?.title).toBe('Galantes Bespoke');
    expect(metadata.openGraph?.siteName).toBe('Galantes Bespoke');
  });
});
