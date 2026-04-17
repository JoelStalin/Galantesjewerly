"""Product API Controller for Galante's Jewelry

Exposes product catalog via HTTP endpoints for:
- Next.js shop frontend (/shop, /shop/[slug])
- Meta catalog sync integration
- Third-party integrations

NOTE: All routes use type='http' (not type='json') so responses are plain JSON.
type='json' wraps responses in JSON-RPC envelope {"jsonrpc":"2.0","result":{...}}
which breaks lib/odoo/client.ts that reads response.data directly.
"""

import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class ProductAPIController(http.Controller):
    """HTTP endpoints for product catalog access."""

    def _resolve_base_url(self):
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        if base_url:
            return base_url.rstrip('/')
        return request.httprequest.host_url.rstrip('/')

    def _serialize_product(self, product, base_url):
        gallery = []
        for img in product.gallery_ids:
            if img.image:
                gallery.append(f"{base_url}/web/image/galantes.product.gallery/{img.id}/image")

        image_url = None
        if product.image_1920:
            image_url = f"{base_url}/web/image/product.template/{product.id}/image_1920"

        return {
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
            'isFeatured': product.is_featured,
        }

    @http.route('/api/products', auth='public', methods=['GET'], type='http', csrf=False)
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
            base_url = self._resolve_base_url()
            for product in products:
                product_data.append(self._serialize_product(product, base_url))

            pages = (total_products + page_size - 1) // page_size

            return request.make_json_response({
                'success': True,
                'data': product_data,
                'pagination': {
                    'page': page,
                    'pageSize': page_size,
                    'total': total_products,
                    'pages': pages
                }
            })

        except Exception as e:
            _logger.exception("Error in get_products")
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': []
            }, status=500)

    @http.route('/api/products/featured', auth='public', methods=['GET'], type='http', csrf=False)
    def get_featured_products(self, limit=6, **kwargs):
        """Get featured products for collections and homepage blocks.

        NOTE: This route MUST be registered before /api/products/<slug> so Odoo
        does not try to resolve 'featured' as a product slug.

        Uses is_featured=True flag first; falls back to most recently updated
        published products.
        """
        try:
            limit = min(20, max(1, int(limit)))
            Product = request.env['product.template'].sudo()
            base_url = self._resolve_base_url()

            # Primary: products explicitly marked as featured
            domain_featured = [('available_on_website', '=', True), ('is_featured', '=', True)]
            products = Product.search(domain_featured, limit=limit, order='sequence asc, write_date desc')

            # Fallback: most recently updated published products
            if not products:
                domain_fallback = [('available_on_website', '=', True)]
                products = Product.search(domain_fallback, limit=limit, order='write_date desc')

            featured_data = [self._serialize_product(product, base_url) for product in products]

            return request.make_json_response({
                'success': True,
                'data': featured_data,
            })
        except Exception as e:
            _logger.exception('Error in get_featured_products')
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': []
            }, status=500)

    @http.route('/api/products/<slug>', auth='public', methods=['GET'], type='http', csrf=False)
    def get_product_by_slug(self, slug, **kwargs):
        """Get single product by slug."""
        try:
            Product = request.env['product.template'].sudo()
            product = Product.search([('slug', '=', slug)], limit=1)

            if not product and slug.startswith('product-'):
                try:
                    product_id = int(slug.split('-')[1])
                    product = Product.browse(product_id)
                    if not product.exists():
                        product = None
                except ValueError:
                    pass

            if not product:
                return request.make_json_response({
                    'success': False,
                    'error': 'Product not found',
                    'data': None
                }, status=404)

            base_url = self._resolve_base_url()
            product_dict = self._serialize_product(product, base_url)

            return request.make_json_response({
                'success': True,
                'data': product_dict
            })

        except Exception as e:
            _logger.exception("Error in get_product_by_slug")
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': None
            }, status=500)

    @http.route('/api/health', auth='public', methods=['GET'], type='http', csrf=False)
    def health_check(self, **kwargs):
        """Health check endpoint."""
        return request.make_json_response({
            'status': 'ok',
            'service': 'odoo-api'
        })
