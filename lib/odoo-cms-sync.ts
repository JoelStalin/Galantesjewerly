import { createOdooClient } from '@/src/config/odooClient.js';
import { SiteSettings } from '@/lib/db';

/**
 * Synchronizes SiteSettings from Next.js (SQLite) to Odoo (PostgreSQL)
 * This ensures branding and contact info are persisted in the ERP.
 */
export async function syncSettingsToOdoo(settings: SiteSettings) {
  try {
    const odoo = createOdooClient();
    
    // We expect a custom model 'galante.cms.settings' in Odoo.
    // If it doesn't exist yet, this will fail gracefully.
    
    const payload = {
      site_title: settings.site_title,
      site_description: settings.site_description,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      hero_image_url: settings.hero_image_url,
      instagram_url: settings.instagram_url || '',
      facebook_url: settings.facebook_url || '',
      whatsapp_number: settings.whatsapp_number || '',
      contact_email: settings.contact_email || '',
      contact_phone: settings.contact_phone || '',
      contact_address: settings.contact_address || '',
      appointment_email: settings.appointment_email || '',
      navigation_json: JSON.stringify(settings.navigation_links),
    };

    console.log('[Odoo Sync] Syncing CMS settings...', payload);

    // Using search_read to find existing settings record (usually there's only one)
    const existing = await odoo.searchRead('galante.cms.settings', {
      domain: [],
      fields: ['id'],
      limit: 1,
    }) as any[];

    if (existing && existing.length > 0) {
      await odoo.call('galante.cms.settings', 'write', {
        ids: [existing[0].id],
        values: payload
      });
      console.log('[Odoo Sync] CMS settings updated in Odoo.');
    } else {
      await odoo.call('galante.cms.settings', 'create', payload);
      console.log('[Odoo Sync] CMS settings created in Odoo.');
    }

    return { success: true };
  } catch (error) {
    console.error('[Odoo Sync] Failed to sync CMS settings:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
