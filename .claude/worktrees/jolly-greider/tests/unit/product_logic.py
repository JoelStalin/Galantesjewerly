"""
product_logic.py — Pure Python business-logic module for Galante's Jewelry.

This module mirrors the TypeScript business logic found in:
  - lib/db.ts          (FeaturedItem / CMS data model)
  - lib/auth.ts        (session / credential logic)
  - lib/appointments.ts (ContactSubmission validation, AppointmentRecord)

It contains NO I/O and NO external dependencies so it can be exercised
entirely with unittest + unittest.mock (no server, no Odoo, no Node.js).

Think of FeaturedItem as the "product" entity in this jewelry store:
  id, title, content_text, image_url, action_text, action_link,
  is_active, order_index
"""

from __future__ import annotations

import os
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# SLUG UTILITIES
# ---------------------------------------------------------------------------

def generate_slug(name: str) -> str:
    """
    Convert a product/item name into a URL-safe slug.

    Rules (mirrors typical Next.js / Odoo slug conventions):
    - Normalise unicode (NFD → strip combining marks → ASCII)
    - Lower-case
    - Replace any non-alphanumeric run with a single hyphen
    - Strip leading/trailing hyphens
    - Collapse consecutive hyphens

    >>> generate_slug("Diamond Engagement Ring")
    'diamond-engagement-ring'
    >>> generate_slug("Côte d'Ivoire Bracelet")
    'cote-divoire-bracelet'
    >>> generate_slug("  Gold & Silver — Set  ")
    'gold-silver-set'
    """
    if not name or not name.strip():
        return ""

    # Unicode normalise: NFD lets us strip combining diacritical marks
    nfkd = unicodedata.normalize("NFD", name)
    ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")

    lowered = ascii_str.lower()
    slugified = re.sub(r"[^a-z0-9]+", "-", lowered)
    slugified = slugified.strip("-")
    slugified = re.sub(r"-{2,}", "-", slugified)
    return slugified


def ensure_unique_slug(
    base_slug: str,
    existing_slugs: List[str],
) -> str:
    """
    Append a numeric suffix to *base_slug* until it is not in *existing_slugs*.

    >>> ensure_unique_slug("ring", [])
    'ring'
    >>> ensure_unique_slug("ring", ["ring"])
    'ring-1'
    >>> ensure_unique_slug("ring", ["ring", "ring-1"])
    'ring-2'
    """
    if base_slug not in existing_slugs:
        return base_slug
    counter = 1
    while f"{base_slug}-{counter}" in existing_slugs:
        counter += 1
    return f"{base_slug}-{counter}"


# ---------------------------------------------------------------------------
# URL BUILDERS
# ---------------------------------------------------------------------------

def build_public_url(slug: str, base_url: str = "") -> str:
    """
    Build the customer-facing product page URL.

    >>> build_public_url("diamond-ring")
    '/products/diamond-ring'
    >>> build_public_url("diamond-ring", "https://galantesjewelry.com")
    'https://galantesjewelry.com/products/diamond-ring'
    """
    if not slug:
        raise ValueError("slug must not be empty")
    path = f"/products/{slug}"
    return f"{base_url}{path}" if base_url else path


def build_buy_url(slug: str, base_url: str = "") -> str:
    """
    Build the add-to-cart / purchase URL.

    >>> build_buy_url("diamond-ring")
    '/shop/diamond-ring'
    """
    if not slug:
        raise ValueError("slug must not be empty")
    path = f"/shop/{slug}"
    return f"{base_url}{path}" if base_url else path


# ---------------------------------------------------------------------------
# AVAILABILITY STATUS
# ---------------------------------------------------------------------------

AVAILABILITY_IN_STOCK = "in_stock"
AVAILABILITY_OUT_OF_STOCK = "out_of_stock"
AVAILABILITY_PREORDER = "preorder"

# Maps numeric stock quantities to statuses
_AVAILABILITY_THRESHOLDS = {
    AVAILABILITY_OUT_OF_STOCK: 0,
    AVAILABILITY_PREORDER: None,  # explicit flag
    AVAILABILITY_IN_STOCK: 1,
}


def calc_availability_status(
    is_active: bool,
    stock_qty: Optional[int] = None,
    allow_preorder: bool = False,
) -> str:
    """
    Calculate the availability status string for a product.

    Logic:
    - If not active → out_of_stock
    - If active and stock_qty is None (no inventory tracking) → in_stock
    - If active and stock_qty == 0 and allow_preorder → preorder
    - If active and stock_qty == 0 → out_of_stock
    - If active and stock_qty > 0 → in_stock

    >>> calc_availability_status(True)
    'in_stock'
    >>> calc_availability_status(False)
    'out_of_stock'
    >>> calc_availability_status(True, stock_qty=0)
    'out_of_stock'
    >>> calc_availability_status(True, stock_qty=0, allow_preorder=True)
    'preorder'
    >>> calc_availability_status(True, stock_qty=5)
    'in_stock'
    """
    if not is_active:
        return AVAILABILITY_OUT_OF_STOCK
    if stock_qty is None:
        return AVAILABILITY_IN_STOCK
    if stock_qty <= 0:
        return AVAILABILITY_PREORDER if allow_preorder else AVAILABILITY_OUT_OF_STOCK
    return AVAILABILITY_IN_STOCK


# ---------------------------------------------------------------------------
# MATERIAL DISPLAY
# ---------------------------------------------------------------------------

MATERIAL_DISPLAY: Dict[str, str] = {
    "gold_14k": "14K Gold",
    "gold_18k": "18K Gold",
    "gold_24k": "24K Gold",
    "white_gold": "White Gold",
    "rose_gold": "Rose Gold",
    "silver_925": "Sterling Silver (.925)",
    "silver_fine": "Fine Silver (.999)",
    "platinum": "Platinum",
    "palladium": "Palladium",
    "titanium": "Titanium",
    "stainless_steel": "Stainless Steel",
    "brass": "Brass",
    "copper": "Copper",
    "mixed_metals": "Mixed Metals",
    "other": "Other",
}


def get_material_display(material_key: str) -> str:
    """
    Return a human-readable material label from a machine key.

    Unknown keys are returned title-cased as a fallback.

    >>> get_material_display("gold_18k")
    '18K Gold'
    >>> get_material_display("platinum")
    'Platinum'
    >>> get_material_display("unknown_alloy")
    'Unknown Alloy'
    """
    if material_key in MATERIAL_DISPLAY:
        return MATERIAL_DISPLAY[material_key]
    return material_key.replace("_", " ").title()


# ---------------------------------------------------------------------------
# FEATURED ITEM (≈ ProductTemplate) HELPERS
# ---------------------------------------------------------------------------

def make_featured_item(
    title: str,
    content_text: str,
    image_url: str,
    action_text: str,
    action_link: str,
    order_index: int = 0,
    is_active: bool = True,
    item_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build a FeaturedItem dict in the shape expected by lib/db.ts.

    IDs are generated via `create_featured_id()` when not supplied.
    """
    return {
        "id": item_id if item_id else create_featured_id(),
        "title": title,
        "content_text": content_text,
        "image_url": image_url,
        "action_text": action_text,
        "action_link": action_link,
        "is_active": is_active,
        "order_index": order_index,
    }


def create_featured_id() -> str:
    """
    Generate a unique FeaturedItem ID.  Mirrors the TypeScript logic:
        'f_' + Date.now().toString()

    >>> id1 = create_featured_id()
    >>> id1.startswith('f_')
    True
    >>> len(id1) > 4
    True
    """
    return f"f_{int(time.time() * 1000)}"


def sort_featured_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return items sorted ascending by order_index (mirrors lib/db.ts getFeaturedItems)."""
    return sorted(items, key=lambda x: x.get("order_index", 0))


# ---------------------------------------------------------------------------
# META / STRUCTURED DATA EXPORT
# ---------------------------------------------------------------------------

def export_to_meta(item: Dict[str, Any], base_url: str = "") -> Dict[str, Any]:
    """
    Produce an Open Graph / JSON-LD–style dict for a FeaturedItem.

    Required keys: title, content_text, image_url, action_link
    Optional keys: id, is_active, order_index

    Raises ValueError when required keys are missing or title is blank.
    """
    required = ["title", "content_text", "image_url", "action_link"]
    for key in required:
        if key not in item:
            raise ValueError(f"export_to_meta: missing required field '{key}'")

    if not item["title"].strip():
        raise ValueError("export_to_meta: title must not be blank")

    slug = generate_slug(item["title"])

    return {
        "@type": "Product",
        "name": item["title"],
        "description": item["content_text"],
        "image": item["image_url"],
        "url": build_public_url(slug, base_url) if slug else item["action_link"],
        "offers": {
            "@type": "Offer",
            "availability": (
                "https://schema.org/InStock"
                if item.get("is_active", True)
                else "https://schema.org/OutOfStock"
            ),
            "priceCurrency": "USD",
        },
        "slug": slug,
    }


# ---------------------------------------------------------------------------
# AUTH / CREDENTIAL LOGIC (mirrors lib/auth.ts concepts)
# ---------------------------------------------------------------------------

def validate_admin_credentials(
    username: str,
    password: str,
    expected_user: str = "admin",
    expected_pass: str = "galantes2026",
) -> bool:
    """
    Return True when username and password match the configured admin credentials.

    Uses constant-time comparison to mitigate timing attacks.
    """
    # Both strings padded to same length before XOR comparison
    def safe_eq(a: str, b: str) -> bool:
        a_bytes = a.encode()
        b_bytes = b.encode()
        if len(a_bytes) != len(b_bytes):
            return False
        diff = 0
        for x, y in zip(a_bytes, b_bytes):
            diff |= x ^ y
        return diff == 0

    return safe_eq(username, expected_user) and safe_eq(password, expected_pass)


def build_session_payload(username: str) -> Dict[str, Any]:
    """Build the JWT payload dict for a valid admin login."""
    return {"user": username}


# ---------------------------------------------------------------------------
# CONTACT FORM VALIDATION  (mirrors lib/appointments.ts Zod schema)
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


def validate_contact_submission(data: Dict[str, Any]) -> Dict[str, str]:
    """
    Validate a contact/appointment form submission.

    Returns a dict of field → error message for any validation failures.
    Empty dict means the submission is valid.

    Mirrors the Zod schema in lib/appointments.ts:
      name: 2-120 chars
      email: valid email, max 180
      phone: optional, max 40
      inquiryType: 2-80 chars
      message: 5-2000 chars
      appointmentDate: YYYY-MM-DD
      appointmentTime: HH:MM
    """
    errors: Dict[str, str] = {}

    name = str(data.get("name", "")).strip()
    if len(name) < 2 or len(name) > 120:
        errors["name"] = "Name must be between 2 and 120 characters."

    email = str(data.get("email", "")).strip()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) or len(email) > 180:
        errors["email"] = "A valid email address is required (max 180 chars)."

    phone = str(data.get("phone", "")).strip()
    if len(phone) > 40:
        errors["phone"] = "Phone must be at most 40 characters."

    inquiry = str(data.get("inquiryType", "")).strip()
    if len(inquiry) < 2 or len(inquiry) > 80:
        errors["inquiryType"] = "Inquiry type must be between 2 and 80 characters."

    message = str(data.get("message", "")).strip()
    if len(message) < 5 or len(message) > 2000:
        errors["message"] = "Message must be between 5 and 2000 characters."

    appt_date = str(data.get("appointmentDate", "")).strip()
    if not _DATE_RE.match(appt_date):
        errors["appointmentDate"] = "Date must be in YYYY-MM-DD format."

    appt_time = str(data.get("appointmentTime", "")).strip()
    if not _TIME_RE.match(appt_time):
        errors["appointmentTime"] = "Time must be in HH:MM format."

    return errors
