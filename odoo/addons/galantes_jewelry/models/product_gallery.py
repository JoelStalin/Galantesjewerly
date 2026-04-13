from odoo import models, fields


class ProductGallery(models.Model):
    _name = 'galantes.product.gallery'
    _description = 'Product Gallery Image'
    _order = 'sequence'

    product_id = fields.Many2one(
        'product.template',
        string='Product',
        required=True,
        ondelete='cascade',
        help='Related product template'
    )

    image = fields.Image(
        string='Image',
        required=True,
        max_width=1024,
        max_height=1024
    )

    sequence = fields.Integer(
        string='Sequence',
        default=1,
        help='Display order in gallery'
    )

    alt_text = fields.Char(
        string='Alt Text',
        help='SEO alt text for image'
    )

    def name_get(self):
        """Display as product name + image number."""
        result = []
        for gallery in self:
            display_name = f"{gallery.product_id.name} - Image {gallery.sequence}"
            result.append((gallery.id, display_name))
        return result
