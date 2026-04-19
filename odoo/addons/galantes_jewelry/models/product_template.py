"""Galante's Jewelry – Core Product Extension

Single canonical source for all jewelry-specific product fields.
product_extension.py no longer defines any product fields;
this file owns the complete implementation.
"""

import re
import unicodedata
from odoo import models, fields, api

# ---------------------------------------------------------------------------
# English-language material labels shown on the storefront
# ---------------------------------------------------------------------------
MATERIAL_SELECTION = [
    ('gold', 'Gold'),
    ('gold_14k', '14K Gold'),
    ('gold_18k', '18K Gold'),
    ('gold_24k', '24K Gold'),
    ('rose_gold', 'Rose Gold'),
    ('rose_gold_14k', '14K Rose Gold'),
    ('white_gold', 'White Gold'),
    ('white_gold_14k', '14K White Gold'),
    ('silver', 'Sterling Silver'),
    ('silver_925', '925 Sterling Silver'),
    ('platinum', 'Platinum'),
    ('titanium', 'Titanium'),
    ('bronze', 'Bronze'),
    ('stainless_steel', 'Stainless Steel'),
    ('gemstone', 'Gemstone'),
    ('mixed', 'Mixed Materials'),
    ('other', 'Other'),
]


def _slugify_text(text):
    """Return a URL-friendly ASCII slug from arbitrary text."""
    if not text:
        return ''
    text = unicodedata.normalize('NFD', str(text))
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')


class GalantesProductTemplate(models.Model):
    _inherit = 'product.template'

    # ── Material ─────────────────────────────────────────────────────────────
    material = fields.Selection(
        selection=MATERIAL_SELECTION,
        string='Material',
        index=True,
        help='Primary material of the jewelry piece (displayed on the storefront)',
    )

    # ── URL / SEO ─────────────────────────────────────────────────────────────
    slug = fields.Char(
        string='URL Slug',
        index=True,
        help='URL-friendly identifier auto-generated from the product name. '
             'Used in storefront URLs: /shop/<slug>',
    )

    # ── Publication & Merchandising ───────────────────────────────────────────
    available_on_website = fields.Boolean(
        string='Available on Website',
        default=True,
        help='Publish this product to the Next.js storefront',
    )

    is_featured = fields.Boolean(
        string='Featured Product',
        default=False,
        help='Highlight in featured sections, collections page, and sort-by-featured',
    )

    sequence = fields.Integer(
        string='Display Sequence',
        default=10,
        help='Lower number = higher priority in featured/sort ordering',
    )

    # ── Storefront copy ───────────────────────────────────────────────────────
    tagline = fields.Char(
        string='Tagline',
        help='One-line value proposition shown on product cards (keep under 100 chars)',
    )

    storefront_short_description = fields.Text(
        string='Short Description (Storefront)',
        help='Brief 1–3 sentence sales copy shown on cards and listing previews. '
             'Must be customer-safe and in English.',
    )

    storefront_long_description = fields.Text(
        string='Full Description (Storefront)',
        help='Customer-facing description for the product detail page. '
             'Focus on story, craftsmanship, and value. English only.',
    )

    product_details = fields.Text(
        string='Product Details',
        help='Key specifications: metal type, stone, dimensions, weight, finish, '
             'hallmarks. Shown in the "Product Details" section on the detail page.',
    )

    care_and_shipping = fields.Text(
        string='Care & Shipping Info',
        help='Customer-facing care instructions, shipping notes, and gift '
             'packaging details. Shown in the "Shipping & Care" section.',
    )

    # ── Gallery ───────────────────────────────────────────────────────────────
    gallery_ids = fields.One2many(
        'galantes.product.gallery',
        'product_id',
        string='Product Gallery',
        help='Additional product images shown in the detail page gallery',
    )

    # ── Computed URLs ─────────────────────────────────────────────────────────
    buy_url = fields.Char(
        string='Storefront URL',
        compute='_compute_storefront_urls',
        store=False,
        help='Customer-facing URL on the Next.js storefront (/shop/<slug>)',
    )

    public_url = fields.Char(
        string='Canonical URL',
        compute='_compute_storefront_urls',
        store=False,
        help='SEO canonical URL – same as Storefront URL',
    )

    # ── Availability ──────────────────────────────────────────────────────────
    availability_status = fields.Selection([
        ('in_stock', 'In Stock'),
        ('out_of_stock', 'Out of Stock'),
        ('preorder', 'Pre-order Available'),
    ], string='Availability Status', compute='_compute_availability', store=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate slug from name when not explicitly provided."""
        for vals in vals_list:
            if not vals.get('slug') and vals.get('name'):
                vals['slug'] = _slugify_text(vals['name'])
        return super().create(vals_list)

    def write(self, vals):
        """Auto-generate slug when name changes and slug is still empty."""
        if 'name' in vals and not vals.get('slug'):
            # Only set slug on records that don't have one yet; skip others
            # to preserve intentionally customised slugs.
            new_slug = _slugify_text(vals['name'])
            for product in self:
                if not product.slug:
                    # Write slug per-record to avoid overwriting different slugs
                    super(GalantesProductTemplate, product).write(
                        dict(vals, slug=new_slug)
                    )
            remaining = self.filtered(lambda p: p.slug)
            if remaining:
                return super(GalantesProductTemplate, remaining).write(vals)
            return True
        return super().write(vals)

    @api.onchange('name')
    def _onchange_name_slug(self):
        """Suggest a slug when the user changes the product name."""
        if self.name and not self.slug:
            self.slug = _slugify_text(self.name)

    # ── Computes ──────────────────────────────────────────────────────────────
    @api.depends('slug', 'name')
    def _compute_storefront_urls(self):
        base = 'https://shop.galantesjewelry.com'
        for product in self:
            slug = product.slug or (f'product-{product.id}' if product.id else '')
            url = f'{base}/shop/{slug}' if slug else base
            product.buy_url = url
            product.public_url = url

    @api.depends('qty_available', 'type', 'allow_out_of_stock_order')
    def _compute_availability(self):
        for product in self:
            if product.type == 'service':
                product.availability_status = 'in_stock'
            elif product.qty_available > 0:
                product.availability_status = 'in_stock'
            elif product.allow_out_of_stock_order:
                product.availability_status = 'preorder'
            else:
                product.availability_status = 'out_of_stock'

    # ── Helpers ───────────────────────────────────────────────────────────────
    def get_material_display(self):
        """Return the customer-facing English label for this product's material."""
        return dict(MATERIAL_SELECTION).get(self.material, '') if self.material else ''

    def _export_to_meta(self):
        """Prepare product data for Meta catalog sync."""
        return {
            'id': self.id,
            'sku': self.default_code,
            'name': self.name,
            'description': (
                self.storefront_short_description
                or self.tagline
                or self.description_sale
                or self.name
            ),
            'price': self.list_price,
            'currency': self.company_id.currency_id.name,
            'image_url': None,
            'availability': self.availability_status,
            'material': self.get_material_display(),
            'url': self.buy_url,
        }
