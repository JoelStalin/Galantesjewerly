from odoo import api, fields, models
from odoo.exceptions import ValidationError


class GalanteAppointment(models.Model):
    _name = 'galante.appointment'
    _description = 'Galante Appointment'
    _order = 'appointment_datetime desc, id desc'

    name = fields.Char(required=True, index=True)
    partner_id = fields.Many2one('res.partner', string='Customer', ondelete='set null', index=True)
    customer_name = fields.Char(required=True)
    customer_email = fields.Char(required=True, index=True)
    customer_phone = fields.Char()
    inquiry_type = fields.Char()
    notes = fields.Text()
    appointment_datetime = fields.Datetime(required=True, index=True)
    appointment_end = fields.Datetime()
    duration_minutes = fields.Integer(default=60)
    timezone = fields.Char(default='America/New_York')
    status = fields.Selection(
        [
            ('pending', 'Pending'),
            ('confirmed', 'Confirmed'),
            ('completed', 'Completed'),
            ('cancelled', 'Cancelled'),
        ],
        default='confirmed',
        required=True,
        index=True,
    )
    external_reference = fields.Char(index=True)
    source = fields.Char(default='nextjs', index=True)
    google_event_id = fields.Char(index=True)
    google_event_link = fields.Char()
    website_id = fields.Many2one('website', ondelete='set null')
    company_id = fields.Many2one(
        'res.company',
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    _sql_constraints = [
        ('galante_appointment_external_reference_unique', 'unique(external_reference)', 'Appointment reference must be unique.'),
    ]

    @api.model
    def _normalize_api_payload(self, payload=None, **kwargs):
        normalized = dict(payload or {})
        normalized.update(kwargs)
        return normalized

    @api.model
    def _get_or_create_partner_from_api(self, values):
        email = (values.get('customer_email') or values.get('email') or '').strip().lower()
        name = (values.get('customer_name') or values.get('name') or '').strip()

        if not email:
            raise ValidationError('Customer email is required.')

        if not name:
            raise ValidationError('Customer name is required.')

        partner = self.env['res.partner'].search([('email', '=', email)], limit=1)
        phone = (values.get('customer_phone') or values.get('phone') or '').strip()

        if partner:
            updates = {}
            if partner.name != name:
                updates['name'] = name
            if phone and partner.phone != phone:
                updates['phone'] = phone
            if updates:
                partner.write(updates)
            return partner

        return self.env['res.partner'].create({
            'name': name,
            'email': email,
            'phone': phone,
            'company_type': 'person',
        })

    @api.model
    def create_from_api(self, payload=None, **kwargs):
        values = self._normalize_api_payload(payload=payload, **kwargs)
        external_reference = (values.get('external_reference') or '').strip()
        appointment_datetime = values.get('appointment_datetime')

        if not appointment_datetime:
            raise ValidationError('appointment_datetime is required.')

        partner = self._get_or_create_partner_from_api(values)
        appointment_values = {
            'name': (values.get('name') or values.get('customer_name') or '').strip(),
            'partner_id': partner.id,
            'customer_name': (values.get('customer_name') or values.get('name') or '').strip(),
            'customer_email': (values.get('customer_email') or values.get('email') or '').strip().lower(),
            'customer_phone': (values.get('customer_phone') or values.get('phone') or '').strip(),
            'inquiry_type': (values.get('inquiry_type') or '').strip(),
            'notes': values.get('notes') or '',
            'appointment_datetime': appointment_datetime,
            'appointment_end': values.get('appointment_end') or False,
            'duration_minutes': int(values.get('duration_minutes') or 60),
            'timezone': (values.get('timezone') or 'America/New_York').strip(),
            'status': values.get('status') or 'confirmed',
            'external_reference': external_reference or False,
            'source': (values.get('source') or 'nextjs').strip(),
            'google_event_id': (values.get('google_event_id') or '').strip(),
            'google_event_link': (values.get('google_event_link') or '').strip(),
            'company_id': int(values['company_id']) if values.get('company_id') else self.env.company.id,
            'website_id': int(values['website_id']) if values.get('website_id') else False,
        }

        existing = self.search([('external_reference', '=', external_reference)], limit=1) if external_reference else self.browse()

        if existing:
            existing.write(appointment_values)
            appointment = existing
            created = False
        else:
            appointment = self.create(appointment_values)
            created = True

        return {
            'partner_id': partner.id,
            'appointment_id': appointment.id,
            'created': created,
            'status': appointment.status,
        }
