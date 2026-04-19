import xmlrpc.client
import os

# Configuración desde variables de entorno o valores por defecto de desarrollo
url = os.environ.get('ODOO_BASE_URL', 'http://localhost:8069')
db = os.environ.get('ODOO_DB', 'galante_db')
username = os.environ.get('ODOO_USER', 'admin')
password = os.environ.get('ODOO_PASSWORD', 'admin')

def seed_products():
    print(f"Connecting to Odoo at {url}...")
    try:
        common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
        uid = common.authenticate(db, username, password, {})
        models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

        products = [
            {
                'name': 'The Islamorada Solitaire',
                'list_price': 18500.0,
                'description_sale': '2ct Diamond on Platinum with Coral Engravings. A masterpiece of coastal elegance.',
                'default_code': 'GJ-BR-001',
                'website_published': True,
                'public_categ_ids': [], # Se llenará después
            },
            {
                'name': "Mariner's Bond Band",
                'list_price': 2400.0,
                'description_sale': '18k Rose Gold Nautical Knot Band. Symbolize your eternal bond.',
                'default_code': 'GJ-BR-002',
                'website_published': True,
            },
            {
                'name': 'The Compass Rose Pendant',
                'list_price': 3200.0,
                'description_sale': '18k Gold with Sapphire Center. Never lose your way.',
                'default_code': 'GJ-NT-001',
                'website_published': True,
            },
            {
                'name': 'Keys Azure Drop Earrings',
                'list_price': 5800.0,
                'description_sale': 'Aquamarine and Diamond Drops capturing the crystalline waters of the Florida Keys.',
                'default_code': 'GJ-CS-001',
                'website_published': True,
            },
            {
                'name': 'Anchor of the Soul Bracelet',
                'list_price': 8900.0,
                'description_sale': 'Diamond Pavé Anchor Cuff. A true statement of coastal luxury.',
                'default_code': 'GJ-NT-002',
                'website_published': True,
            },
            {
                'name': 'Coastal Tide Ring',
                'list_price': 4500.0,
                'description_sale': 'Blue Sapphire Gradient Wave Ring set in high-polish white gold.',
                'default_code': 'GJ-CS-002',
                'website_published': True,
            },
            {
                'name': "Siren's Pearl Necklace",
                'list_price': 7200.0,
                'description_sale': 'South Sea Pearl with White Gold Mermaid Tail set with shimmering diamonds.',
                'default_code': 'GJ-NT-003',
                'website_published': True,
            },
            {
                'name': "Navigator's Chrono Link",
                'list_price': 1800.0,
                'description_sale': 'Solid Heavy Link Bracelet inspired by vintage ship anchor chains.',
                'default_code': 'GJ-CS-003',
                'website_published': True,
            },
            {
                'name': "Triton's Trident Tie Bar",
                'list_price': 650.0,
                'description_sale': 'Sterling Silver and Gold Tie Bar for the coastal gentleman.',
                'default_code': 'GJ-NT-004',
                'website_published': True,
            },
            {
                'name': 'Lighthouse Guardian Charm',
                'list_price': 1200.0,
                'description_sale': 'Detailed 18k gold lighthouse charm with a tiny ruby crystal.',
                'default_code': 'GJ-CS-004',
                'website_published': True,
            }
        ]

        for p_data in products:
            # Verificar si ya existe
            existing = models.execute_kw(db, uid, password, 'product.template', 'search', [[['name', '=', p_data['name']]]])
            if not existing:
                p_id = models.execute_kw(db, uid, password, 'product.template', 'create', [p_data])
                print(f"Created product: {p_data['name']} (ID: {p_id})")
            else:
                print(f"Product already exists: {p_data['name']}")

        print("Seeding complete.")
    except Exception as e:
        print(f"Error connecting to Odoo: {e}")
        print("Make sure Docker is running and Odoo is accessible at http://localhost:8069")

if __name__ == "__main__":
    seed_products()
