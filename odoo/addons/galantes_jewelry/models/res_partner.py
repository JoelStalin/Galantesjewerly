from odoo import fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    galantes_customer_source = fields.Selection(
        selection=[
            ("password", "Password"),
            ("google", "Google"),
            ("checkout", "Checkout"),
            ("unknown", "Unknown"),
        ],
        string="Galantes Customer Source",
        copy=False,
    )
    galantes_customer_username = fields.Char(
        string="Galantes Username",
        copy=False,
    )
    galantes_google_subject = fields.Char(
        string="Galantes Google Subject",
        copy=False,
    )
    galantes_customer_registered_at = fields.Datetime(
        string="Galantes Customer Registered At",
        copy=False,
    )
    galantes_customer_last_auth_at = fields.Datetime(
        string="Galantes Customer Last Auth At",
        copy=False,
    )
