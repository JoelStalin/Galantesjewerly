"""
Unit tests for ProductTemplate — Galante's Jewelry.

Mocks the Odoo ORM — no Odoo installation required.
Run: python -m pytest tests/unit/ -v
  or: python -m unittest discover -s tests/unit -v
"""

import unittest
from unittest.mock import MagicMock

import re
import unicodedata


# ---------------------------------------------------------------------------
# Slugify helper (mirrors _slugify_text in product_template.py)
# ---------------------------------------------------------------------------

def _slugify_text(text):
    """Replica of _slugify_text from the Odoo model."""
    if not text:
        return ''
    text = unicodedata.normalize('NFD', str(text))
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')


# ---------------------------------------------------------------------------
# Fake product model (without Odoo ORM dependency)
# ---------------------------------------------------------------------------

MATERIAL_SELECTION = [
    ('gold',             'Gold'),
    ('gold_14k',         '14K Gold'),
    ('gold_18k',         '18K Gold'),
    ('gold_24k',         '24K Gold'),
    ('rose_gold',        'Rose Gold'),
    ('rose_gold_14k',    '14K Rose Gold'),
    ('white_gold',       'White Gold'),
    ('white_gold_14k',   '14K White Gold'),
    ('silver',           'Sterling Silver'),
    ('silver_925',       '925 Sterling Silver'),
    ('platinum',         'Platinum'),
    ('titanium',         'Titanium'),
    ('bronze',           'Bronze'),
    ('stainless_steel',  'Stainless Steel'),
    ('gemstone',         'Gemstone'),
    ('mixed',            'Mixed Materials'),
    ('other',            'Other'),
]


class FakeProductTemplate:
    """
    Mirrors the business logic from
    galantes_jewelry/models/product_template.py
    without any Odoo ORM dependency.
    """

    def __init__(self, **kwargs):
        self.id                           = kwargs.get('id', 1)
        self.name                         = kwargs.get('name', '')
        self.slug                         = kwargs.get('slug', '')
        self.material                     = kwargs.get('material', None)
        self.type                         = kwargs.get('type', 'consu')
        self.qty_available                = kwargs.get('qty_available', 0)
        self.allow_out_of_stock_order     = kwargs.get('allow_out_of_stock_order', False)
        self.list_price                   = kwargs.get('list_price', 0.0)
        self.default_code                 = kwargs.get('default_code', '')
        self.description_sale             = kwargs.get('description_sale', '')
        self.tagline                      = kwargs.get('tagline', '')
        self.storefront_short_description = kwargs.get('storefront_short_description', '')
        self.storefront_long_description  = kwargs.get('storefront_long_description', '')
        self.product_details              = kwargs.get('product_details', '')
        self.care_and_shipping            = kwargs.get('care_and_shipping', '')
        self.image_1920                   = kwargs.get('image_1920', None)
        self.availability_status          = None
        self.buy_url                      = None
        self.public_url                   = None

        currency_mock        = MagicMock()
        currency_mock.name   = kwargs.get('currency', 'USD')
        company_mock         = MagicMock()
        company_mock.currency_id = currency_mock
        self.company_id      = company_mock

    # ── Business logic (mirrors product_template.py) ─────────────────────

    @classmethod
    def _create(cls, vals):
        """Simulates create() with auto-slug."""
        if not vals.get('slug') and vals.get('name'):
            vals['slug'] = _slugify_text(vals['name'])
        return cls(**vals)

    def _onchange_name(self):
        if self.name and not self.slug:
            self.slug = _slugify_text(self.name)

    def _compute_storefront_urls(self):
        """Both buy_url and public_url point to /shop/<slug>."""
        base = 'https://shop.galantesjewelry.com'
        slug = self.slug or (f'product-{self.id}' if self.id else '')
        url  = f'{base}/shop/{slug}' if slug else base
        self.buy_url    = url
        self.public_url = url

    # Keep compat aliases so older call sites still work
    def _compute_buy_url(self):
        self._compute_storefront_urls()

    def _compute_public_url(self):
        self._compute_storefront_urls()

    def _compute_availability(self):
        if self.type == 'service':
            self.availability_status = 'in_stock'
        elif self.qty_available > 0:
            self.availability_status = 'in_stock'
        elif self.allow_out_of_stock_order:
            self.availability_status = 'preorder'
        else:
            self.availability_status = 'out_of_stock'

    def get_material_display(self):
        return dict(MATERIAL_SELECTION).get(self.material, '') if self.material else ''

    def _export_to_meta(self):
        self._compute_storefront_urls()
        self._compute_availability()
        return {
            'id':           self.id,
            'sku':          self.default_code,
            'name':         self.name,
            'description': (
                self.storefront_short_description
                or self.tagline
                or self.description_sale
                or self.name
            ),
            'price':        self.list_price,
            'currency':     self.company_id.currency_id.name,
            'image_url':    None,
            'availability': self.availability_status,
            'material':     self.get_material_display(),
            'url':          self.buy_url,
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
        product = FakeProductTemplate._create({'name': "Côte d'Or"})
        self.assertTrue(product.slug.isascii())
        self.assertNotEqual(product.slug, '')


class TestOnchangeName(unittest.TestCase):

    def test_onchange_sets_slug_when_empty(self):
        product       = FakeProductTemplate(name='')
        product.name  = 'Platinum Necklace'
        product.slug  = ''
        product._onchange_name()
        self.assertEqual(product.slug, 'platinum-necklace')

    def test_onchange_does_not_overwrite_existing_slug(self):
        product       = FakeProductTemplate(name='Gold Ring', slug='existing-slug')
        product.name  = 'New Name'
        product._onchange_name()
        self.assertEqual(product.slug, 'existing-slug')

    def test_onchange_with_empty_name_does_nothing(self):
        product = FakeProductTemplate(name='', slug='')
        product._onchange_name()
        self.assertEqual(product.slug, '')


class TestStorefrontUrls(unittest.TestCase):
    """buy_url and public_url both use /shop/<slug> (canonical pattern)."""

    def test_buy_url_uses_shop_path(self):
        product = FakeProductTemplate(slug='gold-ring')
        product._compute_storefront_urls()
        self.assertEqual(product.buy_url, 'https://shop.galantesjewelry.com/shop/gold-ring')

    def test_public_url_uses_shop_path(self):
        product = FakeProductTemplate(slug='platinum-ring')
        product._compute_storefront_urls()
        self.assertEqual(product.public_url, 'https://shop.galantesjewelry.com/shop/platinum-ring')

    def test_buy_url_equals_public_url(self):
        """buy_url and public_url are the same canonical /shop/<slug> URL."""
        product = FakeProductTemplate(slug='test-slug')
        product._compute_storefront_urls()
        self.assertEqual(product.buy_url, product.public_url)

    def test_url_format_starts_with_shop(self):
        product = FakeProductTemplate(slug='silver-bracelet-deluxe')
        product._compute_storefront_urls()
        self.assertTrue(product.buy_url.startswith('https://shop.galantesjewelry.com/shop/'))

    def test_no_slug_falls_back_to_product_id(self):
        product = FakeProductTemplate(slug='', id=99)
        product._compute_storefront_urls()
        self.assertIn('product-99', product.buy_url)

    def test_compat_alias_compute_buy_url(self):
        """_compute_buy_url() alias still populates buy_url."""
        product = FakeProductTemplate(slug='ring')
        product._compute_buy_url()
        self.assertIn('/shop/ring', product.buy_url)

    def test_compat_alias_compute_public_url(self):
        product = FakeProductTemplate(slug='ring')
        product._compute_public_url()
        self.assertIn('/shop/ring', product.public_url)


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

    def test_all_canonical_materials(self):
        """Verify English labels for the full material selection."""
        expected = {
            'gold':           'Gold',
            'gold_14k':       '14K Gold',
            'gold_18k':       '18K Gold',
            'gold_24k':       '24K Gold',
            'rose_gold':      'Rose Gold',
            'rose_gold_14k':  '14K Rose Gold',
            'white_gold':     'White Gold',
            'white_gold_14k': '14K White Gold',
            'silver':         'Sterling Silver',
            'silver_925':     '925 Sterling Silver',
            'platinum':       'Platinum',
            'titanium':       'Titanium',
            'bronze':         'Bronze',
            'stainless_steel':'Stainless Steel',
            'gemstone':       'Gemstone',
            'mixed':          'Mixed Materials',
            'other':          'Other',
        }
        for code, label in expected.items():
            with self.subTest(material=code):
                product = FakeProductTemplate(material=code)
                self.assertEqual(product.get_material_display(), label)

    def test_silver_label_is_sterling_silver(self):
        """Verify 'silver' displays as 'Sterling Silver' (not just 'Silver')."""
        product = FakeProductTemplate(material='silver')
        self.assertEqual(product.get_material_display(), 'Sterling Silver')

    def test_unknown_material_returns_empty(self):
        product = FakeProductTemplate(material='unobtainium')
        self.assertEqual(product.get_material_display(), '')

    def test_no_material_returns_empty(self):
        product = FakeProductTemplate(material=None)
        self.assertEqual(product.get_material_display(), '')


class TestStorefrontCopyFields(unittest.TestCase):
    """New storefront-specific copy fields are present and accessible."""

    def test_tagline_stored(self):
        product = FakeProductTemplate(tagline='Handcrafted in 14K gold')
        self.assertEqual(product.tagline, 'Handcrafted in 14K gold')

    def test_storefront_short_description_stored(self):
        product = FakeProductTemplate(
            storefront_short_description='A radiant piece for everyday wear.'
        )
        self.assertEqual(
            product.storefront_short_description,
            'A radiant piece for everyday wear.',
        )

    def test_storefront_long_description_stored(self):
        long = 'This necklace is crafted with care…'
        product = FakeProductTemplate(storefront_long_description=long)
        self.assertEqual(product.storefront_long_description, long)

    def test_product_details_stored(self):
        details = 'Metal: 14K Yellow Gold\nWeight: 2.4g'
        product  = FakeProductTemplate(product_details=details)
        self.assertEqual(product.product_details, details)

    def test_care_and_shipping_stored(self):
        care    = 'Store in a jewelry box. Free US shipping.'
        product = FakeProductTemplate(care_and_shipping=care)
        self.assertEqual(product.care_and_shipping, care)


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

    def test_required_fields_present(self):
        data = self.product._export_to_meta()
        for field in ['id', 'sku', 'name', 'price', 'currency', 'availability', 'material', 'url']:
            with self.subTest(field=field):
                self.assertIn(field, data)

    def test_id_correct(self):
        self.assertEqual(self.product._export_to_meta()['id'], 42)

    def test_name_correct(self):
        self.assertEqual(self.product._export_to_meta()['name'], 'Gold Ring')

    def test_price_correct(self):
        self.assertAlmostEqual(self.product._export_to_meta()['price'], 299.99)

    def test_currency_correct(self):
        self.assertEqual(self.product._export_to_meta()['currency'], 'USD')

    def test_availability_correct(self):
        self.assertEqual(self.product._export_to_meta()['availability'], 'in_stock')

    def test_material_display(self):
        self.assertEqual(self.product._export_to_meta()['material'], 'Gold')

    def test_url_uses_shop_path(self):
        data = self.product._export_to_meta()
        self.assertEqual(data['url'], 'https://shop.galantesjewelry.com/shop/gold-ring')

    def test_no_image_returns_none(self):
        self.assertIsNone(self.product._export_to_meta()['image_url'])

    def test_description_uses_storefront_short_first(self):
        self.product.storefront_short_description = 'Premium storefront copy'
        data = self.product._export_to_meta()
        self.assertEqual(data['description'], 'Premium storefront copy')

    def test_description_falls_back_to_tagline(self):
        self.product.storefront_short_description = ''
        self.product.tagline                       = 'Elegant tagline'
        data = self.product._export_to_meta()
        self.assertEqual(data['description'], 'Elegant tagline')

    def test_description_falls_back_to_description_sale(self):
        self.product.storefront_short_description = ''
        self.product.tagline                       = ''
        data = self.product._export_to_meta()
        self.assertEqual(data['description'], 'Beautiful gold ring')

    def test_description_falls_back_to_name(self):
        product = FakeProductTemplate(name='Ring', slug='ring')
        data    = product._export_to_meta()
        self.assertEqual(data['description'], 'Ring')


if __name__ == '__main__':
    unittest.main(verbosity=2)
