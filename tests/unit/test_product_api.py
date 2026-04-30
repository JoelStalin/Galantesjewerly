"""
Unit tests for the Galante's Jewelry product API controller.

These tests run without a live Odoo instance by stubbing the minimal pieces of
the Odoo runtime that the controller imports and uses.
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
import types
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTROLLER_PATH = REPO_ROOT / 'odoo' / 'addons' / 'galantes_jewelry' / 'controllers' / 'product_api.py'


def _install_fake_odoo() -> types.SimpleNamespace:
    fake_http = types.ModuleType('odoo.http')

    class Controller:
        pass

    def route(*args, **kwargs):
        def decorator(fn):
            return fn

        return decorator

    fake_http.Controller = Controller
    fake_http.route = route
    fake_http.request = None

    fake_odoo = types.ModuleType('odoo')
    fake_odoo.http = fake_http

    sys.modules['odoo'] = fake_odoo
    sys.modules['odoo.http'] = fake_http
    return types.SimpleNamespace(http=fake_http, odoo=fake_odoo)


def _load_controller_module():
    _install_fake_odoo()
    spec = importlib.util.spec_from_file_location('galantes_product_api_test', CONTROLLER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeJsonResponse(dict):
    pass


class FakeCurrency:
    def __init__(self, name='USD'):
        self.name = name


class FakeCompany:
    def __init__(self, currency='USD'):
        self.currency_id = FakeCurrency(currency)


class FakeCategory:
    def __init__(self, category_id, name, parent_id=None):
        self.id = category_id
        self.name = name
        self.parent_id = parent_id


class FakeRecordSet:
    def __init__(self, records):
        self._records = list(records)

    def __iter__(self):
        return iter(self._records)

    def __len__(self):
        return len(self._records)

    def __bool__(self):
        return bool(self._records)

    def __getitem__(self, item):
        if isinstance(item, slice):
            return FakeRecordSet(self._records[item])
        return self._records[item]

    def sorted(self, key=None):
        return FakeRecordSet(sorted(self._records, key=key))

    @property
    def ids(self):
        return [record.id for record in self._records]

    def __or__(self, other):
        return FakeRecordSet(self._records + list(other))


class FakeProduct:
    def __init__(self, product_id, name, categ_id=None, slug=None):
        self.id = product_id
        self.name = name
        self.slug = slug or ''
        self.tagline = ''
        self.description_sale = ''
        self.storefront_short_description = ''
        self.storefront_long_description = ''
        self.product_details = ''
        self.care_and_shipping = ''
        self.list_price = 100.0
        self.company_id = FakeCompany()
        self.availability_status = 'in_stock'
        self.default_code = ''
        self.material = None
        self.buy_url = ''
        self.public_url = ''
        self.is_featured = False
        self.gallery_ids = []
        self.image_1920 = None
        self.categ_id = categ_id

    def get_material_display(self):
        return ''


class FakeProductModel:
    def __init__(self, products):
        self.products = list(products)
        self.last_domain = None

    def sudo(self):
        return self

    def _matches(self, product, domain):
        for condition in domain:
            if not isinstance(condition, tuple):
                continue
            field, operator, value = condition
            if field == 'available_on_website':
                if operator != '=' or value is not True:
                    return False
            elif field == 'categ_id' and operator == '=' and value is False:
                if product.categ_id is not None:
                    return False
            elif field == 'categ_id.name' and operator == 'ilike':
                if not product.categ_id or value.lower() not in product.categ_id.name.lower():
                    return False
        return True

    def search_count(self, domain):
        self.last_domain = list(domain)
        return len(self.search(domain))

    def search(self, domain, offset=0, limit=None, order=None):
        self.last_domain = list(domain)
        filtered = [product for product in self.products if self._matches(product, domain)]
        sliced = filtered[offset: offset + limit if limit is not None else None]
        return FakeRecordSet(sliced)


class FakeConfigParamModel:
    def __init__(self, base_url='https://shop.galantesjewelry.com'):
        self.base_url = base_url

    def sudo(self):
        return self

    def get_param(self, key):
        if key == 'web.base.url':
            return self.base_url
        return None


class FakeEnv(dict):
    def __getitem__(self, item):
        return dict.__getitem__(self, item)


class FakeRequest:
    def __init__(self, env):
        self.env = env
        self.httprequest = types.SimpleNamespace(host_url='https://fallback.example.com/')

    def make_json_response(self, payload, status=200):
        return FakeJsonResponse({'status': status, 'payload': payload})


class ProductAPITestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = _load_controller_module()

    def setUp(self):
        self.other_category = FakeProduct(1, 'Uncategorized Ring', categ_id=None, slug='ring-uncat')
        self.rings_category = FakeCategory(10, 'Rings')
        self.bridal_category = FakeCategory(20, 'Bridal')
        self.categorized_product = FakeProduct(2, 'Wedding Band', categ_id=self.rings_category, slug='wedding-band')
        self.uncategorized_product = FakeProduct(3, 'Loose Diamond', categ_id=None, slug='loose-diamond')
        self.secondary_uncategorized = FakeProduct(4, 'Unset Charm', categ_id=None, slug='unset-charm')

        self.product_model = FakeProductModel([
            self.categorized_product,
            self.uncategorized_product,
            self.secondary_uncategorized,
        ])
        self.category_model = FakeProductModel([
            self.rings_category,
            self.bridal_category,
        ])
        self.config_model = FakeConfigParamModel()

        env = FakeEnv({
            'product.template': self.product_model,
            'product.category': self.category_model,
            'ir.config_parameter': self.config_model,
        })
        self.request = FakeRequest(env)
        self.original_request = self.module.request
        self.module.request = self.request

    def tearDown(self):
        self.module.request = self.original_request

    def test_serialize_product_defaults_to_other_when_uncategorized(self):
        controller = self.module.ProductAPIController()
        payload = controller._serialize_product(self.uncategorized_product, 'https://shop.galantesjewelry.com')

        self.assertEqual(payload['category'], 'Other')
        self.assertEqual(payload['categoryId'], 0)

    def test_get_categories_includes_other_for_uncategorized_products(self):
        controller = self.module.ProductAPIController()
        response = controller.get_categories()

        self.assertEqual(response['status'], 200)
        categories = response['payload']['data']
        names = [item['name'] for item in categories]
        self.assertIn('Other', names)

        other = next(item for item in categories if item['name'] == 'Other')
        self.assertEqual(other['slug'], 'other')
        self.assertEqual(other['count'], 2)

    def test_get_products_with_other_category_returns_uncategorized_items(self):
        controller = self.module.ProductAPIController()
        response = controller.get_products(category='Other')

        self.assertEqual(response['status'], 200)
        payload = response['payload']
        products = payload['data']
        self.assertEqual(len(products), 2)
        self.assertTrue(all(product['category'] == 'Other' for product in products))
        self.assertTrue(all(product['categoryId'] == 0 for product in products))
        self.assertEqual(self.product_model.last_domain[-1], ('categ_id', '=', False))

    def test_get_products_with_real_category_still_uses_category_name_filter(self):
        controller = self.module.ProductAPIController()
        response = controller.get_products(category='Rings')

        self.assertEqual(response['status'], 200)
        payload = response['payload']
        self.assertEqual(len(payload['data']), 1)
        self.assertEqual(payload['data'][0]['category'], 'Rings')
        self.assertEqual(self.product_model.last_domain[-1], ('categ_id.name', 'ilike', 'Rings'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
