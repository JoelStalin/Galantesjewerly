import { createOdooClient } from '@/src/config/odooClient';

const client = createOdooClient();

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

export interface SiteSettings {
  favicon_url: string;
  logo_url: string;
  site_title: string;
  site_description: string;
  instagram_url?: string;
  facebook_url?: string;
  whatsapp_number?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  appointment_email?: string;
}

export interface OrderLine {
  product_id: number;
  product_uom_qty: number;
  price_unit: number;
}

/**
 * Service to handle Odoo business logic for E-commerce
 */
export const OdooService = {
  /**
   * Fetches company settings from Odoo res.company
   */
  async getCompanySettings(): Promise<Partial<SiteSettings>> {
    try {
      const companyId = process.env.ODOO_COMPANY_ID ? parseInt(process.env.ODOO_COMPANY_ID, 10) : 1;
      const companies = await client.call('res.company', 'search_read', {
        domain: [['id', '=', companyId]],
        fields: [
          'name', 
          'email', 
          'phone', 
          'street', 
          'city', 
          'zip', 
          'social_instagram', 
          'social_facebook', 
          'social_whatsapp',
          'x_site_title', // Custom field if exists
          'x_site_description', // Custom field if exists
        ],
        limit: 1
      });

      if (!companies || companies.length === 0) return {};

      const c = companies[0];
      return {
        site_title: c.x_site_title || c.name,
        site_description: c.x_site_description,
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
        fields: ['id', 'name', 'email'],
        limit: 1
      });

      if (existing && existing.length > 0) {
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
    try {
      const partnerId = await this.findOrCreateCustomer({
        name: data.name,
        email: data.email,
      });

      // Update partner with Google ID or mark as registered
      await client.call('res.partner', 'write', {
        ids: [partnerId],
        vals: {
          comment: `Authenticated via Google. ID: ${data.google_id || 'N/A'}`,
          // is_registered: true, // If custom field exists
        }
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
      // This usually requires a mail.template. 
      // Odoo's account.move has a method 'action_invoice_sent' but it's often for the wizard.
      // We can use message_post_with_template if we know the template ID, 
      // or try to trigger the standard send action.
      return await client.call('account.move', 'action_invoice_sent', {
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
        fields: ['name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url'],
        order: 'invoice_date desc'
      });

      const baseUrl = process.env.ODOO_BASE_URL || 'http://localhost:8069';

      return invoices.map((inv: any) => ({
        ...inv,
        display_status: this.mapInvoiceState(inv.state, inv.payment_state),
        portal_url: inv.access_url ? `${baseUrl}${inv.access_url}` : null,
      }));
    } catch (error) {
      console.error('Odoo Partner Invoices Fetch Error:', error);
      throw error;
    }
  },

  private mapOrderState(state: string, invoiceStatus: string): string {
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

  private mapInvoiceState(state: string, paymentState: string): string {
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
