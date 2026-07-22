import json
import base64
import os
from pathlib import Path

dry_run_file = Path('/tmp/odoo-dry-run.json')
if not dry_run_file.exists():
    print("Missing /tmp/odoo-dry-run.json")
    exit(1)

with open(dry_run_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

payloads = data.get('payloads', [])
print(f"Processing {len(payloads)} products via Odoo ORM...")

Product = self.env['product.template'].sudo()
Gallery = self.env['galantes.product.gallery'].sudo() if 'galantes.product.gallery' in self.env else None

created = 0
updated = 0

for item in payloads:
    vals = dict(item.get('vals', {}))
    if not vals.get('name'):
        continue
    
    vals['type'] = 'consu'
    vals['sale_ok'] = True
    vals['available_on_website'] = True
    
    primary_path = item.get('primaryImagePath')
    if primary_path and os.path.exists(primary_path):
        with open(primary_path, 'rb') as img_f:
            vals['image_1920'] = base64.b64encode(img_f.read()).decode('utf-8')
    
    key = vals.get('default_code') or f"GAL-{item.get('clusterId')}"
    vals['default_code'] = key
    
    existing = Product.search([('default_code', '=', key)], limit=1)
    if not existing:
        existing = Product.search([('name', '=', vals['name'])], limit=1)
    
    if existing:
        existing.write(vals)
        prod_rec = existing
        updated += 1
    else:
        prod_rec = Product.create(vals)
        created += 1
    
    gallery_paths = item.get('galleryImagePaths', [])
    if gallery_paths and Gallery:
        for idx, gpath in enumerate(gallery_paths):
            if os.path.exists(gpath):
                with open(gpath, 'rb') as g_f:
                    gb64 = base64.b64encode(g_f.read()).decode('utf-8')
                    Gallery.create({
                        'product_id': prod_rec.id,
                        'name': f"{prod_rec.name}_gallery_{idx + 1}",
                        'image': gb64,
                        'sequence': idx + 1,
                    })

self.env.cr.commit()
print(f"COMPLETE: {created} products created, {updated} updated out of {len(payloads)} total.")
