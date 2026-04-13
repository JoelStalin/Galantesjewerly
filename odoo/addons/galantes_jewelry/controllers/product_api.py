"""Product API Controller for Galante's Jewelry

Exposes product catalog via HTTP endpoints for:
- Next.js shop frontend (/shop, /shop/[slug])
- Meta catalog sync integration
- Third-party integrations
"""

import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class ProductAPIController(http.Controller):
    """HTTP endpoints for product catalog access."""

    @http.route('/api/products', auth='public', methods=['GET'], type='json', csrf=False)
    def get_products(self, page=1, page_size=20, category=None, material=None, **kwargs):
        """Get paginated list of published products."""
        try:
            page = max(1, int(page))
            page_size = min(100, max(1, int(page_size)))
            offset = (page - 1) * page_size

            domain = [('available_on_website', '=', True)]
            if category:
                domain.append(('categ_id.name', 'ilike', category))
            if material:
                domain.append(('material', '=', material))

            Product = request.env['product.template'].sudo()
            total_products = Product.search_count(domain)
            products = Product.search(domain, offset=offset, limit=page_size, order='name asc')

            product_data = []
            for product in products:
                gallery = []
                for img in product.gallery_ids:
                    if img.image:
                        gallery.append({
                            'url': f"/web/image/galantes.product.gallery/{img.id}/image",
                            'alt': img.alt_text or product.name
                        })

                image_url = None
                if product.image_1920:
                    image_url = f"/web/image/product.template/{product.id}/image_1920"

                product_dict = {
                    'id': product.id,
                    'slug': product.slug or f"product-{product.id}",
                    'name': product.name,
                    'shortDescription': (product.description or '')[:200],
                    'longDescription': product.description or '',
                    'price': float(product.list_price),
                    'currency': product.company_id.currency_id.name or 'USD',
                    'availability': product.availability_status,
                    'imageUrl': image_url,
                    'gallery': gallery,
                    'sku': product.default_code or '',
                    'material': product.get_material_display(),
                    'category': product.categ_id.name if product.categ_id else '',
                    'buyUrl': product.buy_url,
                    'publicUrl': product.public_url,
                }
                product_data.append(product_dict)

            pages = (total_products + page_size - 1) // page_size

            return {
                'success': True,
                'data': product_data,
                'pagination': {
                    'page': page,
                    'pageSize': page_size,
                    'total': total_products,
                    'pages': pages
                }
            }

        except Exception as e:
            _logger.exception("Error in get_products")
            return {
                'success': False,
                'error': str(e),
                'data': []
            }

    @http.route('/api/products/<slug>', auth='public', methods=['GET'], type='json', csrf=False)
    def get_product_by_slug(self, slug, **kwargs):
        """Get single product by slug."""
        try:
            Product = request.env['product.template'].sudo()
            product = Product.search([('slug', '=', slug)], limit=1)

            if not product:
                return {
                    'success': False,
                    'error': 'Product not found',
                    'data': None
                }

            gallery = []
            for img in product.gallery_ids:
                if img.image:
                    gallery.append({
                        'url': f"/web/image/galantes.product.gallery/{img.id}/image",
                        'alt': img.alt_text or product.name
                    })

            image_url = None
            if product.image_1920:
                image_url = f"/web/image/product.template/{product.id}/image_1920"

            product_dict = {
                'id': product.id,
                'slug': product.slug or f"product-{product.id}",
                'name': product.name,
                'shortDescription': (product.description or '')[:200],
                'longDescription': product.description or '',
                'price': float(product.list_price),
                'currency': product.company_id.currency_id.name or 'USD',
                'availability': product.availability_status,
                'imageUrl': image_url,
                'gallery': gallery,
                'sku': product.default_code or '',
                'material': product.get_material_display(),
                'category': product.categ_id.name if product.categ_id else '',
                'buyUrl': product.buy_url,
                'publicUrl': product.public_url,
            }

            return {
                'success': True,
                'data': product_dict
            }

        except Exception as e:
            _logger.exception("Error in get_product_by_slug")
            return {
                'success': False,
                'error': str(e),
                'data': None
            }

    @http.route('/api/health', auth='public', methods=['GET'], type='json', csrf=False)
    def health_check(self, **kwargs):
        """Health check endpoint."""
        return {
            'status': 'ok',
            'service': 'odoo-api'
        }
