"""
Pruebas unitarias para ProductTemplate de Galante's Jewelry.

Mockea el ORM de Odoo — no requiere Odoo instalado.
Ejecutar: python -m pytest tests/unit/ -v
      o:  python -m unittest discover -s tests/unit -v
"""

import unittest
from unittest.mock import MagicMock, patch, PropertyMock


# ---------------------------------------------------------------------------
# Helpers para simular slugify de Odoo
# ---------------------------------------------------------------------------

import re
import unicodedata


def _slugify(s):
    """Replica simple de odoo.tools.slugify para los tests."""
    s = unicodedata.normalize('NFKD', s)
    s = s.encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r'[^\w\s-]', '', s).strip().lower()
    s = re.sub(r'[-\s]+', '-', s)
    return s


# ---------------------------------------------------------------------------
# Clase de producto simulada (sin heredar de Odoo)
# ---------------------------------------------------------------------------

class FakeProductTemplate:
    """
    Simula ProductTemplate de Odoo con la lógica de negocio pura
    extraída de galantes_jewelry/models/product_template.py
    """

    MATERIAL_SELECTION = [
        ('gold', 'Gold'),
        ('silver', 'Silver'),
        ('platinum', 'Platinum'),
        ('titanium', 'Titanium'),
        ('bronze', 'Bronze'),
        ('gemstone', 'Gemstone'),
        ('mixed', 'Mixed Materials'),
        ('other', 'Other'),
    ]

    def __init__(self, **kwargs):
        self.id = kwargs.get('id', 1)
        self.name = kwargs.get('name', '')
        self.slug = kwargs.get('slug', '')
        self.material = kwargs.get('material', None)
        self.type = kwargs.get('type', 'consu')
        self.qty_available = kwargs.get('qty_available', 0)
        self.allow_out_of_stock_order = kwargs.get('allow_out_of_stock_order', False)
        self.list_price = kwargs.get('list_price', 0.0)
        self.default_code = kwargs.get('default_code', '')
        self.description_sale = kwargs.get('description_sale', '')
        self.image_1920 = kwargs.get('image_1920', None)
        self.availability_status = None
        self.buy_url = None
        self.public_url = None

        # Simular company_id.currency_id.name
        currency_mock = MagicMock()
        currency_mock.name = kwargs.get('currency', 'USD')
        company_mock = MagicMock()
        company_mock.currency_id = currency_mock
        self.company_id = company_mock

        # Simular _fields para get_material_display
        material_field_mock = MagicMock()
        material_field_mock.selection = self.MATERIAL_SELECTION
        self._fields = {'material': material_field_mock}

    # ---- Lógica copiada de product_template.py ----------------------------

    @classmethod
    def _create(cls, vals):
        """Simula create() con auto-slug."""
        if not vals.get('slug') and vals.get('name'):
            vals['slug'] = _slugify(vals['name'])
        return cls(**vals)

    def _onchange_name(self):
        if self.name and not self.slug:
            self.slug = _slugify(self.name)

    def _compute_buy_url(self):
        if self.slug:
            self.buy_url = f"https://shop.galantesjewelry.com/product/{self.slug}"
        else:
            self.buy_url = None

    def _compute_public_url(self):
        if self.slug:
            self.public_url = f"https://shop.galantesjewelry.com/products/{self.slug}"
        else:
            self.public_url = None

    def _compute_availability(self):
        if self.type == 'service':
            self.availability_status = 'in_stock'
        else:
            if self.qty_available > 0:
                self.availability_status = 'in_stock'
            elif self.allow_out_of_stock_order:
                self.availability_status = 'preorder'
            else:
                self.availability_status = 'out_of_stock'

    def get_material_display(self):
        return dict(self._fields['material'].selection).get(self.material, '')

    def _export_to_meta(self):
        self._compute_buy_url()
        return {
            'id': self.id,
            'sku': self.default_code,
            'name': self.name,
            'description': self.description_sale or self.name,
            'price': self.list_price,
            'currency': self.company_id.currency_id.name,
            'image_url': (
                f"data:image/jpg;base64,{self.image_1920.decode()}"
                if self.image_1920 else None
            ),
            'availability': self.availability_status,
            'material': self.get_material_display(),
            'url': self.buy_url,
        }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSlugGeneration(unittest.TestCase):

    def test_simple_name_generates_slug(self):
        product = FakeProductTemplate._create({'name': 'Gold Ring'})
        self.assertEqual(product.slug, 'gold-ring')

    def test_name_with_spaces_and_caps(self):
        product = FakeProductTemplate._create({'name': 'Silver Bracelet Deluxe'})
        self.assertEqual(product.slug, 'silver-bracelet-deluxe')

    def test_existing_slug_not_overwritten_on_create(self):
        product = FakeProductTemplate._create({'name': 'Gold Ring', 'slug': 'my-custom-slug'})
        self.assertEqual(product.slug, 'my-custom-slug')

    def test_empty_name_no_slug(self):
        product = FakeProductTemplate._create({'name': ''})
        self.assertEqual(product.slug, '')

    def test_name_with_special_chars(self):
        product = FakeProductTemplate._create({'name': "Galante's Ring!"})
        self.assertIn('galante', product.slug)
        self.assertNotIn("'", product.slug)
        self.assertNotIn('!', product.slug)

    def test_name_with_accents(self):
        product = FakeProductTemplate._create({'name': 'Côte d\'Or'})
        # accents stripped, result is ascii
        self.assertTrue(product.slug.isascii())
        self.assertNotEqual(product.slug, '')


class TestOnchangeName(unittest.TestCase):

    def test_onchange_sets_slug_when_empty(self):
        product = FakeProductTemplate(name='')
        product.name = 'Platinum Necklace'
        product.slug = ''
        product._onchange_name()
        self.assertEqual(product.slug, 'platinum-necklace')

    def test_onchange_does_not_overwrite_existing_slug(self):
        product = FakeProductTemplate(name='Gold Ring', slug='existing-slug')
        product.name = 'New Name'
        product._onchange_name()
        self.assertEqual(product.slug, 'existing-slug')

    def test_onchange_with_empty_name_does_nothing(self):
        product = FakeProductTemplate(name='', slug='')
        product._onchange_name()
        self.assertEqual(product.slug, '')


class TestBuyUrl(unittest.TestCase):

    def test_buy_url_with_slug(self):
        product = FakeProductTemplate(slug='gold-ring')
        product._compute_buy_url()
        self.assertEqual(product.buy_url, 'https://shop.galantesjewelry.com/product/gold-ring')

    def test_buy_url_without_slug(self):
        product = FakeProductTemplate(slug='')
        product._compute_buy_url()
        self.assertIsNone(product.buy_url)

    def test_buy_url_format(self):
        product = FakeProductTemplate(slug='silver-bracelet-deluxe')
        product._compute_buy_url()
        self.assertTrue(product.buy_url.startswith('https://shop.galantesjewelry.com/product/'))


class TestPublicUrl(unittest.TestCase):

    def test_public_url_with_slug(self):
        product = FakeProductTemplate(slug='platinum-ring')
        product._compute_public_url()
        self.assertEqual(product.public_url, 'https://shop.galantesjewelry.com/products/platinum-ring')

    def test_public_url_without_slug(self):
        product = FakeProductTemplate(slug='')
        product._compute_public_url()
        self.assertIsNone(product.public_url)

    def test_buy_vs_public_url_differ(self):
        product = FakeProductTemplate(slug='test-slug')
        product._compute_buy_url()
        product._compute_public_url()
        # buy_url: /product/, public_url: /products/
        self.assertIn('/product/', product.buy_url)
        self.assertIn('/products/', product.public_url)
        self.assertNotEqual(product.buy_url, product.public_url)


class TestAvailability(unittest.TestCase):

    def test_in_stock_when_qty_positive(self):
        product = FakeProductTemplate(qty_available=5)
        product._compute_availability()
        self.assertEqual(product.availability_status, 'in_stock')

    def test_out_of_stock_when_qty_zero(self):
        product = FakeProductTemplate(qty_available=0, allow_out_of_stock_order=False)
        product._compute_availability()
        self.assertEqual(product.availability_status, 'out_of_stock')

    def test_preorder_when_allow_out_of_stock(self):
        product = FakeProductTemplate(qty_available=0, allow_out_of_stock_order=True)
        product._compute_availability()
        self.assertEqual(product.availability_status, 'preorder')

    def test_service_type_always_in_stock(self):
        product = FakeProductTemplate(type='service', qty_available=0)
        product._compute_availability()
        self.assertEqual(product.availability_status, 'in_stock')

    def test_fractional_qty_counts_as_in_stock(self):
        product = FakeProductTemplate(qty_available=0.5)
        product._compute_availability()
        self.assertEqual(product.availability_status, 'in_stock')


class TestMaterialDisplay(unittest.TestCase):

    def test_all_materials(self):
        expected = {
            'gold': 'Gold',
            'silver': 'Silver',
            'platinum': 'Platinum',
            'titanium': 'Titanium',
            'bronze': 'Bronze',
            'gemstone': 'Gemstone',
            'mixed': 'Mixed Materials',
            'other': 'Other',
        }
        for code, label in expected.items():
            with self.subTest(material=code):
                product = FakeProductTemplate(material=code)
                self.assertEqual(product.get_material_display(), label)

    def test_unknown_material_returns_empty(self):
        product = FakeProductTemplate(material='unobtainium')
        self.assertEqual(product.get_material_display(), '')

    def test_no_material_returns_empty(self):
        product = FakeProductTemplate(material=None)
        self.assertEqual(product.get_material_display(), '')


class TestExportToMeta(unittest.TestCase):

    def setUp(self):
        self.product = FakeProductTemplate(
            id=42,
            name='Gold Ring',
            slug='gold-ring',
            material='gold',
            list_price=299.99,
            default_code='SKU-001',
            description_sale='Beautiful gold ring',
            qty_available=3,
            currency='USD',
        )
        self.product._compute_availability()

    def test_required_fields_present(self):
        data = self.product._export_to_meta()
        required = ['id', 'sku', 'name', 'price', 'currency', 'availability', 'material', 'url']
        for field in required:
            with self.subTest(field=field):
                self.assertIn(field, data)

    def test_id_correct(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['id'], 42)

    def test_name_correct(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['name'], 'Gold Ring')

    def test_price_correct(self):
        data = self.product._export_to_meta()
        self.assertAlmostEqual(data['price'], 299.99)

    def test_currency_correct(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['currency'], 'USD')

    def test_availability_correct(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['availability'], 'in_stock')

    def test_material_display(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['material'], 'Gold')

    def test_url_uses_buy_url(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['url'], 'https://shop.galantesjewelry.com/product/gold-ring')

    def test_no_image_returns_none(self):
        data = self.product._export_to_meta()
        self.assertIsNone(data['image_url'])

    def test_description_fallback_to_name(self):
        product = FakeProductTemplate(name='Ring', slug='ring', description_sale='')
        data = product._export_to_meta()
        self.assertEqual(data['description'], 'Ring')


if __name__ == '__main__':
    unittest.main(verbosity=2)
