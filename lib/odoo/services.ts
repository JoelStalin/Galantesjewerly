import { createOdooClient } from '@/src/config/odooClient';

const client = createOdooClient();
let supportsCompanySocialWhatsapp: boolean | null = null;

export interface CustomerData {
  name: string;
  email: string;
  phone?: string;
  street?: string;
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
  if (!accessUrl) {
    return null;
  }

  const separator = accessUrl.includes('?') ? '&' : '?';
  const normalizedToken = accessToken && !accessUrl.includes('access_token=')
    ? `&access_token=${encodeURIComponent(accessToken)}`
    : '';

  return `${baseUrl}${accessUrl}${separator}report_type=pdf&download=true${normalizedToken}`;
}

/**
 * Service to handle Odoo business logic for E-commerce
 */
export const OdooService = {
  /**
   * Fetches company settings from Odoo (custom galante.cms.settings model preferred)
   */
  async getCompanySettings(): Promise<Partial<SiteSettings>> {
    const config = client.getConfig();
    if (!config.enabled || !config.isReady) {
      console.log('[OdooService] Odoo is disabled, skipping getCompanySettings');
      return {};
    }

    try {
      // 1. Try custom CMS model
      const cmsSettings = await client.searchRead('galante.cms.settings', {
        domain: [],
        fields: [
          'site_title',
          'site_description',
          'logo_url',
          'favicon_url',
          'hero_image_url',
          'instagram_url',
          'facebook_url',
          'whatsapp_number',
          'contact_email',
          'contact_phone',
          'contact_address',
          'appointment_email',
          'navigation_json'
        ],
        limit: 1
      }) as any[];

      if (cmsSettings && cmsSettings.length > 0) {
        const s = cmsSettings[0];
        let navLinks = [];
        try { navLinks = JSON.parse(s.navigation_json || '[]'); } catch (e) { console.error('Failed to parse nav links from Odoo', e); }
        
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

      // 2. Fallback to res.company
      const companyId = process.env.ODOO_COMPANY_ID ? parseInt(process.env.ODOO_COMPANY_ID, 10) : 1;
      const companyDomain = [['id', '=', companyId]];
      const baseCompanyFields = [
        'name',
        'email',
        'phone',
        'street',
        'city',
        'zip',
        'social_instagram',
        'social_facebook',
      ];
      const companyFields = supportsCompanySocialWhatsapp === false
        ? baseCompanyFields
        : [...baseCompanyFields, 'social_whatsapp'];

      let companies: any[] = [];
      try {
        companies = await client.call('res.company', 'search_read', {
          domain: companyDomain,
          fields: companyFields,
          limit: 1
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('Invalid field')) {
          throw error;
        }
        if (message.includes('social_whatsapp')) {
          supportsCompanySocialWhatsapp = false;
        }

        companies = await client.call('res.company', 'search_read', {
          domain: companyDomain,
          fields: baseCompanyFields,
          limit: 1
        });
      }

      if (supportsCompanySocialWhatsapp === null) {
        supportsCompanySocialWhatsapp = true;
      }

      if (!companies || companies.length === 0) return {};

      const c = companies[0];
      return {
        site_title: c.name,
        contact_email: c.email,
        contact_phone: c.phone,
        contact_address: `${c.street || ''}, ${c.city || ''} ${c.zip || ''}`.trim(),
        instagram_url: c.social_instagram,
        facebook_url: c.social_facebook,
        whatsapp_number: c.social_whatsapp,
      };
    } catch (error) {
      console.error('Odoo Company Fetch Error:', error);
      return {};
    }
  },

  /**
   * Finds a partner by email
   */
  async getPartnerByEmail(email: string) {
    try {
      const existing = await client.call('res.partner', 'search_read', {
        domain: [['email', '=', email]],
        fields: ['id'],
        limit: 1
      });

      if (existing && existing.length > 0) {
        return existing[0].id;
      }
      return null;
    } catch (error) {
      console.error('Odoo Partner Search Error:', error);
      throw error;
    }
  },

  /**
   * Finds or creates a customer (Partner) in Odoo.
   * Implements deduplication by email.
   */
  async findOrCreateCustomer(data: CustomerData) {
    try {
      // 1. Search by email
      const existing = await client.call('res.partner', 'search_read', {
        domain: [['email', '=', data.email]],
        fields: ['id', 'name', 'email', 'phone', 'street', 'city', 'zip'],
        limit: 1
      });

      if (existing && existing.length > 0) {
        const current = existing[0];
        const vals: Record<string, unknown> = {};

        if (data.name && data.name !== current.name) vals.name = data.name;
        if (data.phone && data.phone !== current.phone) vals.phone = data.phone;
        if (data.street && data.street !== current.street) vals.street = data.street;
        if (data.city && data.city !== current.city) vals.city = data.city;
        if (data.zip && data.zip !== current.zip) vals.zip = data.zip;
        if (data.state_id) vals.state_id = data.state_id;
        if (data.country_id) vals.country_id = data.country_id;

        if (Object.keys(vals).length > 0) {
          await client.call('res.partner', 'write', {
            ids: [current.id],
            vals,
          });
        }

        return existing[0].id;
      }

      // 2. Create new partner
      const newPartnerId = await client.create('res.partner', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        street: data.street,
        city: data.city,
        zip: data.zip,
        state_id: data.state_id,
        country_id: data.country_id || 233, // Default USA
        customer_rank: 1,
      });

      return newPartnerId;
    } catch (error) {
      console.error('Odoo Partner Sync Error:', error);
      throw error;
    }
  },

  /**
   * Links an authenticated user (from Google/Auth) to an existing Odoo Partner.
   * Ensures that guest history is preserved when the user eventually registers.
   */
  async syncAuthenticatedUser(data: { name: string; email: string; google_id?: string }) {
    return this.syncCustomerProfile({
      name: data.name,
      email: data.email,
      google_id: data.google_id,
      authMethod: 'google',
    });
  },

  /**
   * Persists customer account metadata into Odoo's res.partner record.
   */
  async syncCustomerProfile(data: CustomerProfileSyncData) {
    try {
      const partnerId = await this.findOrCreateCustomer({
        name: data.name,
        email: data.email,
        phone: data.phone,
        street: data.street,
        city: data.city,
        zip: data.zip,
        state_id: data.state_id,
        country_id: data.country_id,
      });

      const vals: Record<string, unknown> = {
        customer_rank: 1,
        galantes_customer_source: data.authMethod || 'unknown',
        galantes_customer_last_auth_at: data.lastAuthAt || new Date().toISOString(),
      };

      if (data.username) {
        vals.galantes_customer_username = data.username;
      }
      if (data.google_id) {
        vals.galantes_google_subject = data.google_id;
      }
      if (data.registeredAt) {
        vals.galantes_customer_registered_at = data.registeredAt;
      }

      await client.call('res.partner', 'write', {
        ids: [partnerId],
        vals,
      });

      return partnerId;
    } catch (error) {
      console.error('Odoo User Sync Error:', error);
      throw error;
    }
  },

  /**
   * Creates a Sales Order in Odoo
   */
  async createOrder(partnerId: number, lines: OrderLine[]) {
    try {
      const orderLines = lines.map(line => [0, 0, {
        product_id: line.product_id,
        product_uom_qty: line.product_uom_qty,
        price_unit: line.price_unit,
      }]);

      const orderId = await client.create('sale.order', {
        partner_id: partnerId,
        order_line: orderLines,
      });

      return orderId;
    } catch (error) {
      console.error('Odoo Order Creation Error:', error);
      throw error;
    }
  },

  /**
   * Confirms a Sales Order (Quote -> Sales Order)
   */
  async confirmOrder(orderId: number) {
    try {
      return await client.call('sale.order', 'action_confirm', {
        ids: [orderId]
      });
    } catch (error) {
      console.error('Odoo Order Confirmation Error:', error);
      throw error;
    }
  },

  /**
   * Creates invoices for a Sales Order
   */
  async createInvoice(orderId: number) {
    try {
      // In Odoo, _create_invoices returns the created account.move records
      const invoiceIds = await client.call('sale.order', '_create_invoices', {
        ids: [orderId],
        final: true
      });
      return invoiceIds;
    } catch (error) {
      console.error('Odoo Invoice Creation Error:', error);
      throw error;
    }
  },

  /**
   * Validates/Posts an invoice (Draft -> Posted)
   */
  async postInvoice(invoiceId: number) {
    try {
      return await client.call('account.move', 'action_post', {
        ids: [invoiceId]
      });
    } catch (error) {
      console.error('Odoo Invoice Post Error:', error);
      throw error;
    }
  },

  /**
   * Sends the invoice by email using Odoo's native mail template
   */
  async sendInvoiceEmail(invoiceId: number) {
    try {
      // Custom server-side method: renders the official Odoo invoice PDF and emails it to the customer.
      return await client.call('account.move', 'action_send_invoice_pdf_email', {
        ids: [invoiceId]
      });
    } catch (error) {
      console.error('Odoo Invoice Email Error:', error);
      throw error;
    }
  },

  /**
   * Complete automation: Confirm -> Invoice -> Post -> Email
   * Optimized for resilience with detailed error reporting.
   */
  async automateBillingFlow(orderId: number) {
    const steps: string[] = [];
    try {
      console.log(`[Billing] Starting automation for Order ${orderId}...`);

      const existingOrder = await client.call('sale.order', 'search_read', {
        domain: [['id', '=', orderId]],
        fields: ['invoice_status', 'invoice_ids'],
        limit: 1,
      });
      const existingInvoiceIds: number[] = existingOrder?.[0]?.invoice_ids || [];
      if (existingInvoiceIds.length > 0) {
        const invoiceId = existingInvoiceIds[0];
        steps.push('existing_invoice');
        console.log(`[Billing] Order ${orderId} already has invoice ${invoiceId}. Skipping duplicate creation.`);
        return { orderId, invoiceId, steps };
      }
      
      // 1. Confirm Order
      await this.confirmOrder(orderId);
      steps.push('confirmed');
      console.log(`[Billing] Order ${orderId} confirmed.`);

      // 2. Create Invoice
      const invoiceIds = await this.createInvoice(orderId);
      if (!invoiceIds || invoiceIds.length === 0) {
        throw new Error('Invoice creation returned no IDs.');
      }
      const invoiceId = invoiceIds[0];
      steps.push('invoiced');
      console.log(`[Billing] Invoice ${invoiceId} created.`);

      // 3. Post Invoice
      await this.postInvoice(invoiceId);
      steps.push('posted');
      console.log(`[Billing] Invoice ${invoiceId} posted.`);

      // 4. Send Email
      try {
        await this.sendInvoiceEmail(invoiceId);
        steps.push('emailed');
        console.log(`[Billing] Invoice ${invoiceId} sent to customer.`);
      } catch (emailError) {
        console.warn(`[Billing] Email delivery failed for Invoice ${invoiceId}, but order is confirmed and invoiced.`, emailError);
        // We don't throw here to avoid failing the whole process if only email fails
      }

      return { orderId, invoiceId, steps };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Billing] Automation Failed at step ${steps.length}: ${errorMessage}`);
      
      // Log failure in Odoo if possible (using message_post)
      try {
        await client.call('sale.order', 'message_post', {
          ids: [orderId],
          body: `<b>Billing Automation Failed:</b> ${errorMessage}<br/>Completed steps: ${steps.join(', ')}`
        });
      } catch (logError) {
        console.error('[Billing] Failed to log error in Odoo:', logError);
      }
      
      throw error;
    }
  },

  /**
   * Get order details with friendly status and portal URL
   */
  async getOrderDetails(orderId: number, authenticatedEmail?: string) {
    try {
      const orders = await client.call('sale.order', 'search_read', {
        domain: [['id', '=', orderId]],
        fields: ['name', 'date_order', 'state', 'amount_total', 'invoice_status', 'order_line', 'access_url', 'partner_id'],
        limit: 1
      });

      if (!orders || orders.length === 0) return null;

      const order = orders[0];
      
      // Security Check
      if (authenticatedEmail) {
        const partner = await client.call('res.partner', 'search_read', {
          domain: [['id', '=', order.partner_id[0]]],
          fields: ['email'],
          limit: 1
        });
        if (!partner || partner.length === 0 || partner[0].email !== authenticatedEmail) {
          throw new Error('Access Denied: Order ownership mismatch.');
        }
      }

      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';
      
      return {
        ...order,
        display_status: this.mapOrderState(order.state, order.invoice_status),
        portal_url: order.access_url ? `${baseUrl}${order.access_url}` : null,
      };
    } catch (error) {
      console.error('Odoo Order Fetch Error:', error);
      throw error;
    }
  },

  /**
   * Get all orders for a partner with integrated security check
   */
  async getPartnerOrders(partnerId: number, authenticatedEmail?: string) {
    try {
      const domain: any[] = [['partner_id', '=', partnerId]];
      
      // If email is provided, Odoo filters by both ID and Email in a single DB query
      if (authenticatedEmail) {
        domain.push(['partner_id.email', '=', authenticatedEmail]);
      }

      const orders = await client.call('sale.order', 'search_read', {
        domain,
        fields: ['name', 'date_order', 'state', 'amount_total', 'invoice_status', 'access_url'],
        order: 'date_order desc'
      });

      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';

      return orders.map((o: any) => ({
        ...o,
        display_status: this.mapOrderState(o.state, o.invoice_status),
        portal_url: o.access_url ? `${baseUrl}${o.access_url}` : null,
      }));
    } catch (error) {
      console.error('Odoo Partner Orders Fetch Error:', error);
      throw error;
    }
  },

  /**
   * Get all invoices for a partner with integrated security check
   */
  async getPartnerInvoices(partnerId: number, authenticatedEmail?: string) {
    try {
      const domain: any[] = [
        ['partner_id', '=', partnerId],
        ['move_type', '=', 'out_invoice']
      ];

      if (authenticatedEmail) {
        domain.push(['partner_id.email', '=', authenticatedEmail]);
      }

      const invoices = await client.call('account.move', 'search_read', {
        domain,
        fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
        order: 'invoice_date desc'
      });

      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';

      return invoices.map((inv: any) => ({
        ...inv,
        display_status: this.mapInvoiceState(inv.state, inv.payment_state),
        portal_url: buildPortalUrl(baseUrl, inv.access_url),
        pdf_url: buildInvoicePdfUrl(baseUrl, inv.access_url, inv.access_token),
      }));
    } catch (error) {
      console.error('Odoo Partner Invoices Fetch Error:', error);
      throw error;
    }
  },

  /**
   * Get full partner profile for the settings page
   */
  async getPartnerProfile(partnerId: number) {
    try {
      const partners = await client.call('res.partner', 'search_read', {
        domain: [['id', '=', partnerId]],
        fields: ['name', 'email', 'phone', 'street', 'street2', 'city', 'zip', 'country_id', 'state_id'],
        limit: 1,
      });
      return partners && partners.length > 0 ? partners[0] : null;
    } catch (error) {
      console.error('Odoo Partner Profile Fetch Error:', error);
      return null;
    }
  },

  /**
   * Update partner profile fields (name, phone, address only — email is auth-managed)
   */
  async updatePartnerProfile(partnerId: number, data: {
    name?: string;
    phone?: string;
    street?: string;
    street2?: string;
    city?: string;
    zip?: string;
  }) {
    try {
      const vals: Record<string, unknown> = {};
      if (data.name)    vals.name    = data.name;
      if (data.phone !== undefined) vals.phone = data.phone;
      if (data.street !== undefined) vals.street = data.street;
      if (data.street2 !== undefined) vals.street2 = data.street2;
      if (data.city !== undefined)   vals.city   = data.city;
      if (data.zip !== undefined)    vals.zip    = data.zip;

      await client.call('res.partner', 'write', { ids: [partnerId], vals });
      return { success: true };
    } catch (error) {
      console.error('Odoo Partner Update Error:', error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Get orders with their linked invoices for the portal orders page
   */
  async getOrdersWithInvoices(partnerId: number, authenticatedEmail?: string) {
    try {
      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';
      const domain: Array<[string, string, unknown]> = [['partner_id', '=', partnerId]];

      if (authenticatedEmail) {
        domain.push(['partner_id.email', '=', authenticatedEmail]);
      }

      const orders = await client.call('sale.order', 'search_read', {
        domain,
        fields: ['name', 'date_order', 'state', 'amount_total', 'invoice_status', 'access_url', 'invoice_ids'],
        order: 'date_order desc',
      });

      if (!orders || orders.length === 0) return [];

      // Collect all invoice IDs across orders
      const allInvoiceIds: number[] = orders.flatMap((o: any) => o.invoice_ids || []);

      let invoiceMap: Record<number, any[]> = {};
      if (allInvoiceIds.length > 0) {
        const invoices = await client.call('account.move', 'search_read', {
          domain: [['id', 'in', allInvoiceIds], ['move_type', '=', 'out_invoice']],
          fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token', 'sale_order_ids'],
        });

        // Build a map: orderId -> invoices[]
        for (const inv of (invoices || [])) {
          const enriched = {
            ...inv,
            display_status: this.mapInvoiceState(inv.state, inv.payment_state),
            portal_url: buildPortalUrl(baseUrl, inv.access_url),
            pdf_url: buildInvoicePdfUrl(baseUrl, inv.access_url, inv.access_token),
          };
          // Link invoice back to orders via sale_order_ids or invoice_ids on order
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
        display_status: this.mapOrderState(o.state, o.invoice_status),
        portal_url: buildPortalUrl(baseUrl, o.access_url),
        invoices: invoiceMap[o.id] || [],
      }));
    } catch (error) {
      console.error('Odoo Orders+Invoices Fetch Error:', error);
      return [];
    }
  },

  mapOrderState(state: string, invoiceStatus: string): string {
    const states: Record<string, string> = {
      'draft': 'Quotation',
      'sent': 'Quotation Sent',
      'sale': 'Confirmed',
      'done': 'Locked',
      'cancel': 'Cancelled',
    };

    if (state === 'sale' && invoiceStatus === 'invoiced') {
      return 'Completed & Invoiced';
    }
    if (state === 'sale' && invoiceStatus === 'to invoice') {
      return 'Ready to Invoice';
    }

    return states[state] || state;
  },

  mapInvoiceState(state: string, paymentState: string): string {
    if (paymentState === 'paid') return 'Paid';
    if (paymentState === 'in_payment') return 'Processing Payment';
    if (paymentState === 'partial') return 'Partially Paid';
    
    const states: Record<string, string> = {
      'draft': 'Draft',
      'posted': 'Posted',
      'cancel': 'Cancelled',
    };

    return states[state] || state;
  }
};
