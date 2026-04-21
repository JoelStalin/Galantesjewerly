from odoo import models, fields, api

class GalantesCMS(models.Model):
    _name = 'galante.cms.settings'
    _description = "Galante's Jewelry Site Settings"

    site_title = fields.Char(string='Site Title', default="Galante's Jewelry")
    site_description = fields.Text(string='Site Description')
    logo_url = fields.Char(string='Logo URL')
    favicon_url = fields.Char(string='Favicon URL')
    hero_image_url = fields.Char(string='Hero Image URL')
    instagram_url = fields.Char(string='Instagram URL')
    facebook_url = fields.Char(string='Facebook URL')
    whatsapp_number = fields.Char(string='WhatsApp Number')
    contact_email = fields.Char(string='Contact Email')
    contact_phone = fields.Char(string='Contact Phone')
    contact_address = fields.Text(string='Contact Address')
    appointment_email = fields.Char(string='Appointment Email')
    navigation_json = fields.Text(string='Navigation JSON')
    cms_snapshot_json = fields.Text(string='CMS Snapshot JSON')
    integrations_snapshot_json = fields.Text(string='Integrations Snapshot JSON')

    @api.model
    def create(self, vals):
        # Ensure only one record exists
        if self.search_count([]) > 0:
            return self.search([], limit=1)
        return super(GalantesCMS, self).create(vals)
