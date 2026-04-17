products = self.env['product.template'].search([('image_1920', '!=', False)])
print(f'Found {len(products)} products with images')
for p in products:
    print(f'ID: {p.id}, Name: {p.name}')
