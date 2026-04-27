import xmlrpc.client
import os

URL = 'https://odoo.galantesjewelry.com'
DB = 'galantes_db'
USER = 'admin'
PASS = 'Galantesjewelry'

def sync_test():
    print(f"Connecting to {URL}...")
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USER, PASS, {})
    
    if not uid:
        print("❌ Authentication failed!")
        return

    print(f"✅ Authenticated UID: {uid}")
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

    # 1. Search for 'Deliveries' category
    cats = models.execute_kw(DB, uid, PASS, 'product.category', 'search_read', 
                             [[['name', 'ilike', 'Deliveries']]], {'fields': ['id', 'name']})
    
    if not cats:
        print("Category 'Deliveries' not found.")
        return

    cat_id = cats[0]['id']
    print(f"Found category: {cats[0]['name']} (ID: {cat_id})")

    # 2. Search for products in that category
    products = models.execute_kw(DB, uid, PASS, 'product.template', 'search_read', 
                                 [[['categ_id', '=', cat_id]]], {'fields': ['id', 'name', 'available_on_website']})
    
    print(f"Found {len(products)} products in this category.")

    # 3. Unpublish products to make the category disappear from shop
    for p in products:
        print(f"Unpublishing product: {p['name']} (ID: {p['id']})")
        models.execute_kw(DB, uid, PASS, 'product.template', 'write', [[p['id']], {'available_on_website': False}])

    print("✅ All products in 'Deliveries' unpublished. Category should now be hidden from shop.")

if __name__ == "__main__":
    sync_test()
