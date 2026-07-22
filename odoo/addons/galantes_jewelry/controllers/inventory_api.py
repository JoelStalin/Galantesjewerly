"""Restricted inventory intake endpoint for installations without Odoo JSON-2."""

import base64
import json
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class InventoryAPIController(http.Controller):
    """Create or update a draft product using an Odoo API key."""

    def _authenticate(self):
        header = request.httprequest.headers.get('Authorization', '')
        if not header.lower().startswith('bearer '):
            return None
        key = header[7:].strip()
        if not key:
            return None
        user_id = request.env['res.users.apikeys']._check_credentials(scope='rpc', key=key)
        user = request.env['res.users'].sudo().browse(user_id).exists() if user_id else None
        if user:
            request.update_env(user=user.id)
        return user

    @http.route('/api/inventory/publish', type='http', auth='none', methods=['POST'], csrf=False)
    def publish_draft(self, **kwargs):
        user = self._authenticate()
        if not user:
            return request.make_json_response({'ok': False, 'error': 'unauthorized'}, status=401)
        try:
            payload = json.loads(request.httprequest.data or '{}')
            required = ('name', 'default_code', 'list_price', 'stock')
            missing = [field for field in required if field not in payload]
            if missing:
                return request.make_json_response({'ok': False, 'error': 'missing_fields', 'fields': missing}, status=400)
            if int(payload['stock']) < 0 or float(payload['list_price']) < 0:
                return request.make_json_response({'ok': False, 'error': 'invalid_numeric_values'}, status=400)

            Product = request.env['product.template'].sudo()
            vals = {
                'name': str(payload['name'])[:256],
                'default_code': str(payload['default_code'])[:64],
                'list_price': float(payload['list_price']),
                'standard_price': float(payload.get('cost', 0)),
                'sale_ok': True,
                'purchase_ok': False,
                'website_published': False,
                'is_published': False,
                'available_on_website': True,
                'description_sale': str(payload.get('description', ''))[:5000],
            }
            image = payload.get('image_base64')
            if image:
                vals['image_1920'] = base64.b64decode(image, validate=True)
            product = Product.search([('default_code', '=', vals['default_code'])], limit=1)
            if product:
                product.write(vals)
                action = 'updated'
            else:
                product = Product.create(vals)
                action = 'created'
            request.env.cr.commit()
            return request.make_json_response({'ok': True, 'action': action, 'productId': product.id, 'websitePublished': False})
        except Exception as exc:
            request.env.cr.rollback()
            _logger.exception('Inventory draft publication failed')
            return request.make_json_response({'ok': False, 'error': str(exc)}, status=400)
