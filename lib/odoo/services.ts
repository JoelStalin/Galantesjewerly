import { createOdooClient } from '@/src/config/odooClient';

const client = createOdooClient();

type OdooIdName = [number, string];

type OdooCmsSettingsRecord = {
  site_title?: string | null;
  site_description?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  hero_image_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  whatsapp_number?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  appointment_email?: string | null;
  navigation_json?: string | null;
};

type OdooOrderRecord = {
  id: number;
  name: string;
  date_order?: string | null;
  state: string;
  amount_untaxed?: number;
  amount_tax?: number;
  amount_total: number;
  invoice_status: string;
  access_url?: string | null;
  partner_id?: OdooIdName | number | null;
  invoice_ids?: number[];
  order_line?: number[];
  picking_ids?: number[];
};

type OdooInvoiceRecord = {
  id: number;
  name: string;
  invoice_date?: string | null;
  state: string;
  amount_total: number;
  payment_state: string;
  display_status: string;
  portal_url?: string | null;
  pdf_url?: string | null;
  access_url?: string | null;
  access_token?: string | null;
};

type OdooOrderLineRecord = {
  id: number;
  product_id?: OdooIdName | number | null;
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
  price_total: number;
  product_template_id?: OdooIdName | number | null;
};

type OdooTrackingRecord = {
  id: number;
  name?: string;
  state: string;
  carrier_tracking_ref?: string | null;
  carrier_id?: OdooIdName | null;
  date_done?: string | null;
};

type OdooPartnerProfileRecord = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  street2?: string | null;
  city?: string | null;
  zip?: string | null;
  country_id?: OdooIdName | null;
  state_id?: OdooIdName | null;
};

type OdooAddressInput = {
  id?: number;
  name?: string;
  phone?: string;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  state_id?: number;
  country_id?: number;
  type?: 'delivery' | 'invoice' | 'other';
  [key: string]: string | number | boolean | null | undefined;
};

type StripeBillingData = {
  paymentIntentId: string;
  chargeId?: string | null;
  amount: number;
  currency: string;
  receiptUrl?: string | null;
  customerEmail?: string | null;
  paymentStatus: string;
};

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
  shop_hero_image_url?: string;
  site_title: string;
  site_description: string;
  instagram_url?: string;
  facebook_url?: string;
  whatsapp_number?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  appointment_email?: string;
  navigation_links?: { label: string; href: string }[];
}

export interface OrderLine {
  product_id: number;
  product_uom_qty: number;
  price_unit: number;
  name?: string;
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
      }) as OdooCmsSettingsRecord[];

      if (cmsSettings && cmsSettings.length > 0) {
        const s = cmsSettings[0];
        let navLinks: NonNullable<SiteSettings['navigation_links']> = [];
        try {
          const parsed = s.navigation_json ? JSON.parse(s.navigation_json) : [];
          navLinks = Array.isArray(parsed) ? parsed as NonNullable<SiteSettings['navigation_links']> : [];
        } catch (e) {
          console.error('Failed to parse nav links', e);
        }
        return {
          site_title: s.site_title ?? undefined,
          site_description: s.site_description ?? undefined,
          logo_url: s.logo_url ?? undefined,
          favicon_url: s.favicon_url ?? undefined,
          hero_image_url: s.hero_image_url ?? undefined,
          instagram_url: s.instagram_url ?? undefined,
          facebook_url: s.facebook_url ?? undefined,
          whatsapp_number: s.whatsapp_number ?? undefined,
          contact_email: s.contact_email ?? undefined,
          contact_phone: s.contact_phone ?? undefined,
          contact_address: s.contact_address ?? undefined,
          appointment_email: s.appointment_email ?? undefined,
          navigation_links: navLinks,
        };
      }
      return {};
    } catch {
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
      }) as Array<{ id: number }>;
      return (existing && existing.length > 0) ? existing[0].id : null;
    } catch (error) {
      console.warn('[OdooService] Partner search failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  },

  async findOrCreateCustomer(data: CustomerData & { country?: string; state?: string }) {
    try {
      const existing = await this.getPartnerByEmail(data.email);
      if (existing) return existing;

      let countryId = data.country_id || 233; // Default to US
      let stateId = data.state_id;

      const countryName = data.country?.trim() || '';
      const isDR = countryName === 'Dominican Republic' || countryName === 'República Dominicana' || countryName === 'Republica Dominicana';
      const isUS = countryName === 'United States';

      if (isDR) {
        countryId = 62;
      } else if (isUS) {
        countryId = 233;
      }

      // Special handling for Florida state ID if name provided but no ID
      if (data.state?.toUpperCase() === 'FL' || data.state?.toLowerCase() === 'florida') {
        stateId = 10;
      }

      return await client.create('res.partner', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        street: data.street,
        city: data.city,
        zip: data.zip,
        state_id: stateId,
        country_id: countryId,
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

  async syncAuthenticatedUser(data: { email: string; name: string; authMethod: 'google' | 'password'; google_id?: string }) {
    return await this.syncCustomerProfile({
      ...data,
      lastAuthAt: new Date().toISOString()
    });
  },

  async createOrder(partnerId: number, lines: OrderLine[]) {
    try {
      const lineVals = lines.map(l => [0, 0, {
        product_id: l.product_id,
        product_uom_qty: l.product_uom_qty,
        price_unit: l.price_unit,
        ...(l.name ? { name: l.name } : {}),
      }]);
      return await client.create('sale.order', {
        partner_id: partnerId,
        order_line: lineVals,
      });
    } catch (error) {
      console.error('Odoo Order Creation Error:', error);
      return null;
    }
  },

  async getProductVariantIdByDefaultCode(defaultCode: string) {
    try {
      const templates = await client.call('product.template', 'search_read', {
        domain: [['default_code', '=', defaultCode]],
        fields: ['id', 'product_variant_id'],
        limit: 1,
      });

      const templateVariant = templates?.[0]?.product_variant_id;
      if (Array.isArray(templateVariant)) {
        return typeof templateVariant[0] === 'number' ? templateVariant[0] : null;
      }

      if (typeof templateVariant === 'number' && Number.isFinite(templateVariant)) {
        return templateVariant;
      }

      const products = await client.call('product.product', 'search_read', {
        domain: [['default_code', '=', defaultCode]],
        fields: ['id'],
        limit: 1,
      });
      return (products && products.length > 0) ? products[0].id : null;
    } catch (error) {
      console.error('Odoo Product Lookup Error:', error);
      return null;
    }
  },

  async automateBillingFlow(orderId: number, stripeData?: StripeBillingData) {
    try {
      // 1. Fetch current order state
      const orders = await client.call('sale.order', 'read', { ids: [orderId], fields: ['state', 'invoice_status', 'invoice_ids', 'picking_ids'] }) as Array<OdooOrderRecord>;
      if (!orders || orders.length === 0) throw new Error('Order not found');

      // 2. Normalize Stripe data for Odoo
      const stripeVals = stripeData ? {
        payment_intent_id: stripeData.paymentIntentId,
        charge_id: stripeData.chargeId || false,
        amount: stripeData.amount,
        currency: stripeData.currency,
        receipt_url: stripeData.receiptUrl,
        customer_email: stripeData.customerEmail,
        payment_status: stripeData.paymentStatus,
      } : false;

      // 3. Call Odoo finalization action (custom logic in galantes_jewelry module)
      const result = await client.call('sale.order', 'action_galantes_finalize_paid_checkout', {
        ids: [orderId],
        stripe_payment: stripeVals,
      }) as OdooOrderRecord[];

      // The action returns a list with the updated order details
      const finalizedOrder = (Array.isArray(result) && result.length > 0) ? result[0] : null;

      if (!finalizedOrder || (!finalizedOrder.invoice_ids?.length && finalizedOrder.state !== 'cancel')) {
        // Log in Odoo if it didn't cancel but also didn't invoice
        if (finalizedOrder?.state !== 'cancel') {
          await client.call('sale.order', 'message_post', {
            ids: [orderId],
            body: 'Billing finalization completed without creating or linking an invoice.',
          });
          throw new Error('Billing finalization completed without creating or linking an invoice.');
        }
      }

      return {
        success: true,
        orderId,
        invoiceId: finalizedOrder?.invoice_ids?.[0] || null,
        pickingIds: finalizedOrder?.picking_ids || [],
        steps: ['confirmed', 'finalized']
      };
    } catch (error) {
      console.error('Odoo Billing Automation Error:', error);
      // Log failure in Odoo chatter
      try {
        await client.call('sale.order', 'message_post', {
          ids: [orderId],
          body: `Billing Automation Failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      } catch { /* ignore */ }
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  async getOrderWithInvoices(orderId: number) {
    const orders = await client.call('sale.order', 'search_read', {
      domain: [['id', '=', orderId]],
      fields: ['name', 'date_order', 'state', 'amount_total', 'invoice_status', 'access_url', 'partner_id', 'invoice_ids'],
      limit: 1
    }) as OdooOrderRecord[];
    if (!orders || orders.length === 0) return null;
    const o = orders[0];
    let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
    // Internal container networking fix
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
    }

    let invoices: OdooInvoiceRecord[] = [];
    const invoiceIds = o.invoice_ids ?? [];
    if (invoiceIds.length > 0) {
      const invData = await client.call('account.move', 'search_read', {
        domain: [['id', 'in', invoiceIds]],
        fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
      }) as OdooInvoiceRecord[];
      invoices = (invData || []).map((inv) => ({
        ...inv,
        display_status: this.mapInvoiceState(inv.state, inv.payment_state),
        portal_url: buildPortalUrl(baseUrl, inv.access_url),
        pdf_url: buildInvoicePdfUrl(baseUrl, inv.access_url, inv.access_token),
      }));
    }

    return {
      ...o,
      display_status: this.mapOrderState(o.state, o.invoice_status),
      portal_url: o.access_url ? `${baseUrl}${o.access_url}` : null,
      invoices,
    };
  },

  async syncCompanyProfile(settings: {
    site_title?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_address?: string;
    instagram_url?: string;
    facebook_url?: string;
    whatsapp_number?: string;
  }) {
    try {
      // Prefer the US country record, but fall back to the standard US id so state lookup still runs.
      const countries = await client.call('res.country', 'search_read', { domain: [['code', '=', 'US']], fields: ['id'], limit: 1 }) as Array<{ id: number }>;
      const countryId = countries?.[0]?.id || 233;

      // Simple address parsing for Islamorada
      const vals: Record<string, string | number | null | undefined> = {
        email: settings.contact_email,
        phone: settings.contact_phone,
        street: settings.contact_address?.split(',')[0]?.trim(),
        city: 'Islamorada',
        zip: '33036',
        country_id: countryId,
      };

      if (settings.contact_address) {
        const stateMatch = settings.contact_address.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*,/i);
        const stateCode = stateMatch?.[1]?.toUpperCase() || 'FL';
        const states = await client.call('res.country.state', 'search_read', {
          domain: [['code', '=', stateCode], ['country_id', '=', countryId]],
          fields: ['id'],
          limit: 1
        }) as Array<{ id: number }>;
        if (states?.length > 0) vals.state_id = states[0].id;
      }

      // Write to company 1
      await client.call('res.company', 'write', { ids: [1], vals });
      return true;
    } catch (error) {
      console.error('Company Sync Error:', error);
      return false;
    }
  },

  async getOrderDetails(orderId: number, authenticatedEmail?: string) {
    try {
      const orders = await client.call('sale.order', 'search_read', {
        domain: [['id', '=', orderId]],
        fields: ['name', 'date_order', 'state', 'amount_untaxed', 'amount_tax', 'amount_total', 'invoice_status', 'order_line', 'access_url', 'partner_id'],
        limit: 1
      }) as OdooOrderRecord[];
      if (!orders || orders.length === 0) return null;
      const order = orders[0];

      if (authenticatedEmail) {
        const partnerId = await this.getPartnerByEmail(authenticatedEmail);
        const orderPartnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id;
        if (!partnerId || !orderPartnerId || partnerId !== orderPartnerId) {
          return null;
        }
      }

      let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
    // Internal container networking fix
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
    }
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

  async getPartnerOrders(partnerId: number) {
    try {
      const orders = await client.call('sale.order', 'search_read', {
        domain: [['partner_id', '=', partnerId]],
        fields: ['id', 'name', 'date_order', 'state', 'amount_total', 'invoice_status', 'access_url', 'invoice_ids'],
        order: 'date_order desc'
      }) as OdooOrderRecord[];
      let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
    // Internal container networking fix
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
    }
      return (orders || []).map((o) => ({
        ...o,
        display_status: this.mapOrderState(o.state, o.invoice_status),
        portal_url: o.access_url ? `${baseUrl}${o.access_url}` : null,
      }));
    } catch (error) {
      console.error('Odoo Partner Orders Fetch Error:', error);
      return [];
    }
  },

  async getOrdersWithInvoices(partnerId: number, authenticatedEmail?: string) {
    try {
      if (authenticatedEmail) {
        const partner = await client.call('res.partner', 'search_read', {
          domain: [['id', '=', partnerId]],
          fields: ['email'],
          limit: 1,
        }) as Array<{ email?: string | null }>;

        const resolvedEmail = partner?.[0]?.email || '';
        if (!resolvedEmail || resolvedEmail.toLowerCase() !== authenticatedEmail.toLowerCase()) {
          return [];
        }
      }

      const orders = await this.getPartnerOrders(partnerId);
      if (!orders || orders.length === 0) return [];

      let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
    // Internal container networking fix
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
    }
      const allInvoiceIds: number[] = orders.flatMap((o) => o.invoice_ids || []);

      const invoiceMap: Record<number, OdooInvoiceRecord[]> = {};
      if (allInvoiceIds.length > 0) {
        const invoices = await client.call('account.move', 'search_read', {
          domain: [['id', 'in', allInvoiceIds], ['move_type', '=', 'out_invoice']],
          fields: ['id', 'name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
        }) as OdooInvoiceRecord[];

        for (const inv of (invoices || [])) {
          const enriched: OdooInvoiceRecord = {
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

      return orders.map((o) => ({
        ...o,
        invoices: invoiceMap[o.id] || [],
      }));
    } catch (error) {
      console.warn('[OdooService] Orders+Invoices fetch failed:', error);
      return [];
    }
  },

  async getPartnerInvoices(partnerId: number) {
    try {
      const invoices = await client.call('account.move', 'search_read', {
        domain: [['partner_id', '=', partnerId], ['move_type', '=', 'out_invoice']],
        fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
        order: 'invoice_date desc'
      }) as OdooInvoiceRecord[];
      let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
    // Internal container networking fix
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
    }
      return (invoices || []).map((inv) => ({
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
      }) as OdooPartnerProfileRecord[];
    } catch (error) {
      console.error('Odoo Partner Addresses Fetch Error:', error);
      return [];
    }
  },

  async savePartnerAddress(partnerId: number, data: OdooAddressInput) {
    try {
      const vals: OdooAddressInput = { parent_id: partnerId, ...data };
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
    let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
    // Internal container networking fix
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
    }
    const db = process.env.ODOO_DATABASE || process.env.ODOO_DB || 'galantes_prod';
    
    const fields = ['image_256', 'image_1920'];
    
    // Attempt 1: Direct HTTP Fetch (Fastest, best for cache)
    for (const field of fields) {
      const urls = [
        `${baseUrl}/web/image/product.template/${templateId}/${field}?db=${db}`,
        `${baseUrl}/web/image?model=product.template&id=${templateId}&field=${field}&db=${db}`
      ];

      for (const url of urls) {
        try {
          const response = await fetch(url, {
            next: { revalidate: 3600 }
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > 9000) {
              return Buffer.from(buffer).toString('base64');
            }
          }
        } catch (error) {
          // Silent fail to next attempt
        }
      }
    }

    // Attempt 2: Odoo API Call (Most reliable, uses credentials)
    console.log(`[OdooService] HTTP fetch failed or returned placeholders for ${templateId}, trying API fallback...`);
    try {
      const result = await client.call('product.template', 'read', {
        ids: [templateId],
        fields: ['image_1920', 'image_256'], // Try high-res first
      }) as Array<{ image_256?: string | null; image_1920?: string | null }>;

      if (result && result.length > 0) {
        const p = result[0];
        // Check image_1920 first, then image_256
        const images = [p.image_1920, p.image_256];
        for (const img of images) {
          if (img && img.length > 12000) { // Base64 length for ~9KB is ~12000 chars
            console.log(`[OdooService] Success via API for ${templateId} using ${img === p.image_1920 ? '1920' : '256'}`);
            return img;
          }
        }
      }
    } catch (apiError) {
      console.error(`[OdooService] API fallback failed for ${templateId}:`, apiError);
    }

    return null;
  },

  async getOrderFullDetails(orderId: number, authenticatedEmail?: string) {
    try {
      const order = await this.getOrderDetails(orderId, authenticatedEmail);
      if (!order) return null;

      const orderLineIds = order.order_line ?? [];
      const lines = await client.call('sale.order.line', 'search_read', {
        domain: [['id', 'in', orderLineIds]],
        fields: ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'price_total', 'product_template_id']
      }) as OdooOrderLineRecord[];

      let tracking: OdooTrackingRecord[] = [];
      if (order.picking_ids && order.picking_ids.length > 0) {
        tracking = await client.call('stock.picking', 'search_read', {
          domain: [['id', 'in', order.picking_ids]],
          fields: ['name', 'state', 'carrier_tracking_ref', 'carrier_id', 'date_done']
        }) as OdooTrackingRecord[];
      }

      return {
        ...order,
        lines: (lines || []).map((l) => ({
          ...l,
          image_url: `/api/products/image?id=${Array.isArray(l.product_template_id) ? l.product_template_id[0] : l.product_template_id}`,
        })),
        tracking: (tracking || []).map((t) => ({
          ...t,
          carrier_name: Array.isArray(t.carrier_id) ? t.carrier_id[1] : 'Standard Shipping',
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
      }) as OdooPartnerProfileRecord[];
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

  async updatePartnerProfile(partnerId: number, data: Partial<OdooAddressInput>) {
    try {
      await client.call('res.partner', 'write', { ids: [partnerId], vals: data });
      return { success: true };
    } catch (error) {
      console.error('Odoo Profile Update Error:', error);
      return { success: false, error: String(error) };
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
