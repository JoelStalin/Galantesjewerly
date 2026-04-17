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
        // In Odoo 19, some fields might be different depending on localization
      });

      return orderId;
    } catch (error) {
      console.error('Odoo Order Creation Error:', error);
      throw error;
    }
  }
};
