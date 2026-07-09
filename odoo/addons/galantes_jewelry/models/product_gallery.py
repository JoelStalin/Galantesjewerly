from odoo import fields, models


class ProductGallery(models.Model):
    _name = 'galantes.product.gallery'
    _description = 'Product Gallery Image'
    _order = 'sequence, id'

    product_id = fields.Many2one(
        'product.template',
        string='Product',
        required=True,
        ondelete='cascade',
        index=True,
        help='Related product template',
    )

    name = fields.Char(
        string='Internal Description',
        help='Optional internal label for this image.',
    )

    image = fields.Image(
        string='Image',
        required=True,
        max_width=4096,
        max_height=4096,
    )

    sequence = fields.Integer(
        string='Sequence',
        default=1,
        index=True,
        help='Display order in gallery.',
    )

    alt_text = fields.Char(
        string='Alt Text',
        help='SEO alt text for image.',
    )

    active = fields.Boolean(
        string='Active',
        default=True,
        help='Disable to hide this image without deleting it.',
    )

    def name_get(self):
        """Display as product name + image number."""
        result = []
        for gallery in self:
            product_name = gallery.product_id.name or 'Product'
            display_name = gallery.name or f"{product_name} - Image {gallery.sequence or 0}"
            result.append((gallery.id, display_name))
        return result
