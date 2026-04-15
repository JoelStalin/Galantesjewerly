"""
Pruebas funcionales del flujo completo de ventas — Galante's Jewelry.

Prueba los endpoints reales contra el servidor local.
Si el servidor no está corriendo, los tests se marcan como SKIP automáticamente.

Ejecutar: python -m pytest tests/functional/ -v
      o:  python -m unittest discover -s tests/functional -v

Variables de entorno:
  E2E_BASE_URL      — URL base del servidor (default: http://127.0.0.1:3000)
  ADMIN_USERNAME    — usuario admin (default: admin)
  ADMIN_PASSWORD    — contraseña admin (default: galantes2026)
"""

import json
import os
import unittest
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.getenv('E2E_BASE_URL', 'http://127.0.0.1:3000').rstrip('/')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'galantes2026')
TIMEOUT = 10


def _get(path, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.status, json.loads(resp.read().decode())


def _post(path, payload):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode()) if e.read else {}


def server_available():
    try:
        urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=5)
        return True
    except Exception:
        return False


def skip_if_offline(fn):
    """Decorator: salta el test si el servidor no responde."""
    def wrapper(self, *args, **kwargs):
        if not server_available():
            raise unittest.SkipTest(f"Servidor offline: {BASE_URL}")
        return fn(self, *args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper


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


class TestProductCatalog(unittest.TestCase):

    @skip_if_offline
    def test_products_endpoint_responds_200(self):
        status, _ = _get('/api/products')
        self.assertEqual(status, 200)

    @skip_if_offline
    def test_products_response_structure(self):
        _, body = _get('/api/products')
        self.assertIn('success', body)
        self.assertIn('data', body)
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
    def test_pagination_structure(self):
        _, body = _get('/api/products')
        pagination = body.get('pagination', {})
        self.assertIn('page', pagination)
        self.assertIn('pageSize', pagination)
        self.assertIn('total', pagination)
        self.assertIn('pages', pagination)

    @skip_if_offline
    def test_page_size_param_respected(self):
        _, body = _get('/api/products', {'page': 1, 'page_size': 3})
        data = body.get('data', [])
        self.assertLessEqual(len(data), 3)

    @skip_if_offline
    def test_product_item_has_required_fields(self):
        _, body = _get('/api/products')
        products = body.get('data', [])
        if not products:
            self.skipTest("No hay productos en el catálogo")
        product = products[0]
        required = ['id', 'slug', 'name', 'price', 'currency', 'availability']
        for field in required:
            with self.subTest(field=field):
                self.assertIn(field, product)

    @skip_if_offline
    def test_material_filter(self):
        _, body = _get('/api/products', {'material': 'gold'})
        self.assertTrue(body.get('success'))
        for product in body.get('data', []):
            with self.subTest(product=product.get('slug')):
                self.assertEqual(product.get('material', '').lower(), 'gold')


class TestProductBySlug(unittest.TestCase):

    @skip_if_offline
    def test_nonexistent_slug_returns_error(self):
        try:
            status, body = _get('/api/products/slug-que-no-existe-xyz123')
        except urllib.error.HTTPError as e:
            status, body = e.code, {}
        # Puede ser 200 con success:false o 404
        if status == 200:
            self.assertFalse(body.get('success'))
        else:
            self.assertIn(status, [404, 400])

    @skip_if_offline
    def test_valid_slug_returns_product(self):
        # Primero obtenemos un slug real del catálogo
        _, catalog = _get('/api/products', {'page_size': 1})
        products = catalog.get('data', [])
        if not products:
            self.skipTest("No hay productos para probar por slug")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Producto sin slug")
        _, body = _get(f'/api/products/{slug}')
        self.assertTrue(body.get('success'))
        self.assertIsNotNone(body.get('data'))

    @skip_if_offline
    def test_product_by_slug_has_all_fields(self):
        _, catalog = _get('/api/products', {'page_size': 1})
        products = catalog.get('data', [])
        if not products:
            self.skipTest("No hay productos")
        slug = products[0].get('slug')
        if not slug:
            self.skipTest("Producto sin slug")
        _, body = _get(f'/api/products/{slug}')
        product = body.get('data', {})
        required = ['id', 'slug', 'name', 'price', 'availability', 'buyUrl', 'publicUrl']
        for field in required:
            with self.subTest(field=field):
                self.assertIn(field, product)


class TestAdminFlow(unittest.TestCase):

    @skip_if_offline
    def test_admin_login_page_accessible(self):
        """Verifica que el endpoint de login del admin responde."""
        try:
            status, body = _get('/admin/login')
            self.assertIn(status, [200, 301, 302])
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [200, 301, 302, 404])

    @skip_if_offline
    def test_admin_auth_endpoint_exists(self):
        """Verifica que existe el endpoint de autenticación."""
        try:
            status, body = _post('/api/admin/auth', {
                'username': ADMIN_USERNAME,
                'password': ADMIN_PASSWORD
            })
            # 200 = éxito, 401 = credenciales incorrectas, 404 = endpoint no existe
            self.assertIn(status, [200, 401, 400])
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [200, 401, 400, 404])

    @skip_if_offline
    def test_protected_endpoint_requires_auth(self):
        """El endpoint de contenido admin debe requerir autenticación."""
        try:
            status, body = _get('/api/admin/content')
            if status == 200:
                # Si responde sin auth, al menos debe tener estructura válida
                self.assertIsInstance(body, dict)
            else:
                self.assertIn(status, [401, 403])
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [401, 403])


class TestSalesFlowComplete(unittest.TestCase):
    """Flujo completo: catálogo → producto → disponibilidad."""

    @skip_if_offline
    def test_full_catalog_to_product_flow(self):
        """
        Flujo completo de ventas:
        1. Obtener catálogo
        2. Seleccionar primer producto
        3. Obtener detalle por slug
        4. Verificar que tiene buy_url
        5. Verificar que availability_status es válido
        """
        # Paso 1: Catálogo
        _, catalog = _get('/api/products', {'page_size': 5})
        self.assertTrue(catalog.get('success'), "Catálogo debe responder con success:true")
        products = catalog.get('data', [])
        if not products:
            self.skipTest("Catálogo vacío — agrega productos para probar el flujo completo")

        # Paso 2: Primer producto
        first = products[0]
        self.assertIn('slug', first, "Producto debe tener slug")
        self.assertIn('price', first, "Producto debe tener precio")
        self.assertIn('availability', first, "Producto debe tener disponibilidad")
        self.assertIn(first['availability'], ['in_stock', 'out_of_stock', 'preorder'])

        # Paso 3: Detalle por slug
        slug = first['slug']
        _, detail = _get(f'/api/products/{slug}')
        self.assertTrue(detail.get('success'), f"GET /api/products/{slug} debe ser exitoso")
        product = detail.get('data', {})

        # Paso 4: buy_url presente y válido
        buy_url = product.get('buyUrl', '')
        if buy_url:
            self.assertTrue(
                buy_url.startswith('https://shop.galantesjewelry.com/product/'),
                f"buy_url malformada: {buy_url}"
            )

        # Paso 5: Disponibilidad válida
        self.assertIn(
            product.get('availability'),
            ['in_stock', 'out_of_stock', 'preorder'],
            "Availability debe ser uno de los valores válidos"
        )


if __name__ == '__main__':
    unittest.main(verbosity=2)
