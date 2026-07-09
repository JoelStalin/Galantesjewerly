from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    """Backfill gallery schema columns for older production databases."""
    env = api.Environment(cr, SUPERUSER_ID, {})

    cr.execute(
        """
        ALTER TABLE IF EXISTS galantes_product_gallery
        ADD COLUMN IF NOT EXISTS name character varying
        """
    )
    cr.execute(
        """
        ALTER TABLE IF EXISTS galantes_product_gallery
        ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true
        """
    )

    # Existing rows should stay visible after the field lands.
    cr.execute(
        """
        UPDATE galantes_product_gallery
           SET active = TRUE
         WHERE active IS NULL
        """
    )

    # Keep public URLs stable after proxy/base URL changes.
    config = env['ir.config_parameter'].sudo()
    base_url = config.get_param('web.base.url') or ''
    if base_url.startswith('http://') and base_url.endswith('.galantesjewelry.com'):
        config.set_param('web.base.url', base_url.replace('http://', 'https://', 1))
        config.set_param('web.base.url.freeze', 'True')
