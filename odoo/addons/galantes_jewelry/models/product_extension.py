"""
Extensión de product.template para Galante's Jewelry.
Agrega campos específicos de joyería: slug, material, buy_url, public_url, gallery.
"""

from odoo import models, fields, api
from odoo.tools.translate import _
import re
import unicodedata


MATERIAL_SELECTION = [
    ('gold', 'Oro'),
    ('gold_14k', 'Oro 14K'),
    ('gold_18k', 'Oro 18K'),
    ('gold_24k', 'Oro 24K'),
    ('rose_gold', 'Oro Rosa'),
    ('rose_gold_14k', 'Oro Rosa 14K'),
    ('white_gold', 'Oro Blanco'),
    ('white_gold_14k', 'Oro Blanco 14K'),
    ('silver', 'Plata'),
    ('silver_925', 'Plata 925'),
    ('platinum', 'Platino'),
    ('stainless_steel', 'Acero Inoxidable'),
    ('other', 'Otro'),
]


class GalantesProductTemplate(models.Model):
    _inherit = 'product.template'

    # Jewelry-specific fields
    material = fields.Selection(
        selection=MATERIAL_SELECTION,
        string='Material',
        help='Material principal de la joya',
        index=True,
    )

    # SEO / URL fields
    slug = fields.Char(
        string='Slug URL',
        help='Identificador único para URL amigable. Auto-generado si está vacío.',
        index=True,
    )

    # Gallery
    gallery_ids = fields.One2many(
        comodel_name='galantes.product.gallery',
        inverse_name='product_id',
        string='Galería de imágenes',
    )

    # Computed URLs
    buy_url = fields.Char(
        string='URL de compra',
        compute='_compute_buy_url',
        store=False,
        help='URL en shop.galantesjewelry.com para comprar este producto',
    )

    public_url = fields.Char(
        string='URL pública',
        compute='_compute_public_url',
        store=False,
        help='URL canónica pública del producto',
    )

    availability_status = fields.Char(
        string='Estado de disponibilidad',
        compute='_compute_availability_status',
        store=False,
    )

    @api.depends('slug', 'name')
    def _compute_buy_url(self):
        base_url = 'https://shop.galantesjewelry.com'
        for product in self:
            slug = product.slug or self._generate_slug(product.name or '')
            product.buy_url = f"{base_url}/shop/{slug}"

    @api.depends('slug', 'name')
    def _compute_public_url(self):
        base_url = 'https://shop.galantesjewelry.com'
        for product in self:
            slug = product.slug or self._generate_slug(product.name or '')
            product.public_url = f"{base_url}/products/{slug}"

    @api.depends('type', 'virtual_available')
    def _compute_availability_status(self):
        for product in self:
            if product.type == 'service':
                product.availability_status = 'in_stock'
            elif product.virtual_available > 0:
                product.availability_status = 'in_stock'
            else:
                product.availability_status = 'out_of_stock'

    def get_material_display(self):
        """Retorna el label legible del material."""
        if not self.material:
            return ''
        for key, label in MATERIAL_SELECTION:
            if key == self.material:
                return label
        return self.material

    @api.model
    def _generate_slug(self, name):
        """Genera slug URL-friendly desde el nombre del producto."""
        if not name:
            return ''
        # Normalize unicode
        name = unicodedata.normalize('NFD', name)
        name = name.encode('ascii', 'ignore').decode('ascii')
        # Lowercase and replace spaces/special chars
        name = name.lower()
        name = re.sub(r'[^a-z0-9\s-]', '', name)
        name = re.sub(r'[\s-]+', '-', name)
        name = name.strip('-')
        return name

    @api.model_create_multi
    def create(self, vals_list):
        """Auto-genera slug si no se especifica."""
        for vals in vals_list:
            if not vals.get('slug') and vals.get('name'):
                vals['slug'] = self._generate_slug(vals['name'])
        return super().create(vals_list)

    def write(self, vals):
        """Auto-genera slug si se cambia el nombre y no hay slug."""
        if 'name' in vals and not vals.get('slug'):
            for product in self:
                if not product.slug:
                    vals['slug'] = self._generate_slug(vals['name'])
                    break
        return super().write(vals)
