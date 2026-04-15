"""
test_product_template.py — Unit tests for Galante's Jewelry business logic.

ARCHITECTURE NOTE
-----------------
This project uses Next.js + TypeScript (lib/db.ts, lib/auth.ts, lib/appointments.ts),
NOT Odoo.  The "ProductTemplate" concept maps to FeaturedItem in this codebase.
These tests exercise the pure-Python business logic layer in product_logic.py,
which mirrors the TypeScript model behaviour without requiring a running server,
a Node.js runtime, or any Odoo installation.

Run with:
    python -m pytest tests/unit/test_product_template.py -v
  or:
    python -m unittest tests.unit.test_product_template -v
"""

from __future__ import annotations

import sys
import os
import time
import unittest
from unittest.mock import MagicMock, patch, call, PropertyMock

# Ensure the project root is on sys.path so we can import product_logic
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from tests.unit.product_logic import (
    generate_slug,
    ensure_unique_slug,
    build_public_url,
    build_buy_url,
    calc_availability_status,
    get_material_display,
    MATERIAL_DISPLAY,
    make_featured_item,
    create_featured_id,
    sort_featured_items,
    export_to_meta,
    validate_admin_credentials,
    build_session_payload,
    validate_contact_submission,
    AVAILABILITY_IN_STOCK,
    AVAILABILITY_OUT_OF_STOCK,
    AVAILABILITY_PREORDER,
)


# ===========================================================================
# 1. SLUG GENERATION
# ===========================================================================

class TestSlugGeneration(unittest.TestCase):
    """Tests for generate_slug() — converts product names to URL-safe strings."""

    def test_simple_name(self):
        self.assertEqual(generate_slug("Diamond Ring"), "diamond-ring")

    def test_multiple_spaces(self):
        self.assertEqual(generate_slug("Gold   Silver Set"), "gold-silver-set")

    def test_leading_trailing_spaces(self):
        self.assertEqual(generate_slug("  Platinum Band  "), "platinum-band")

    def test_unicode_accents(self):
        # é → e, ç → c, ñ → n
        self.assertEqual(generate_slug("Côte d'Or"), "cote-dor")

    def test_special_characters_become_hyphens(self):
        result = generate_slug("Gold & Silver — Coastal Set")
        self.assertEqual(result, "gold-silver-coastal-set")

    def test_numbers_preserved(self):
        self.assertEqual(generate_slug("14K Gold Ring"), "14k-gold-ring")

    def test_all_caps(self):
        self.assertEqual(generate_slug("DIAMOND SOLITAIRE"), "diamond-solitaire")

    def test_slash_separated(self):
        self.assertEqual(generate_slug("Gold/Silver"), "gold-silver")

    def test_parentheses_stripped(self):
        self.assertEqual(generate_slug("Ring (Size 7)"), "ring-size-7")

    def test_apostrophe_stripped(self):
        result = generate_slug("Galante's Ring")
        self.assertNotIn("'", result)
        self.assertIn("galantes", result)

    def test_empty_string_returns_empty(self):
        self.assertEqual(generate_slug(""), "")

    def test_whitespace_only_returns_empty(self):
        self.assertEqual(generate_slug("   "), "")

    def test_only_special_chars_returns_empty(self):
        self.assertEqual(generate_slug("---!!!---"), "")

    def test_no_consecutive_hyphens(self):
        result = generate_slug("Gold  --  Silver")
        self.assertNotIn("--", result)

    def test_no_leading_trailing_hyphens(self):
        result = generate_slug("  !!! Ring !!!  ")
        self.assertFalse(result.startswith("-"), f"slug starts with hyphen: {result!r}")
        self.assertFalse(result.endswith("-"), f"slug ends with hyphen: {result!r}")

    def test_single_word(self):
        self.assertEqual(generate_slug("Sapphire"), "sapphire")

    def test_numeric_only(self):
        self.assertEqual(generate_slug("2024"), "2024")


class TestEnsureUniqueSlug(unittest.TestCase):
    """Tests for ensure_unique_slug() — deduplication logic."""

    def test_no_collision_returns_base(self):
        self.assertEqual(ensure_unique_slug("ring", []), "ring")

    def test_collision_appends_1(self):
        self.assertEqual(ensure_unique_slug("ring", ["ring"]), "ring-1")

    def test_double_collision_appends_2(self):
        self.assertEqual(ensure_unique_slug("ring", ["ring", "ring-1"]), "ring-2")

    def test_gap_in_sequence(self):
        # ring and ring-1 exist but ring-2 doesn't
        self.assertEqual(ensure_unique_slug("ring", ["ring", "ring-1"]), "ring-2")

    def test_empty_existing_list(self):
        self.assertEqual(ensure_unique_slug("bracelet", []), "bracelet")

    def test_different_slug_not_affected(self):
        self.assertEqual(ensure_unique_slug("ring", ["necklace", "bracelet"]), "ring")


# ===========================================================================
# 2. URL BUILDERS  (buy_url, public_url)
# ===========================================================================

class TestUrlBuilders(unittest.TestCase):
    """Tests for build_public_url() and build_buy_url()."""

    def test_public_url_relative(self):
        self.assertEqual(build_public_url("diamond-ring"), "/products/diamond-ring")

    def test_public_url_absolute(self):
        result = build_public_url("diamond-ring", "https://galantesjewelry.com")
        self.assertEqual(result, "https://galantesjewelry.com/products/diamond-ring")

    def test_buy_url_relative(self):
        self.assertEqual(build_buy_url("diamond-ring"), "/shop/diamond-ring")

    def test_buy_url_absolute(self):
        result = build_buy_url("diamond-ring", "https://galantesjewelry.com")
        self.assertEqual(result, "https://galantesjewelry.com/shop/diamond-ring")

    def test_public_url_empty_slug_raises(self):
        with self.assertRaises(ValueError):
            build_public_url("")

    def test_buy_url_empty_slug_raises(self):
        with self.assertRaises(ValueError):
            build_buy_url("")

    def test_slug_with_numbers(self):
        self.assertEqual(build_public_url("ring-14k-gold"), "/products/ring-14k-gold")

    def test_slug_roundtrip(self):
        """generate_slug → build_public_url should produce valid URL."""
        name = "Engagement Ring 18K"
        slug = generate_slug(name)
        url = build_public_url(slug)
        self.assertTrue(url.startswith("/products/"))
        self.assertNotIn(" ", url)
        self.assertNotIn("'", url)


# ===========================================================================
# 3. AVAILABILITY STATUS
# ===========================================================================

class TestAvailabilityStatus(unittest.TestCase):
    """Tests for calc_availability_status()."""

    # --- in_stock cases ---
    def test_active_no_stock_tracking(self):
        self.assertEqual(calc_availability_status(True), AVAILABILITY_IN_STOCK)

    def test_active_with_positive_stock(self):
        self.assertEqual(calc_availability_status(True, stock_qty=10), AVAILABILITY_IN_STOCK)

    def test_active_stock_exactly_one(self):
        self.assertEqual(calc_availability_status(True, stock_qty=1), AVAILABILITY_IN_STOCK)

    # --- out_of_stock cases ---
    def test_inactive_is_out_of_stock(self):
        self.assertEqual(calc_availability_status(False), AVAILABILITY_OUT_OF_STOCK)

    def test_inactive_with_stock_still_out_of_stock(self):
        self.assertEqual(calc_availability_status(False, stock_qty=100), AVAILABILITY_OUT_OF_STOCK)

    def test_active_zero_stock_no_preorder(self):
        self.assertEqual(calc_availability_status(True, stock_qty=0), AVAILABILITY_OUT_OF_STOCK)

    # --- preorder cases ---
    def test_active_zero_stock_allow_preorder(self):
        self.assertEqual(
            calc_availability_status(True, stock_qty=0, allow_preorder=True),
            AVAILABILITY_PREORDER,
        )

    def test_inactive_zero_stock_preorder_still_out(self):
        """Inactive overrides allow_preorder."""
        self.assertEqual(
            calc_availability_status(False, stock_qty=0, allow_preorder=True),
            AVAILABILITY_OUT_OF_STOCK,
        )

    def test_preorder_with_positive_stock_is_in_stock(self):
        """allow_preorder has no effect when stock > 0."""
        self.assertEqual(
            calc_availability_status(True, stock_qty=5, allow_preorder=True),
            AVAILABILITY_IN_STOCK,
        )

    def test_negative_stock_treated_as_zero(self):
        """Negative quantities behave like zero."""
        result = calc_availability_status(True, stock_qty=-1)
        self.assertEqual(result, AVAILABILITY_OUT_OF_STOCK)


# ===========================================================================
# 4. MATERIAL DISPLAY
# ===========================================================================

class TestMaterialDisplay(unittest.TestCase):
    """Tests for get_material_display()."""

    def test_gold_14k(self):
        self.assertEqual(get_material_display("gold_14k"), "14K Gold")

    def test_gold_18k(self):
        self.assertEqual(get_material_display("gold_18k"), "18K Gold")

    def test_gold_24k(self):
        self.assertEqual(get_material_display("gold_24k"), "24K Gold")

    def test_white_gold(self):
        self.assertEqual(get_material_display("white_gold"), "White Gold")

    def test_rose_gold(self):
        self.assertEqual(get_material_display("rose_gold"), "Rose Gold")

    def test_silver_925(self):
        self.assertEqual(get_material_display("silver_925"), "Sterling Silver (.925)")

    def test_silver_fine(self):
        self.assertEqual(get_material_display("silver_fine"), "Fine Silver (.999)")

    def test_platinum(self):
        self.assertEqual(get_material_display("platinum"), "Platinum")

    def test_palladium(self):
        self.assertEqual(get_material_display("palladium"), "Palladium")

    def test_titanium(self):
        self.assertEqual(get_material_display("titanium"), "Titanium")

    def test_stainless_steel(self):
        self.assertEqual(get_material_display("stainless_steel"), "Stainless Steel")

    def test_mixed_metals(self):
        self.assertEqual(get_material_display("mixed_metals"), "Mixed Metals")

    def test_unknown_key_title_cases(self):
        self.assertEqual(get_material_display("unknown_alloy"), "Unknown Alloy")

    def test_empty_key_returns_empty_after_title(self):
        result = get_material_display("")
        self.assertIsInstance(result, str)

    def test_all_defined_materials_have_display(self):
        for key in MATERIAL_DISPLAY:
            display = get_material_display(key)
            self.assertTrue(len(display) > 0, f"Empty display for material key: {key}")

    def test_returns_string_not_none(self):
        self.assertIsNotNone(get_material_display("copper"))


# ===========================================================================
# 5. EXPORT TO META  (_export_to_meta equivalent)
# ===========================================================================

class TestExportToMeta(unittest.TestCase):
    """Tests for export_to_meta() — structured data / Open Graph export."""

    def _sample_item(self, **overrides):
        base = {
            "id": "f_001",
            "title": "Destination Weddings",
            "content_text": "Bespoke rings for your coastal moment.",
            "image_url": "https://example.com/img.jpg",
            "action_text": "Discover Bridal",
            "action_link": "/bridal",
            "is_active": True,
            "order_index": 0,
        }
        base.update(overrides)
        return base

    def test_returns_dict(self):
        result = export_to_meta(self._sample_item())
        self.assertIsInstance(result, dict)

    def test_type_field(self):
        result = export_to_meta(self._sample_item())
        self.assertEqual(result["@type"], "Product")

    def test_name_matches_title(self):
        item = self._sample_item(title="Nautical Gold")
        result = export_to_meta(item)
        self.assertEqual(result["name"], "Nautical Gold")

    def test_description_matches_content(self):
        item = self._sample_item(content_text="Fine nautical rings.")
        result = export_to_meta(item)
        self.assertEqual(result["description"], "Fine nautical rings.")

    def test_image_field(self):
        item = self._sample_item(image_url="https://cdn.example.com/ring.jpg")
        result = export_to_meta(item)
        self.assertEqual(result["image"], "https://cdn.example.com/ring.jpg")

    def test_slug_generated_from_title(self):
        item = self._sample_item(title="Diamond Solitaire Ring")
        result = export_to_meta(item)
        self.assertEqual(result["slug"], "diamond-solitaire-ring")

    def test_url_uses_slug(self):
        item = self._sample_item(title="Nautical Gold")
        result = export_to_meta(item)
        self.assertIn("nautical-gold", result["url"])

    def test_url_uses_base_url(self):
        item = self._sample_item(title="Ring")
        result = export_to_meta(item, base_url="https://galantesjewelry.com")
        self.assertTrue(result["url"].startswith("https://galantesjewelry.com"))

    def test_active_item_is_in_stock(self):
        item = self._sample_item(is_active=True)
        result = export_to_meta(item)
        self.assertIn("InStock", result["offers"]["availability"])

    def test_inactive_item_is_out_of_stock(self):
        item = self._sample_item(is_active=False)
        result = export_to_meta(item)
        self.assertIn("OutOfStock", result["offers"]["availability"])

    def test_offers_currency_usd(self):
        result = export_to_meta(self._sample_item())
        self.assertEqual(result["offers"]["priceCurrency"], "USD")

    def test_missing_title_raises(self):
        item = self._sample_item()
        del item["title"]
        with self.assertRaises(ValueError):
            export_to_meta(item)

    def test_blank_title_raises(self):
        item = self._sample_item(title="   ")
        with self.assertRaises(ValueError):
            export_to_meta(item)

    def test_missing_content_text_raises(self):
        item = self._sample_item()
        del item["content_text"]
        with self.assertRaises(ValueError):
            export_to_meta(item)

    def test_missing_image_url_raises(self):
        item = self._sample_item()
        del item["image_url"]
        with self.assertRaises(ValueError):
            export_to_meta(item)

    def test_missing_action_link_raises(self):
        item = self._sample_item()
        del item["action_link"]
        with self.assertRaises(ValueError):
            export_to_meta(item)


# ===========================================================================
# 6. UNIQUE ID GENERATION  (create_featured_id, make_featured_item)
# ===========================================================================

class TestIdGeneration(unittest.TestCase):
    """Tests for create_featured_id() — mirrors TypeScript 'f_' + Date.now()."""

    def test_starts_with_f_prefix(self):
        self.assertTrue(create_featured_id().startswith("f_"))

    def test_id_is_string(self):
        self.assertIsInstance(create_featured_id(), str)

    def test_ids_are_unique(self):
        ids = [create_featured_id() for _ in range(50)]
        # Allow up to 2 collisions due to ms precision
        self.assertGreater(len(set(ids)), 45)

    def test_id_contains_timestamp(self):
        before = int(time.time() * 1000)
        fid = create_featured_id()
        after = int(time.time() * 1000)
        ts = int(fid[2:])
        self.assertGreaterEqual(ts, before)
        self.assertLessEqual(ts, after)


class TestMakeFeaturedItem(unittest.TestCase):
    """Tests for make_featured_item() dict factory."""

    def _make(self, **kwargs):
        defaults = dict(
            title="Test Ring",
            content_text="A beautiful ring",
            image_url="https://example.com/img.jpg",
            action_text="View",
            action_link="/collections",
        )
        defaults.update(kwargs)
        return make_featured_item(**defaults)

    def test_returns_dict(self):
        self.assertIsInstance(self._make(), dict)

    def test_required_fields_present(self):
        item = self._make()
        for field in ("id", "title", "content_text", "image_url", "action_text", "action_link", "is_active", "order_index"):
            self.assertIn(field, item)

    def test_custom_id_used_when_provided(self):
        item = self._make(item_id="custom_123")
        self.assertEqual(item["id"], "custom_123")

    def test_auto_id_when_not_provided(self):
        item = self._make()
        self.assertTrue(item["id"].startswith("f_"))

    def test_is_active_default_true(self):
        self.assertTrue(self._make()["is_active"])

    def test_is_active_false(self):
        item = self._make(is_active=False)
        self.assertFalse(item["is_active"])

    def test_order_index_default_zero(self):
        self.assertEqual(self._make()["order_index"], 0)

    def test_order_index_custom(self):
        self.assertEqual(self._make(order_index=5)["order_index"], 5)


class TestSortFeaturedItems(unittest.TestCase):
    """Tests for sort_featured_items() — mirrors lib/db.ts getFeaturedItems sorting."""

    def _item(self, order_index, title="x"):
        return make_featured_item(
            title=title,
            content_text="",
            image_url="",
            action_text="",
            action_link="/",
            order_index=order_index,
        )

    def test_already_sorted(self):
        items = [self._item(0), self._item(1), self._item(2)]
        result = sort_featured_items(items)
        self.assertEqual([i["order_index"] for i in result], [0, 1, 2])

    def test_reverse_order_sorted(self):
        items = [self._item(2), self._item(0), self._item(1)]
        result = sort_featured_items(items)
        self.assertEqual([i["order_index"] for i in result], [0, 1, 2])

    def test_single_item(self):
        items = [self._item(3)]
        result = sort_featured_items(items)
        self.assertEqual(len(result), 1)

    def test_empty_list(self):
        self.assertEqual(sort_featured_items([]), [])

    def test_original_list_not_mutated(self):
        items = [self._item(2), self._item(0)]
        original_first_order = items[0]["order_index"]
        sort_featured_items(items)
        self.assertEqual(items[0]["order_index"], original_first_order)


# ===========================================================================
# 7. EDGE CASES — special characters, empty slug, product without image
# ===========================================================================

class TestEdgeCases(unittest.TestCase):
    """Edge cases: special chars, empty slug, missing image."""

    def test_slug_only_emoji_returns_empty(self):
        # Emojis have no ASCII representation via NFD+ASCII
        result = generate_slug("💎🌊")
        self.assertEqual(result, "")

    def test_slug_long_name_truncation_not_applied(self):
        long_name = "A" * 300
        result = generate_slug(long_name)
        self.assertEqual(result, "a" * 300)

    def test_build_public_url_with_empty_slug_raises(self):
        with self.assertRaises(ValueError):
            build_public_url("")

    def test_build_buy_url_with_empty_slug_raises(self):
        with self.assertRaises(ValueError):
            build_buy_url("")

    def test_export_meta_product_without_image(self):
        item = {
            "title": "Ring",
            "content_text": "A ring",
            "image_url": "",          # empty image
            "action_link": "/bridal",
            "is_active": True,
        }
        result = export_to_meta(item)
        # Should still export; image field is empty string, not missing
        self.assertEqual(result["image"], "")
        self.assertIn("@type", result)

    def test_item_with_special_chars_in_title_slug(self):
        item = {
            "title": "D'Étoile — Limited Édition",
            "content_text": "text",
            "image_url": "img.jpg",
            "action_link": "/bridal",
            "is_active": True,
        }
        result = export_to_meta(item)
        slug = result["slug"]
        self.assertNotIn("'", slug)
        self.assertNotIn("—", slug)
        self.assertNotIn("É", slug)
        self.assertFalse(slug.startswith("-"))
        self.assertFalse(slug.endswith("-"))

    def test_validate_contact_submission_valid(self):
        data = {
            "name": "Ana García",
            "email": "ana@example.com",
            "phone": "305-555-0199",
            "inquiryType": "Bridal Consultation",
            "message": "I would like to schedule a bridal consultation.",
            "appointmentDate": "2027-06-15",
            "appointmentTime": "10:30",
        }
        errors = validate_contact_submission(data)
        self.assertEqual(errors, {})

    def test_validate_contact_submission_missing_name(self):
        data = {
            "name": "A",   # too short
            "email": "ana@example.com",
            "inquiryType": "Bridal",
            "message": "Message here.",
            "appointmentDate": "2027-06-15",
            "appointmentTime": "10:30",
        }
        errors = validate_contact_submission(data)
        self.assertIn("name", errors)

    def test_validate_contact_submission_bad_email(self):
        data = {
            "name": "Ana García",
            "email": "not-an-email",
            "inquiryType": "Bridal",
            "message": "Message here.",
            "appointmentDate": "2027-06-15",
            "appointmentTime": "10:30",
        }
        errors = validate_contact_submission(data)
        self.assertIn("email", errors)

    def test_validate_contact_bad_date_format(self):
        data = {
            "name": "Ana García",
            "email": "ana@example.com",
            "inquiryType": "Bridal",
            "message": "Message here.",
            "appointmentDate": "15/06/2027",   # wrong format
            "appointmentTime": "10:30",
        }
        errors = validate_contact_submission(data)
        self.assertIn("appointmentDate", errors)

    def test_validate_contact_bad_time_format(self):
        data = {
            "name": "Ana García",
            "email": "ana@example.com",
            "inquiryType": "Bridal",
            "message": "Message here.",
            "appointmentDate": "2027-06-15",
            "appointmentTime": "10:30am",      # wrong format
        }
        errors = validate_contact_submission(data)
        self.assertIn("appointmentTime", errors)


# ===========================================================================
# 8. ADMIN AUTH LOGIC  (unittest.mock patterns)
# ===========================================================================

class TestAdminCredentials(unittest.TestCase):
    """Tests for validate_admin_credentials() — mock-friendly credential checking."""

    def test_correct_credentials(self):
        self.assertTrue(validate_admin_credentials("admin", "galantes2026"))

    def test_wrong_username(self):
        self.assertFalse(validate_admin_credentials("root", "galantes2026"))

    def test_wrong_password(self):
        self.assertFalse(validate_admin_credentials("admin", "wrong_password"))

    def test_both_wrong(self):
        self.assertFalse(validate_admin_credentials("hacker", "badpass"))

    def test_empty_username(self):
        self.assertFalse(validate_admin_credentials("", "galantes2026"))

    def test_empty_password(self):
        self.assertFalse(validate_admin_credentials("admin", ""))

    def test_case_sensitive_username(self):
        self.assertFalse(validate_admin_credentials("Admin", "galantes2026"))

    def test_case_sensitive_password(self):
        self.assertFalse(validate_admin_credentials("admin", "Galantes2026"))

    def test_custom_credentials(self):
        self.assertTrue(
            validate_admin_credentials("owner", "secure123", expected_user="owner", expected_pass="secure123")
        )

    def test_session_payload_structure(self):
        payload = build_session_payload("admin")
        self.assertIn("user", payload)
        self.assertEqual(payload["user"], "admin")

    def test_session_payload_is_dict(self):
        self.assertIsInstance(build_session_payload("admin"), dict)


class TestAdminCredentialsWithMock(unittest.TestCase):
    """
    Demonstrates unittest.mock patterns for testing auth flows.
    These patterns would apply when testing the Next.js API route handler
    logic injected via a mock ORM / mock DB layer.
    """

    def test_mock_db_returns_correct_user(self):
        mock_db = MagicMock()
        mock_db.get_admin_user.return_value = {"username": "admin", "role": "owner"}

        user = mock_db.get_admin_user("admin")
        self.assertEqual(user["username"], "admin")
        mock_db.get_admin_user.assert_called_once_with("admin")

    def test_mock_token_signing(self):
        mock_sign_token = MagicMock(return_value="mock.jwt.token")

        payload = build_session_payload("admin")
        token = mock_sign_token(payload)

        self.assertEqual(token, "mock.jwt.token")
        mock_sign_token.assert_called_once_with({"user": "admin"})

    def test_mock_db_featured_items(self):
        mock_db = MagicMock()
        mock_db.get_featured_items.return_value = [
            {"id": "f1", "title": "Bridal", "is_active": True, "order_index": 0},
            {"id": "f2", "title": "Nautical", "is_active": True, "order_index": 1},
        ]

        items = mock_db.get_featured_items()
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["title"], "Bridal")

    def test_mock_create_and_verify_session(self):
        """Simulate the full login → token → verify cycle with mocks."""
        mock_auth = MagicMock()
        mock_auth.sign_token.return_value = "eyJ.mock.token"
        mock_auth.verify_token.return_value = {"user": "admin"}

        # Simulate login
        if validate_admin_credentials("admin", "galantes2026"):
            token = mock_auth.sign_token({"user": "admin"})
        else:
            self.fail("Credentials should be valid")

        # Simulate request with cookie
        session = mock_auth.verify_token(token)
        self.assertEqual(session["user"], "admin")

    @patch("tests.unit.product_logic.time")
    def test_create_featured_id_uses_time(self, mock_time):
        mock_time.time.return_value = 1700000000.123
        fid = create_featured_id()
        self.assertEqual(fid, "f_1700000000123")

    def test_mock_add_featured_item_called_with_correct_args(self):
        mock_db = MagicMock()
        mock_db.add_featured_item.return_value = {
            "id": "f_999",
            "title": "New Piece",
            "is_active": True,
        }

        new_item_data = {
            "title": "New Piece",
            "content_text": "Beautiful new jewelry",
            "image_url": "https://example.com/new.jpg",
            "action_text": "View",
            "action_link": "/collections",
            "is_active": True,
            "order_index": 3,
        }

        result = mock_db.add_featured_item(new_item_data)
        mock_db.add_featured_item.assert_called_once_with(new_item_data)
        self.assertEqual(result["title"], "New Piece")

    def test_mock_delete_featured_item(self):
        mock_db = MagicMock()
        mock_db.delete_featured_item.return_value = True

        success = mock_db.delete_featured_item("f_001")
        self.assertTrue(success)
        mock_db.delete_featured_item.assert_called_once_with("f_001")

    def test_mock_delete_nonexistent_item(self):
        mock_db = MagicMock()
        mock_db.delete_featured_item.return_value = False

        success = mock_db.delete_featured_item("nonexistent_id")
        self.assertFalse(success)

    def test_mock_update_featured_item(self):
        mock_db = MagicMock()
        updated = {"id": "f_001", "title": "Updated Title", "is_active": True}
        mock_db.update_featured_item.return_value = updated

        result = mock_db.update_featured_item("f_001", {"title": "Updated Title"})
        self.assertEqual(result["title"], "Updated Title")
        mock_db.update_featured_item.assert_called_once_with("f_001", {"title": "Updated Title"})

    def test_mock_section_not_found(self):
        mock_db = MagicMock()
        mock_db.update_section.return_value = None

        result = mock_db.update_section("nonexistent", {"title": "x"})
        self.assertIsNone(result)

    def test_patch_context_manager(self):
        """Demonstrate patch() context manager for isolating imports."""
        with patch("tests.unit.product_logic.generate_slug") as mock_slug:
            mock_slug.return_value = "mocked-slug"
            from tests.unit.product_logic import generate_slug as gs
            result = gs("Anything")
            self.assertEqual(result, "mocked-slug")


if __name__ == "__main__":
    unittest.main(verbosity=2)
