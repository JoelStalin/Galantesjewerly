import json
import base64
import glob

chunk_files = sorted(glob.glob('/tmp/base64-chunks/chunk-*.json'))
if not chunk_files:
    print("No chunk files found in /tmp/base64-chunks/")
    exit(1)

print(f"Found {len(chunk_files)} chunk files. Processing products...")

Product = self.env['product.template'].sudo()
created = 0
updated = 0
total_items = 0

for cfile in chunk_files:
    with open(cfile, 'r', encoding='utf-8') as f:
        items = json.load(f)
    
    total_items += len(items)
    for item in items:
        vals = dict(item.get('vals', {}))
        cluster_id = item.get('clusterId', 'item')
        sku = vals.get('default_code') or f"GAL-{cluster_id}"
        cat_label = (item.get('categoryLabel') or 'Jewelry').title()
        
        vals['name'] = f"Galantes {cat_label} {sku.replace('GAL-', '#')}"
        vals['default_code'] = sku
        vals['type'] = 'consu'
        vals['sale_ok'] = True
        vals['available_on_website'] = True
        vals['is_published'] = True
        
        b64_img = item.get('primaryImageBase64')
        if b64_img:
            vals['image_1920'] = b64_img
        
        existing = Product.search([('default_code', '=', sku)], limit=1)
        if existing:
            existing.write(vals)
            updated += 1
        else:
            Product.create(vals)
            created += 1

self.env.cr.commit()
print(f"SUCCESS: 1-to-1 Base64 ingestion complete! {created} created, {updated} updated out of {total_items} total products.")
