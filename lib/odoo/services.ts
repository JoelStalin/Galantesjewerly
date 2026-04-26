import { createOdooClient } from '@/src/config/odooClient';

const client = createOdooClient();
let supportsCompanySocialWhatsapp: boolean | null = null;

export interface CustomerData {
  name: string;
  email: string;
  phone?: string;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  state_id?: number;
  country_id?: number;
}

export interface CustomerProfileSyncData extends CustomerData {
  username?: string;
  authMethod?: 'google' | 'password';
  google_id?: string;
  registeredAt?: string;
  lastAuthAt?: string;
}

export interface SiteSettings {
  favicon_url: string;
  logo_url: string;
  hero_image_url?: string;
  site_title: string;
  site_description: string;
  instagram_url?: string;
  facebook_url?: string;
  whatsapp_number?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  appointment_email?: string;
  navigation_links?: any[];
}

export interface OrderLine {
  product_id: number;
  product_uom_qty: number;
  price_unit: number;
}

function buildPortalUrl(baseUrl: string, accessUrl?: string | null) {
  return accessUrl ? `${baseUrl}${accessUrl}` : null;
}

function buildInvoicePdfUrl(baseUrl: string, accessUrl?: string | null, accessToken?: string | null) {
  if (!accessUrl) return null;
  const separator = accessUrl.includes('?') ? '&' : '?';
  const normalizedToken = accessToken && !accessUrl.includes('access_token=')
    ? `&access_token=${encodeURIComponent(accessToken)}`
    : '';
  return `${baseUrl}${accessUrl}${separator}report_type=pdf&download=true${normalizedToken}`;
}

export const OdooService = {
  async getCompanySettings(): Promise<Partial<SiteSettings>> {
    const config = client.getConfig();
    if (!config.enabled || !config.isReady) return {};

    try {
      const cmsSettings = await client.searchRead('galante.cms.settings', {
        domain: [],
        fields: ['site_title', 'site_description', 'logo_url', 'favicon_url', 'hero_image_url', 'instagram_url', 'facebook_url', 'whatsapp_number', 'contact_email', 'contact_phone', 'contact_address', 'appointment_email', 'navigation_json'],
        limit: 1
      }) as any[];

      if (cmsSettings && cmsSettings.length > 0) {
        const s = cmsSettings[0];
        let navLinks = [];
        try { navLinks = s.navigation_json ? JSON.parse(s.navigation_json) : []; } catch (e) { console.error('Failed to parse nav links', e); }
        return {
          site_title: s.site_title,
          site_description: s.site_description,
          logo_url: s.logo_url,
          favicon_url: s.favicon_url,
          hero_image_url: s.hero_image_url,
          instagram_url: s.instagram_url,
          facebook_url: s.facebook_url,
          whatsapp_number: s.whatsapp_number,
          contact_email: s.contact_email,
          contact_phone: s.contact_phone,
          contact_address: s.contact_address,
          appointment_email: s.appointment_email,
          navigation_links: navLinks,
        };
      }
      return {};
    } catch (error) {
      console.warn('[OdooService] Company settings fetch failed, using local CMS data fallback.');
      return {};
    }
  },

  async getPartnerByEmail(email: string) {
    try {
      const existing = await client.call('res.partner', 'search_read', {
        domain: [['email', '=', email]],
        fields: ['id'],
        limit: 1
      });
      return (existing && existing.length > 0) ? existing[0].id : null;
    } catch (error) {
      console.warn('[OdooService] Partner search failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  },

  async findOrCreateCustomer(data: CustomerData) {
    try {
      const existing = await this.getPartnerByEmail(data.email);
      if (existing) return existing;

      return await client.create('res.partner', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        street: data.street,
        city: data.city,
        zip: data.zip,
        state_id: data.state_id,
        country_id: data.country_id || 233,
        customer_rank: 1,
      });
    } catch (error) {
      console.warn('[OdooService] Partner creation failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  },

  async syncCustomerProfile(data: CustomerProfileSyncData) {
    try {
      const partnerId = await this.findOrCreateCustomer(data);
      if (!partnerId) return null;

      const vals: Record<string, unknown> = {
        customer_rank: 1,
        galantes_customer_source: data.authMethod || 'unknown',
        galantes_customer_last_auth_at: data.lastAuthAt || new Date().toISOString(),
      };

      await client.call('res.partner', 'write', { ids: [partnerId], vals });
      return partnerId;
    } catch (error) {
      console.warn('[OdooService] User profile sync failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  },

  async getOrderDetails(orderId: number, authenticatedEmail?: string) {
    try {
      const orders = await client.call('sale.order', 'search_read', {
        domain: [['id', '=', orderId]],
        fields: ['name', 'date_order', 'state', 'amount_total', 'invoice_status', 'order_line', 'access_url', 'partner_id'],
        limit: 1
      });
      if (!orders || orders.length === 0) return null;
      const order = orders[0];
      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';
      return {
        ...order,
        display_status: this.mapOrderState(order.state, order.invoice_status),
        portal_url: order.access_url ? `${baseUrl}${order.access_url}` : null,
      };
    } catch (error) {
      console.error('Odoo Order Fetch Error:', error);
      return null;
    }
  },

  async getPartnerOrders(partnerId: number, authenticatedEmail?: string) {
    try {
      const orders = await client.call('sale.order', 'search_read', {
        domain: [['partner_id', '=', partnerId]],
        fields: ['name', 'date_order', 'state', 'amount_total', 'invoice_status', 'access_url'],
        order: 'date_order desc'
      });
      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';
      return (orders || []).map((o: any) => ({
        ...o,
        display_status: this.mapOrderState(o.state, o.invoice_status),
        portal_url: o.access_url ? `${baseUrl}${o.access_url}` : null,
      }));
    } catch (error) {
      console.error('Odoo Partner Orders Fetch Error:', error);
      return [];
    }
  },

  async getPartnerInvoices(partnerId: number, authenticatedEmail?: string) {
    try {
      const invoices = await client.call('account.move', 'search_read', {
        domain: [['partner_id', '=', partnerId], ['move_type', '=', 'out_invoice']],
        fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
        order: 'invoice_date desc'
      });
      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';
      return (invoices || []).map((inv: any) => ({
        ...inv,
        display_status: this.mapInvoiceState(inv.state, inv.payment_state),
        portal_url: buildPortalUrl(baseUrl, inv.access_url),
        pdf_url: buildInvoicePdfUrl(baseUrl, inv.access_url, inv.access_token),
      }));
    } catch (error) {
      console.error('Odoo Partner Invoices Fetch Error:', error);
      return [];
    }
  },

  async getPartnerAddresses(partnerId: number) {
    try {
      return await client.call('res.partner', 'search_read', {
        domain: [['parent_id', '=', partnerId], ['type', 'in', ['delivery', 'invoice', 'other']]],
        fields: ['id', 'name', 'type', 'email', 'phone', 'street', 'street2', 'city', 'zip', 'state_id', 'country_id'],
        order: 'type asc'
      });
    } catch (error) {
      console.error('Odoo Partner Addresses Fetch Error:', error);
      return [];
    }
  },

  async savePartnerAddress(partnerId: number, data: any) {
    try {
      const vals = { parent_id: partnerId, ...data };
      if (data.id) {
        await client.call('res.partner', 'write', { ids: [data.id], vals });
        return data.id;
      }
      return await client.create('res.partner', vals);
    } catch (error) {
      console.error('Odoo Address Save Error:', error);
      return null;
    }
  },

  async deletePartnerAddress(addressId: number) {
    try {
      return await client.call('res.partner', 'write', { ids: [addressId], vals: { active: false } });
    } catch (error) {
      console.error('Odoo Address Delete Error:', error);
      return false;
    }
  },

  async getProductImage(templateId: number) {
    try {
      const products = await client.call('product.template', 'read', { ids: [templateId], fields: ['image_256'] });
      return (products && products.length > 0) ? products[0].image_256 : null;
    } catch (error) {
      console.error('Odoo Product Image Fetch Error:', error);
      return null;
    }
  },

  async getOrderFullDetails(orderId: number, authenticatedEmail?: string) {
    try {
      const order = await this.getOrderDetails(orderId, authenticatedEmail);
      if (!order) return null;

      const lines = await client.call('sale.order.line', 'search_read', {
        domain: [['id', 'in', order.order_line]],
        fields: ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'price_total', 'product_template_id']
      });

      let tracking = [];
      if (order.picking_ids && order.picking_ids.length > 0) {
        tracking = await client.call('stock.picking', 'search_read', {
          domain: [['id', 'in', order.picking_ids]],
          fields: ['name', 'state', 'carrier_tracking_ref', 'carrier_id', 'date_done']
        });
      }

      return {
        ...order,
        lines: (lines || []).map((l: any) => ({
          ...l,
          image_url: `/api/products/image?id=${l.product_template_id[0]}`
        })),
        tracking: (tracking || []).map((t: any) => ({
          ...t,
          carrier_name: t.carrier_id ? t.carrier_id[1] : 'Standard Shipping'
        }))
      };
    } catch (error) {
      console.error('Odoo Order Full Details Error:', error);
      return null;
    }
  },

  async getPartnerProfile(partnerId: number) {
    try {
      const partners = await client.call('res.partner', 'search_read', {
        domain: [['id', '=', partnerId]],
        fields: ['name', 'email', 'phone', 'street', 'street2', 'city', 'zip', 'country_id', 'state_id'],
        limit: 1,
      });
      if (!partners || partners.length === 0) return null;
      const p = partners[0];
      return {
        ...p,
        country_name: p.country_id ? p.country_id[1] : '',
        state_name: p.state_id ? p.state_id[1] : '',
      };
    } catch (error) {
      console.error('Odoo Profile Fetch Error:', error);
      return null;
    }
  },

  async updatePartnerProfile(partnerId: number, data: any) {
    try {
      await client.call('res.partner', 'write', { ids: [partnerId], vals: data });
      return { success: true };
    } catch (error) {
      console.error('Odoo Profile Update Error:', error);
      return { success: false, error: String(error) };
    }
  },

  async getOrdersWithInvoices(partnerId: number, authenticatedEmail?: string) {
    try {
      const orders = await this.getPartnerOrders(partnerId, authenticatedEmail);
      if (!orders || orders.length === 0) return [];

      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';
      const allInvoiceIds: number[] = orders.flatMap((o: any) => o.invoice_ids || []);

      let invoiceMap: Record<number, any[]> = {};
      if (allInvoiceIds.length > 0) {
        const invoices = await client.call('account.move', 'search_read', {
          domain: [['id', 'in', allInvoiceIds], ['move_type', '=', 'out_invoice']],
          fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
        });

        for (const inv of (invoices || [])) {
          const enriched = {
            ...inv,
            display_status: this.mapInvoiceState(inv.state, inv.payment_state),
            portal_url: buildPortalUrl(baseUrl, inv.access_url),
            pdf_url: buildInvoicePdfUrl(baseUrl, inv.access_url, inv.access_token),
          };
          for (const order of orders) {
            if ((order.invoice_ids || []).includes(inv.id)) {
              if (!invoiceMap[order.id]) invoiceMap[order.id] = [];
              invoiceMap[order.id].push(enriched);
            }
          }
        }
      }

      return orders.map((o: any) => ({
        ...o,
        invoices: invoiceMap[o.id] || [],
      }));
    } catch (error) {
      console.warn('[OdooService] Orders+Invoices fetch failed:', error);
      return [];
    }
  },

  mapOrderState(state: string, invoiceStatus: string): string {
    const states: Record<string, string> = { 'draft': 'Quotation', 'sent': 'Quotation Sent', 'sale': 'Confirmed', 'done': 'Locked', 'cancel': 'Cancelled' };
    if (state === 'sale' && invoiceStatus === 'invoiced') return 'Completed & Invoiced';
    if (state === 'sale' && invoiceStatus === 'to invoice') return 'Ready to Invoice';
    return states[state] || state;
  },

  mapInvoiceState(state: string, paymentState: string): string {
    if (paymentState === 'paid') return 'Paid';
    if (paymentState === 'in_payment') return 'Processing Payment';
    if (paymentState === 'partial') return 'Partially Paid';
    const states: Record<string, string> = { 'draft': 'Draft', 'posted': 'Posted', 'cancel': 'Cancelled' };
    return states[state] || state;
  }
};
