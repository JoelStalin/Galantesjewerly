import xmlrpc.client
import os

# Odoo Connection Details (Default from README/Docker)
URL = os.environ.get('ODOO_BASE_URL', 'http://localhost:8069')
DB = os.environ.get('ODOO_DATABASE', 'galantes_db')
USER = os.environ.get('ODOO_USER', 'admin')
PASSWORD = os.environ.get('ODOO_PASSWORD', '')

def get_odoo_common():
    return xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')

def get_odoo_object():
    return xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

def seed_products():
    print(f"Connecting to Odoo at {URL}...")
    if not PASSWORD:
        print("Missing ODOO_PASSWORD. Export it before running this script.")
        return
    try:
        common = get_odoo_common()
        uid = common.authenticate(DB, USER, PASSWORD, {})
        if not uid:
            print("Authentication failed!")
            return
        
        models = get_odoo_object()
        
        # 10 Jewelry Products
        products = [
            {
                "name": "Anillo de Compromiso Diamante 1ct",
                "list_price": 4500.0,
                "material": "gold", # Assuming 'material' is a selection field in galantes_jewelry
                "available_on_website": True,
                "standard_price": 2500.0,
                "type": "consu", # Storable if stock is installed, using 'consu' for safety
            },
            {
                "name": "Anillo Eternity Platino",
                "list_price": 3200.0,
                "material": "platinum",
                "available_on_website": True,
                "standard_price": 1800.0,
                "type": "consu",
            },
            {
                "name": "Collar de Perlas Cultivadas",
                "list_price": 1200.0,
                "material": "silver",
                "available_on_website": True,
                "standard_price": 600.0,
                "type": "consu",
            },
            {
                "name": "Colgante Corazón de Rubí",
                "list_price": 850.0,
                "material": "gold",
                "available_on_website": True,
                "standard_price": 400.0,
                "type": "consu",
            },
            {
                "name": "Pulsera Tennis de Diamantes",
                "list_price": 7500.0,
                "material": "gold",
                "available_on_website": True,
                "standard_price": 4500.0,
                "type": "consu",
            },
            {
                "name": "Esclava de Oro 18k",
                "list_price": 2100.0,
                "material": "gold",
                "available_on_website": True,
                "standard_price": 1200.0,
                "type": "consu",
            },
            {
                "name": "Pendientes de Aro Oro Rosa",
                "list_price": 450.0,
                "material": "gold",
                "available_on_website": True,
                "standard_price": 200.0,
                "type": "consu",
            },
            {
                "name": "Pendientes Solitario Diamante",
                "list_price": 1800.0,
                "material": "platinum",
                "available_on_website": True,
                "standard_price": 900.0,
                "type": "consu",
            },
            {
                "name": "Reloj Cronógrafo de Lujo",
                "list_price": 5500.0,
                "material": "steel",
                "available_on_website": True,
                "standard_price": 3000.0,
                "type": "consu",
            },
            {
                "name": "Alianza de Boda Clásica",
                "list_price": 600.0,
                "material": "gold",
                "available_on_website": True,
                "standard_price": 300.0,
                "type": "consu",
            }
        ]
        
        for p in products:
            # Check if product already exists
            existing = models.execute_kw(DB, uid, PASSWORD, 'product.template', 'search', [[['name', '=', p['name']]]])
            if existing:
                print(f"Product '{p['name']}' already exists, skipping.")
                continue
                
            # Create product
            # Note: We need to make sure the custom fields exist in the Odoo installation.
            # If 'material' or 'available_on_website' fail, we might need to adjust.
            try:
                product_id = models.execute_kw(DB, uid, PASSWORD, 'product.template', 'create', [p])
                print(f"Created product '{p['name']}' with ID {product_id}")
            except Exception as e:
                print(f"Error creating '{p['name']}': {e}")
                # Retry without custom fields if they don't exist yet
                p_safe = {k: v for k, v in p.items() if k in ['name', 'list_price', 'standard_price', 'type']}
                product_id = models.execute_kw(DB, uid, PASSWORD, 'product.template', 'create', [p_safe])
                print(f"Created basic product '{p['name']}' with ID {product_id} (custom fields skipped)")

        print("Seeding complete!")

    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    seed_products()
