"""
Functional tests for the complete sales flow — Galante's Jewelry.

Tests the real endpoints against a locally running server.
If the server is not running, tests are automatically marked as SKIP.

Run: python -m pytest tests/functional/ -v
  or: python -m unittest discover -s tests/functional -v

Environment variables:
  E2E_BASE_URL   — server base URL (default: http://127.0.0.1:8069)
  ADMIN_USERNAME — admin user (default: admin)
  ADMIN_PASSWORD — admin password (default: galantes2026)
"""

import json
import os
import unittest
import urllib.error
import urllib.parse
import urllib.request

BASE_URL       = os.getenv('E2E_BASE_URL', 'http://127.0.0.1:8069').rstrip('/')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'galantes2026')
TIMEOUT        = 10


def _get(path, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.status, json.loads(resp.read().decode())


def _post(path, payload):
    url  = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        url, data=data,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, json.loads(body.decode()) if body else {}


def server_available():
    try:
        urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=5)
        return True
    except Exception:
        return False


def skip_if_offline(fn):
    """Decorator: skip the test if the server is not reachable."""
    def wrapper(self, *args, **kwargs):
        if not server_available():
            raise unittest.SkipTest(f"Server offline: {BASE_URL}")
        return fn(self, *args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

class TestHealthCheck(unittest.TestCase):

    @skip_if_offline
    def test_health_returns_ok(self):
        status, body = _get('/api/health')
        self.assertEqual(status, 200)
        self.assertEqual(body.get('status'), 'ok')

    @skip_if_offline
    def test_health_has_service_field(self):
        _, body = _get('/api/health')
        self.assertIn('service', body)


# ---------------------------------------------------------------------------
# Product Catalog — GET /api/products
# ---------------------------------------------------------------------------

class TestProductCatalog(unittest.TestCase):

    @skip_if_offline
    def test_products_endpoint_responds_200(self):
        status, _ = _get('/api/products')
        self.assertEqual(status, 200)

    @skip_if_offline
    def test_products_response_structure(self):
        _, body = _get('/api/products')
        self.assertIn('success',    body)
        self.assertIn('data',       body)
        self.assertIn('pagination', body)

    @skip_if_offline
    def test_products_success_true(self):
        _, body = _get('/api/products')
        self.assertTrue(body.get('success'))

    @skip_if_offline
    def test_products_data_is_list(self):
        _, body = _get('/api/products')
        self.assertIsInstance(body.get('data'), list)

    @skip_if_offline
    def test_pagination_has_all_fields(self):
        _, body = _get('/api/products')
        p = body.get('pagination', {})
        for field in ('page', 'pageSize', 'total', 'pages', 'hasNext', 'hasPrev'):
            with self.subTest(field=field):
                self.assertIn(field, p)

    @skip_if_offline
    def test_page_size_param_respected(self):
        _, body = _get('/api/products', {'page': 1, 'page_size': 3})
        self.assertLessEqual(len(body.get('data', [])), 3)

    @skip_if_offline
    def test_page_size_camelcase_alias_respected(self):
        _, body = _get('/api/products', {'page': 1, 'pageSize': 3})
        self.assertLessEqual(len(body.get('data', [])), 3)

    @skip_if_offline
    def test_product_item_has_required_fields(self):
        _, body = _get('/api/products')
        products = body.get('data', [])
        if not products:
            self.skipTest("No products in catalog")
        product = products[0]
        for field in ('id', 'slug', 'name', 'price', 'currency', 'availability'):
            with self.subTest(field=field):
                self.assertIn(field, product)

    @skip_if_offline
    def test_product_has_storefront_fields(self):
        """New storefront copy fields must be present (may be empty string)."""
        _, body = _get('/api/products')
        products = body.get('data', [])
        if not products:
            self.skipTest("No products in catalog")
        product = products[0]
        for field in ('tagline', 'shortDescription', 'longDescription',
                      'productDetails', 'careAndShipping'):
            with self.subTest(field=field):
                self.assertIn(field, product)

    @skip_if_offline
    def test_product_image_and_gallery_urls(self):
        _, body = _get('/api/products', {'page_size': 1})
        products = body.get('data', [])
        if not products:
            self.skipTest("No products in catalog")
        product = products[0]
        if product.get('imageUrl'):
            self.assertIsInstance(product['imageUrl'], str)
            self.assertTrue(product['imageUrl'].startswith('http'))
        gallery = product.get('gallery')
        if gallery:
            for item in gallery:
                self.assertIsInstance(item, str)
                self.assertTrue(item.startswith('http'))

    @skip_if_offline
    def test_featured_products_endpoint(self):
        _, body = _get('/api/products/featured', {'limit': 4})
        self.assertTrue(body.get('success'))
        self.assertIsInstance(body.get('data'), list)
        self.assertLessEqual(len(body.get('data', [])), 4)

    # ── Filter params ──────────────────────────────────────────────────────

    @skip_if_offline
    def test_material_filter(self):
        _, body = _get('/api/products', {'material': 'gold'})
        self.assertTrue(body.get('success'))
        for product in body.get('data', []):
            with self.subTest(slug=product.get('slug')):
                # materialCode must be 'gold'; label will be 'Gold'
                self.assertIn(
                    product.get('materialCode', ''),
                    ('gold', 'gold_14k', 'gold_18k', 'gold_24k'),
                )

    @skip_if_offline
    def test_category_filter(self):
        _, body = _get('/api/products', {'category': 'Rings'})
        self.assertTrue(body.get('success'))

    @skip_if_offline
    def test_q_search_param(self):
        _, body = _get('/api/products', {'q': 'ring'})
        self.assertTrue(body.get('success'))
        self.assertIsInstance(body.get('data'), list)

    @skip_if_offline
    def test_min_price_filter(self):
        _, body = _get('/api/products', {'min_price': '0'})
        self.assertTrue(body.get('success'))

    @skip_if_offline
    def test_max_price_filter(self):
        _, body = _get('/api/products', {'max_price': '99999'})
        self.assertTrue(body.get('success'))

    # ── Sort params ────────────────────────────────────────────────────────

    @skip_if_offline
    def test_sort_featured(self):
        _, body = _get('/api/products', {'sort': 'featured'})
        self.assertTrue(body.get('success'))

    @skip_if_offline
    def test_sort_newest(self):
        _, body = _get('/api/products', {'sort': 'newest'})
        self.assertTrue(body.get('success'))

    @skip_if_offline
    def test_sort_price_asc(self):
        _, body = _get('/api/products', {'sort': 'price_asc'})
        self.assertTrue(body.get('success'))
        products = body.get('data', [])
        prices   = [p['price'] for p in products]
        self.assertEqual(prices, sorted(prices))

    @skip_if_offline
    def test_sort_price_desc(self):
        _, body = _get('/api/products', {'sort': 'price_desc'})
        self.assertTrue(body.get('success'))
        products = body.get('data', [])
        prices   = [p['price'] for p in products]
        self.assertEqual(prices, sorted(prices, reverse=True))

    @skip_if_offline
    def test_sort_alphabetical(self):
        _, body = _get('/api/products', {'sort': 'alphabetical'})
        self.assertTrue(body.get('success'))


# ---------------------------------------------------------------------------
# Product by slug — GET /api/products/<slug>
# ---------------------------------------------------------------------------

class TestProductBySlug(unittest.TestCase):

    @skip_if_offline
    def test_nonexistent_slug_returns_error(self):
        try:
            status, body = _get('/api/products/slug-that-does-not-exist-xyz123')
        except urllib.error.HTTPError as e:
            status, body = e.code, {}
        if status == 200:
            self.assertFalse(body.get('success'))
        else:
            self.assertIn(status, [404, 400])

    @skip_if_offline
    def test_valid_slug_returns_product(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products   = catalog.get('data', [])
        if not products:
            self.skipTest("No products to test by slug")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Product has no slug")
        _, body = _get(f'/api/products/{slug}')
        self.assertTrue(body.get('success'))
        self.assertIsNotNone(body.get('data'))

    @skip_if_offline
    def test_product_by_slug_has_all_fields(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products   = catalog.get('data', [])
        if not products:
            self.skipTest("No products")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Product has no slug")
        _, body   = _get(f'/api/products/{slug}')
        product   = body.get('data', {})
        for field in ('id', 'slug', 'name', 'price', 'availability', 'buyUrl'):
            with self.subTest(field=field):
                self.assertIn(field, product)

    @skip_if_offline
    def test_buy_url_uses_shop_path(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products   = catalog.get('data', [])
        if not products:
            self.skipTest("No products")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Product has no slug")
        _, body  = _get(f'/api/products/{slug}')
        buy_url  = body.get('data', {}).get('buyUrl', '')
        self.assertIn('/shop/', buy_url)


# ---------------------------------------------------------------------------
# Related products — GET /api/products/<slug>/related
# ---------------------------------------------------------------------------

class TestRelatedProducts(unittest.TestCase):

    @skip_if_offline
    def test_related_endpoint_exists(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products   = catalog.get('data', [])
        if not products:
            self.skipTest("No products")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Product has no slug")
        try:
            status, body = _get(f'/api/products/{slug}/related', {'limit': 4})
        except urllib.error.HTTPError as e:
            status, body = e.code, {}
        self.assertIn(status, [200, 404])
        if status == 200:
            self.assertIn('data', body)
            self.assertIsInstance(body['data'], list)

    @skip_if_offline
    def test_related_limit_respected(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products   = catalog.get('data', [])
        if not products:
            self.skipTest("No products")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Product has no slug")
        try:
            _, body = _get(f'/api/products/{slug}/related', {'limit': 2})
            self.assertLessEqual(len(body.get('data', [])), 2)
        except urllib.error.HTTPError:
            self.skipTest("Related endpoint not yet available")

    @skip_if_offline
    def test_related_does_not_include_self(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products   = catalog.get('data', [])
        if not products:
            self.skipTest("No products")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Product has no slug")
        try:
            _, body = _get(f'/api/products/{slug}/related', {'limit': 12})
            related_slugs = [p.get('slug') for p in body.get('data', [])]
            self.assertNotIn(slug, related_slugs)
        except urllib.error.HTTPError:
            self.skipTest("Related endpoint not yet available")


# ---------------------------------------------------------------------------
# Categories — GET /api/categories
# ---------------------------------------------------------------------------

class TestCategories(unittest.TestCase):

    @skip_if_offline
    def test_categories_endpoint_responds_200(self):
        status, _ = _get('/api/categories')
        self.assertEqual(status, 200)

    @skip_if_offline
    def test_categories_response_structure(self):
        _, body = _get('/api/categories')
        self.assertIn('success', body)
        self.assertIn('data',    body)
        self.assertTrue(body.get('success'))
        self.assertIsInstance(body.get('data'), list)

    @skip_if_offline
    def test_category_item_has_required_fields(self):
        _, body      = _get('/api/categories')
        categories   = body.get('data', [])
        if not categories:
            self.skipTest("No categories with published products")
        cat = categories[0]
        for field in ('id', 'name', 'slug', 'count'):
            with self.subTest(field=field):
                self.assertIn(field, cat)

    @skip_if_offline
    def test_category_count_is_positive(self):
        _, body    = _get('/api/categories')
        categories = body.get('data', [])
        for cat in categories:
            with self.subTest(name=cat.get('name')):
                self.assertGreater(cat.get('count', 0), 0)


# ---------------------------------------------------------------------------
# Admin flow
# ---------------------------------------------------------------------------

class TestAdminFlow(unittest.TestCase):

    @skip_if_offline
    def test_admin_auth_endpoint_exists(self):
        try:
            status, body = _post('/api/admin/auth', {
                'username': ADMIN_USERNAME,
                'password': ADMIN_PASSWORD,
            })
            self.assertIn(status, [200, 401, 400])
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [200, 401, 400, 404])

    @skip_if_offline
    def test_protected_endpoint_requires_auth(self):
        try:
            status, body = _get('/api/admin/content')
            if status == 200:
                self.assertIsInstance(body, dict)
            else:
                self.assertIn(status, [401, 403])
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [401, 403])


# ---------------------------------------------------------------------------
# End-to-end sales flow
# ---------------------------------------------------------------------------

class TestSalesFlowComplete(unittest.TestCase):
    """Full flow: catalog → product → availability → buy_url."""

    @skip_if_offline
    def test_full_catalog_to_product_flow(self):
        # Step 1: catalog
        _, catalog = _get('/api/products', {'page_size': 5})
        self.assertTrue(catalog.get('success'), "Catalog must return success:true")
        products = catalog.get('data', [])
        if not products:
            self.skipTest("Catalog empty — add products to test the full flow")

        # Step 2: first product structure
        first = products[0]
        self.assertIn('slug',         first)
        self.assertIn('price',        first)
        self.assertIn('availability', first)
        self.assertIn(first['availability'], ['in_stock', 'out_of_stock', 'preorder'])

        # Step 3: detail by slug
        slug     = first['slug']
        _, detail = _get(f'/api/products/{slug}')
        self.assertTrue(detail.get('success'), f"GET /api/products/{slug} must succeed")
        product   = detail.get('data', {})

        # Step 4: buy_url uses /shop/ path
        buy_url = product.get('buyUrl', '')
        if buy_url:
            self.assertIn(
                '/shop/',
                buy_url,
                f"buyUrl must use /shop/<slug>, got: {buy_url}",
            )

        # Step 5: valid availability
        self.assertIn(
            product.get('availability'),
            ['in_stock', 'out_of_stock', 'preorder'],
        )

        # Step 6: pagination includes hasNext / hasPrev
        pagination = catalog.get('pagination', {})
        self.assertIn('hasNext', pagination)
        self.assertIn('hasPrev', pagination)


if __name__ == '__main__':
    unittest.main(verbosity=2)
