import xmlrpc.client
import base64
import os
import glob

# Configuration from .env (Manually extracted for this script)
ODOO_URL = "http://localhost:8069" # Standard Docker internal or external
DB = "galantes_db"
USER = "admin"
PASS = "Galantesjewelry"

def populate_images():
    print(f"Connecting to Odoo at {ODOO_URL}...")
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USER, PASS, {})
    
    if not uid:
        print("❌ Authentication failed!")
        return

    print(f"✅ Authenticated with UID: {uid}")
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

    # Load local images
    image_paths = glob.glob("public/assets/products/*.png")
    if not image_paths:
        print("❌ No images found in public/assets/products/*.png")
        return
    
    images_data = []
    for path in image_paths:
        with open(path, "rb") as f:
            images_data.append(base64.b64encode(f.read()).decode('utf-8'))
    
    print(f"Loaded {len(images_data)} images from disk.")

    # Fetch products without images
    product_ids = models.execute_kw(DB, uid, PASS, 'product.template', 'search', [[]])
    print(f"Found {len(product_ids)} products in total.")

    for i, pid in enumerate(product_ids):
        image_to_use = images_data[i % len(images_data)]
        print(f"Updating product ID {pid} with image {i % len(images_data)}...")
        models.execute_kw(DB, uid, PASS, 'product.template', 'write', [[pid], {
            'image_1920': image_to_use
        }])

    print("✅ All products updated with images.")

if __name__ == "__main__":
    populate_images()
