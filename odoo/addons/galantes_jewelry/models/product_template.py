import re
from odoo import models, fields, api

def slugify(text):
    if not text:
        return ''
    text = str(text).lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    # Jewelry-specific fields
    material = fields.Selection([
        ('gold', 'Gold'),
        ('silver', 'Silver'),
        ('platinum', 'Platinum'),
        ('titanium', 'Titanium'),
        ('bronze', 'Bronze'),
        ('gemstone', 'Gemstone'),
        ('mixed', 'Mixed Materials'),
        ('other', 'Other'),
    ], string='Material', help='Primary material of the jewelry piece')

    slug = fields.Char(
        string='URL Slug',
        help='URL-friendly slug for web publication (auto-generated from name if empty)',
        index=True
    )

    buy_url = fields.Char(
        string='Buy URL',
        compute='_compute_buy_url',
        store=False,
        help='Public URL where customer can purchase this product'
    )

    public_url = fields.Char(
        string='Canonical URL',
        compute='_compute_public_url',
        store=False,
        help='SEO-friendly canonical URL on shop.galantesjewelry.com'
    )

    available_on_website = fields.Boolean(
        string='Available on Website',
        default=True,
        help='Whether this product is published to the web storefront'
    )

    is_featured = fields.Boolean(
        string='Featured Product',
        default=False,
        help='Pin this product to the featured section on the homepage and collections page'
    )

    sequence = fields.Integer(
        string='Display Sequence',
        default=10,
        help='Lower number = higher priority in featured ordering'
    )

    availability_status = fields.Selection([
        ('in_stock', 'In Stock'),
        ('out_of_stock', 'Out of Stock'),
        ('preorder', 'Pre-order Available'),
    ], string='Availability Status', compute='_compute_availability', store=True)

    gallery_ids = fields.One2many(
        'galantes.product.gallery',
        'product_id',
        string='Product Gallery',
        help='Additional product images'
    )

    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate slug if not provided."""
        for vals in vals_list:
            if not vals.get('slug') and vals.get('name'):
                vals['slug'] = slugify(vals['name'])
        return super().create(vals_list)

    @api.onchange('name')
    def _onchange_name(self):
        """Auto-generate slug when name changes (if slug is empty)."""
        if self.name and not self.slug:
            self.slug = slugify(self.name)

    def _compute_buy_url(self):
        """Build the buy URL for the product."""
        for product in self:
            if product.slug:
                product.buy_url = f"https://shop.galantesjewelry.com/product/{product.slug}"
            else:
                product.buy_url = None

    def _compute_public_url(self):
        """Build the canonical URL for SEO."""
        for product in self:
            if product.slug:
                product.public_url = f"https://shop.galantesjewelry.com/products/{product.slug}"
            else:
                product.public_url = None

    @api.depends('qty_available', 'type')
    def _compute_availability(self):
        """Determine availability status based on stock."""
        for product in self:
            if product.type == 'service':
                product.availability_status = 'in_stock'
            else:
                qty_available = product.qty_available
                if qty_available > 0:
                    product.availability_status = 'in_stock'
                elif product.allow_out_of_stock_order:
                    product.availability_status = 'preorder'
                else:
                    product.availability_status = 'out_of_stock'

    def _export_to_meta(self):
        """Prepare product data for Meta catalog export (future use)."""
        return {
            'id': self.id,
            'sku': self.default_code,
            'name': self.name,
            'description': self.description_sale or self.name,
            'price': self.list_price,
            'currency': self.company_id.currency_id.name,
            'image_url': self.image_1920 and f"data:image/jpg;base64,{self.image_1920.decode()}" or None,
            'availability': self.availability_status,
            'material': self.get_material_display(),
            'url': self.buy_url,
        }

    def get_material_display(self):
        """Get human-readable material label."""
        return dict(self._fields['material'].selection).get(self.material, '')
