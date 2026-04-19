{
    'name': 'Galante\'s Jewelry',
    'version': '19.0.1.0.0',
    'category': 'Sales',
    'summary': 'Jewelry-specific product models, pricing, and web publication for Galante\'s Jewelry by the Sea',
    'author': 'Galante\'s Jewelry',
    'depends': [
        'base',
        # Core sales modules
        'sale',
        # Website & eCommerce
        'website',
        'website_sale',
        # Products & inventory
        'product',
        'stock',
        # Accounting & invoicing
        'account',
        # CRM
        'crm',
        # Shipping
        'delivery',
        # Payments
        'payment',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/product_template_views.xml',
        'views/product_gallery_views.xml',
        'data/product_category.xml',
        'data/product_data.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'description': '''
        Extends Odoo product module with jewelry-specific fields:
        - Material (gold, silver, platinum, etc.)
        - Slug and canonical URL for web publication
        - Gallery images for products
        - Buy URL for external shop integration
        - Stock availability (in_stock, out_of_stock, preorder)

        Includes complete sales workflow:
        - Product creation and management
        - Website publication
        - Customer management
        - Order processing
        - Invoice generation
        - Shipment management
        - Payment processing
    ''',
}
