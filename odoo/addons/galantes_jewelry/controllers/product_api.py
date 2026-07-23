"""Product API Controller for Galante's Jewelry

Exposes product catalog via HTTP endpoints for:
- Next.js shop frontend (/shop, /shop/[slug])
- Meta catalog sync integration
- Third-party integrations

Endpoints:
  GET /api/products              – paginated catalog with search/filter/sort
  GET /api/products/featured     – featured products block
  GET /api/products/<slug>/related – related products for the detail page
  GET /api/products/<slug>       – single product by slug
  GET /api/categories            – published categories with product counts
  GET /api/health                – health check

NOTE: All routes use type='http' (not type='json') so responses are plain JSON.
type='json' wraps responses in JSON-RPC envelope {"jsonrpc":"2.0","result":{...}}
which breaks lib/odoo/client.ts that reads response.data directly.
"""

import re
import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class ProductAPIController(http.Controller):
    """HTTP endpoints for product catalog access."""

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _resolve_base_url(self):
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        if base_url:
            return base_url.rstrip('/')
        return request.httprequest.host_url.rstrip('/')

    def _serialize_product(self, product, base_url):
        """Build the customer-facing product payload for the frontend."""
        gallery = []
        for img in product.gallery_ids:
            if img.image:
                gallery.append(
                    f"{base_url}/web/image/galantes.product.gallery/{img.id}/image"
                )

        image_url = None
        if product.image_1920:
            image_url = (
                f"{base_url}/web/image/product.template/{product.id}/image_1920"
            )

        # Storefront copy with fallback chain – never expose internal ERP notes
        short_desc = (
            product.storefront_short_description
            or product.tagline
            or (product.description_sale or '')[:200]
            or ''
        )
        long_desc = (
            product.storefront_long_description
            or product.description_sale
            or ''
        )

        return {
            'id': product.id,
            'slug': product.slug or f"product-{product.id}",
            'name': product.name,
            'tagline': product.tagline or '',
            'shortDescription': short_desc,
            'longDescription': long_desc,
            'productDetails': product.product_details or '',
            'careAndShipping': product.care_and_shipping or '',
            'price': float(product.list_price),
            'currency': product.company_id.currency_id.name or 'USD',
            'availability': product.availability_status,
            'imageUrl': image_url,
            'gallery': gallery,
            'sku': product.default_code or '',
            'material': product.get_material_display(),
            'materialCode': product.material or '',
            'category': product.categ_id.name if product.categ_id else '',
            'categoryId': product.categ_id.id if product.categ_id else None,
            'buyUrl': product.buy_url,
            'publicUrl': product.public_url,
            'isFeatured': product.is_featured,
        }

    def _get_best_seller_products(self, Product, limit):
        """Return published products ordered by confirmed sales volume."""
        if limit <= 0:
            return Product.browse([])

        SaleOrderLine = request.env['sale.order.line'].sudo()
        groups = SaleOrderLine.read_group(
            domain=[
                ('order_id.state', 'in', ['sale', 'done']),
                ('product_template_id', '!=', False),
                ('product_template_id.available_on_website', '=', True),
            ],
            fields=['product_template_id', 'product_uom_qty:sum'],
            groupby=['product_template_id'],
            lazy=False,
        )

        sorted_groups = sorted(
            groups,
            key=lambda row: row.get('product_uom_qty', 0),
            reverse=True,
        )

        product_ids = []
        for row in sorted_groups:
            product_ref = row.get('product_template_id')
            if product_ref and product_ref[0] not in product_ids:
                product_ids.append(product_ref[0])
            if len(product_ids) >= limit:
                break

        return Product.browse(product_ids).exists()

    # ── Sort mapping ──────────────────────────────────────────────────────────

    _SORT_MAP = {
        'featured':     'is_featured desc, sequence asc, write_date desc',
        'newest':       'write_date desc',
        'price_asc':    'list_price asc',
        'price_desc':   'list_price desc',
        'alphabetical': 'name asc',
    }

    # ── Routes ────────────────────────────────────────────────────────────────

    @http.route('/api/products', auth='public', methods=['GET'], type='http', csrf=False)
    def get_products(
        self,
        page=1,
        page_size=None,
        pageSize=None,       # camelCase alias for backward compatibility
        q=None,
        category=None,
        material=None,
        min_price=None,
        max_price=None,
        sort='featured',
        **kwargs,
    ):
        """Get paginated list of published products.

        Query params:
          q           – full-text search (name, tagline, short description, SKU)
          category    – filter by category name (case-insensitive)
          material    – filter by material code (exact match, e.g. 'gold')
          min_price   – minimum list price (inclusive)
          max_price   – maximum list price (inclusive)
          sort        – featured | newest | price_asc | price_desc | alphabetical
          page        – page number (1-based, default 1)
          page_size   – results per page (default 24, max 100)
          pageSize    – camelCase alias for page_size (backward compat)
        """
        try:
            page = max(1, int(page))
            # Accept both page_size (snake_case) and pageSize (camelCase)
            _ps = page_size or pageSize or 24
            page_size = min(100, max(1, int(_ps)))
            offset = (page - 1) * page_size

            domain = [('available_on_website', '=', True)]

            if q:
                domain += ['|', '|', '|',
                    ('name', 'ilike', q),
                    ('tagline', 'ilike', q),
                    ('storefront_short_description', 'ilike', q),
                    ('default_code', 'ilike', q),
                ]

            if category:
                domain.append(('categ_id.name', 'ilike', category))
            if material:
                domain.append(('material', '=', material))
            if min_price:
                domain.append(('list_price', '>=', float(min_price)))
            if max_price:
                domain.append(('list_price', '<=', float(max_price)))

            order = self._SORT_MAP.get(sort, self._SORT_MAP['featured'])

            Product = request.env['product.template'].sudo()
            total = Product.search_count(domain)
            products = Product.search(domain, offset=offset, limit=page_size, order=order)

            base_url = self._resolve_base_url()
            product_data = [self._serialize_product(p, base_url) for p in products]
            pages = max(1, (total + page_size - 1) // page_size)

            return request.make_json_response({
                'success': True,
                'data': product_data,
                'pagination': {
                    'page': page,
                    'pageSize': page_size,
                    'total': total,
                    'pages': pages,
                    'hasNext': page < pages,
                    'hasPrev': page > 1,
                },
            })

        except Exception as e:
            _logger.exception("Error in get_products")
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': [],
            }, status=500)

    @http.route('/api/products/featured', auth='public', methods=['GET'], type='http', csrf=False)
    def get_featured_products(self, limit=6, **kwargs):
        """Get featured products for collections and homepage blocks.

        NOTE: This route MUST be registered before /api/products/<slug> so Odoo
        does not try to resolve 'featured' as a product slug.
        """
        try:
            limit = min(20, max(1, int(limit)))
            Product = request.env['product.template'].sudo()
            base_url = self._resolve_base_url()

            domain_featured = [
                ('available_on_website', '=', True),
                ('is_featured', '=', True),
            ]
            products = Product.search(
                domain_featured,
                limit=limit,
                order='sequence asc, write_date desc',
            )

            # Fallback: most recently updated published products
            if not products:
                domain_all = [('available_on_website', '=', True)]
                products = Product.search(domain_all, limit=limit, order='write_date desc')

            return request.make_json_response({
                'success': True,
                'data': [self._serialize_product(p, base_url) for p in products],
            })
        except Exception as e:
            _logger.exception('Error in get_featured_products')
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': [],
            }, status=500)

    @http.route('/api/products/collections', auth='public', methods=['GET'], type='http', csrf=False)
    def get_collection_products(self, limit=12, **kwargs):
        """Collection listing: best sellers first, then featured favorites."""
        try:
            limit = min(48, max(1, int(limit)))
            Product = request.env['product.template'].sudo()
            base_url = self._resolve_base_url()

            best_seller_limit = max(1, limit // 2)
            best_sellers = self._get_best_seller_products(Product, best_seller_limit)
            used_ids = set(best_sellers.ids)

            featured_limit = max(0, limit - len(best_sellers))
            featured = Product.search(
                [
                    ('available_on_website', '=', True),
                    ('is_featured', '=', True),
                    ('id', 'not in', list(used_ids)),
                ],
                limit=featured_limit,
                order='sequence asc, write_date desc',
            )
            used_ids.update(featured.ids)

            filler_limit = max(0, limit - len(best_sellers) - len(featured))
            filler = Product.browse([])
            if filler_limit:
                filler = Product.search(
                    [
                        ('available_on_website', '=', True),
                        ('id', 'not in', list(used_ids)),
                    ],
                    limit=filler_limit,
                    order='write_date desc',
                )

            ordered_ids = best_sellers.ids + featured.ids + filler.ids
            products = Product.browse(ordered_ids).exists()

            return request.make_json_response({
                'success': True,
                'data': [self._serialize_product(p, base_url) for p in products[:limit]],
            })
        except Exception as e:
            _logger.exception('Error in get_collection_products')
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': [],
            }, status=500)

    @http.route(
        '/api/products/<slug>/related',
        auth='public',
        methods=['GET'],
        type='http',
        csrf=False,
    )
    def get_related_products(self, slug, limit=4, **kwargs):
        """Get related products for the product detail page.

        Strategy:
        1. Same category (featured first, then newest)
        2. Supplement with same material if fewer than limit results
        3. Final fallback: any featured products
        """
        try:
            limit = min(12, max(1, int(limit)))
            Product = request.env['product.template'].sudo()
            base_url = self._resolve_base_url()

            product = Product.search(
                [('slug', '=', slug), ('available_on_website', '=', True)],
                limit=1,
            )
            if not product:
                return request.make_json_response(
                    {'success': False, 'error': 'Product not found', 'data': []},
                    status=404,
                )

            related = Product.browse([])   # empty recordset

            # 1. Same category
            if product.categ_id:
                related = Product.search([
                    ('available_on_website', '=', True),
                    ('categ_id', '=', product.categ_id.id),
                    ('id', '!=', product.id),
                ], limit=limit, order='is_featured desc, sequence asc, write_date desc')

            # 2. Supplement with same material
            if len(related) < limit and product.material:
                exclude_ids = related.ids + [product.id]
                more = Product.search([
                    ('available_on_website', '=', True),
                    ('material', '=', product.material),
                    ('id', 'not in', exclude_ids),
                ], limit=limit - len(related), order='write_date desc')
                related = related | more

            # 3. Featured fallback
            if not related:
                related = Product.search([
                    ('available_on_website', '=', True),
                    ('id', '!=', product.id),
                ], limit=limit, order='is_featured desc, write_date desc')

            return request.make_json_response({
                'success': True,
                'data': [self._serialize_product(p, base_url) for p in related[:limit]],
            })
        except Exception as e:
            _logger.exception('Error in get_related_products')
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': [],
            }, status=500)

    @http.route('/api/products/<slug>', auth='public', methods=['GET'], type='http', csrf=False)
    def get_product_by_slug(self, slug, **kwargs):
        """Get a single product by its URL slug."""
        try:
            Product = request.env['product.template'].sudo()
            product = Product.search([('slug', '=', slug)], limit=1)

            # Fallback: numeric ID after 'product-' prefix
            if not product and slug.startswith('product-'):
                try:
                    product_id = int(slug.split('-', 1)[1])
                    product = Product.browse(product_id)
                    if not product.exists():
                        product = Product.browse([])
                except (ValueError, IndexError):
                    pass

            if not product:
                return request.make_json_response({
                    'success': False,
                    'error': 'Product not found',
                    'data': None,
                }, status=404)

            base_url = self._resolve_base_url()
            return request.make_json_response({
                'success': True,
                'data': self._serialize_product(product, base_url),
            })

        except Exception as e:
            _logger.exception("Error in get_product_by_slug")
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': None,
            }, status=500)

    @http.route('/api/categories', auth='public', methods=['GET'], type='http', csrf=False)
    def get_categories(self, **kwargs):
        """Return all product categories that have at least one published product.

        Response:
          [{ id, name, slug, count, parentId }]
        """
        try:
            Product = request.env['product.template'].sudo()
            Category = request.env['product.category'].sudo()

            published = Product.search([('available_on_website', '=', True)])
            counts = {}
            for p in published:
                if p.categ_id:
                    counts[p.categ_id.id] = counts.get(p.categ_id.id, 0) + 1

            if not counts:
                return request.make_json_response({'success': True, 'data': []})

            categories = Category.search([('id', 'in', list(counts.keys()))])
            data = []
            for cat in categories.sorted(key=lambda c: c.name):
                slug = re.sub(r'[^a-z0-9]+', '-', cat.name.lower()).strip('-')
                data.append({
                    'id': cat.id,
                    'name': cat.name,
                    'slug': slug,
                    'count': counts.get(cat.id, 0),
                    'parentId': cat.parent_id.id if cat.parent_id else None,
                })

            return request.make_json_response({'success': True, 'data': data})

        except Exception as e:
            _logger.exception("Error in get_categories")
            return request.make_json_response({
                'success': False,
                'error': str(e),
                'data': [],
            }, status=500)

    @http.route('/api/health', auth='public', methods=['GET'], type='http', csrf=False)
    def health_check(self, **kwargs):
        """Health check endpoint."""
        return request.make_json_response({
            'status': 'ok',
            'service': 'odoo-api',
        })

    @http.route('/api/products/ingest', auth='public', methods=['POST'], type='http', csrf=False)
    def ingest_single_product(self, **kwargs):
        """Ingest a single product or small batch of products with image directly via HTTP."""
        try:
            try:
                body = json.loads(request.httprequest.data.decode('utf-8'))
            except Exception:
                body = {}

            items = body.get('products') if isinstance(body.get('products'), list) else [body]
            Product = request.env['product.template'].sudo()
            
            created_count = 0
            updated_count = 0
            results = []

            for item in items:
                sku = item.get('sku') or item.get('default_code') or item.get('vals', {}).get('default_code')
                name = item.get('name') or item.get('vals', {}).get('name') or 'Joya Fina Galantes'
                if not name and not sku:
                    continue

                vals = dict(item.get('vals', {}))
                vals['name'] = name
                vals['type'] = 'consu'  # Mandatory consumable product, NEVER a service
                vals['sale_ok'] = True
                vals['available_on_website'] = True
                vals['is_published'] = True

                if item.get('price'):
                    vals['list_price'] = float(item['price'])
                if item.get('cost'):
                    vals['standard_price'] = float(item['cost'])
                if item.get('description'):
                    vals['description_sale'] = item['description']

                primary_b64 = item.get('primaryImageBase64') or item.get('image_1920')
                if primary_b64:
                    vals['image_1920'] = primary_b64

                key = sku or f"GAL-{name}"
                vals['default_code'] = key

                existing = Product.search([('default_code', '=', key)], limit=1) if key else None
                if not existing:
                    existing = Product.search([('name', '=', name)], limit=1)

                if existing:
                    existing.write(vals)
                    prod_rec = existing
                    updated_count += 1
                else:
                    prod_rec = Product.create(vals)
                    created_count += 1

                results.append({
                    'id': prod_rec.id,
                    'sku': prod_rec.default_code,
                    'name': prod_rec.name,
                    'action': 'updated' if existing else 'created',
                })

            return request.make_json_response({
                'success': True,
                'created': created_count,
                'updated': updated_count,
                'items': results,
            })
        except Exception as e:
            _logger.exception("Error in ingest_single_product")
            return request.make_json_response({
                'success': False,
                'error': str(e),
            }, status=500)

    @http.route('/api/products/bulk', auth='public', methods=['POST'], type='http', csrf=False)
    def bulk_create_products(self, **kwargs):
        """Bulk ingest or update product templates in Odoo."""
        try:
            try:
                body = json.loads(request.httprequest.data.decode('utf-8'))
            except Exception:
                body = {}

            products_data = body.get('products', [])
            if not isinstance(products_data, list):
                return request.make_json_response({'success': False, 'error': 'products field must be a list'}, status=400)
            
            Product = request.env['product.template'].sudo()
            has_gallery_model = 'galantes.product.gallery' in request.env
            Gallery = request.env['galantes.product.gallery'].sudo() if has_gallery_model else None
            
            created_count = 0
            updated_count = 0
            details = []
            
            for item in products_data:
                vals = dict(item.get('vals', {}))
                if not vals.get('name'):
                    continue
                
                vals['type'] = 'consu'
                vals['sale_ok'] = True
                vals['available_on_website'] = True
                
                primary_base64 = item.get('primaryImageBase64')
                if primary_base64:
                    vals['image_1920'] = primary_base64
                
                key = vals.get('default_code')
                existing = Product.search([('default_code', '=', key)], limit=1) if key else None
                if not existing:
                    existing = Product.search([('name', '=', vals['name'])], limit=1)

                if existing:
                    existing.write(vals)
                    product_rec = existing
                    updated_count += 1
                else:
                    product_rec = Product.create(vals)
                    created_count += 1
                
                gallery_base64_list = item.get('galleryImagesBase64', [])
                if gallery_base64_list and Gallery:
                    for idx, img_b64 in enumerate(gallery_base64_list):
                        Gallery.create({
                            'product_id': product_rec.id,
                            'name': f"{product_rec.name}_gallery_{idx + 1}",
                            'image': img_b64,
                            'sequence': idx + 1,
                        })
                
                details.append({
                    'id': product_rec.id,
                    'name': product_rec.name,
                    'slug': getattr(product_rec, 'slug', f"product-{product_rec.id}"),
                })
            
            return request.make_json_response({
                'success': True,
                'created': created_count,
                'updated': updated_count,
                'total': len(details),
                'data': details,
            })
        except Exception as e:
            _logger.exception("Error in bulk_create_products")
            return request.make_json_response({
                'success': False,
                'error': str(e),
            }, status=500)
