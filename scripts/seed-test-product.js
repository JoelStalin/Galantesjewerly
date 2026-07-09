import { createOdooClient } from '../src/config/odooClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function seedProduct() {
  const client = createOdooClient();
  try {
    console.log('Creando producto de prueba en Odoo...');
    const result = await client.create('product.template', {
      name: 'Anillo Gala Oro 18K',
      list_price: 1250.00,
      available_on_website: true,
      is_published: true,
      website_published: true,
      is_featured: true,
      slug: 'anillo-gala-oro-18k',
      material: 'gold_18k',
      detailed_type: 'consu',
    });
    console.log('Producto creado con éxito:', result);
  } catch (error) {
    console.error('Error al crear el producto:', error.message);
    if (error.details) console.error('Detalles:', error.details);
  }
}

seedProduct();
