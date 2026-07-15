from odoo import api, fields, models


class ProductGalleryUploadWizard(models.TransientModel):
    _name = 'galantes.product.gallery.upload.wizard'
    _description = 'Upload Product Gallery Images'

    product_id = fields.Many2one(
        'product.template',
        string='Product',
        required=True,
        readonly=True,
        help='Product that will receive the uploaded gallery images.',
    )

    attachment_ids = fields.Many2many(
        'ir.attachment',
        string='Images',
        help='Drag and drop or select multiple image files at once.',
    )

    @api.model
    def default_get(self, fields_list):
        values = super().default_get(fields_list)
        if not values.get('product_id') and self.env.context.get('active_id'):
            values['product_id'] = self.env.context.get('active_id')
        return values

    def action_apply(self):
        self.ensure_one()
        product = self.product_id
        attachments = self.attachment_ids.sorted(lambda att: att.id)
        if not attachments:
            return {'type': 'ir.actions.act_window_close'}

        next_sequence = max(product.gallery_ids.mapped('sequence') or [0]) + 1
        gallery_model = self.env['galantes.product.gallery']
        for offset, attachment in enumerate(attachments):
            if not attachment.datas:
                continue
            gallery_model.create({
                'product_id': product.id,
                'name': attachment.name or product.name,
                'alt_text': attachment.name or product.name,
                'image': attachment.datas,
                'sequence': next_sequence + offset,
                'active': True,
            })

        attachments.unlink()
        return {'type': 'ir.actions.act_window_close'}
