/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  searchRead: vi.fn(),
  call: vi.fn(),
}));

vi.mock('@/src/config/odooClient', () => ({
  createOdooClient: () => ({
    getConfig: () => ({ enabled: true, isReady: true }),
    searchRead: mocks.searchRead,
    call: mocks.call,
  }),
}));

describe('OdooService', () => {
  it('loads company settings without requesting the missing shop hero field', async () => {
    mocks.searchRead.mockResolvedValue([
      {
        site_title: 'Galante\'s Jewelry',
        site_description: 'Luxury jewelry boutique',
        logo_url: '/logo.png',
        favicon_url: '/favicon.ico',
        hero_image_url: '/hero.jpg',
        instagram_url: 'https://instagram.com/galantes',
        facebook_url: 'https://facebook.com/galantes',
        whatsapp_number: '1234567890',
        contact_email: 'concierge@example.com',
        contact_phone: '305-555-0199',
        contact_address: 'Islamorada, FL',
        appointment_email: 'ceo@example.com',
        navigation_json: '[]',
      },
    ]);

    const { OdooService } = await import('@/lib/odoo/services');
    const settings = await OdooService.getCompanySettings();

    expect(mocks.searchRead).toHaveBeenCalledTimes(1);
    expect(mocks.searchRead.mock.calls[0][1].fields).not.toContain('shop_hero_image_url');
    expect(settings.site_title).toBe("Galante's Jewelry");
    expect(settings.hero_image_url).toBe('/hero.jpg');
  });
});
