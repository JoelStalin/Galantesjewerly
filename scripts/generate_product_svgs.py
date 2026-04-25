from __future__ import annotations

import math
import re
import textwrap
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
XML_PATH = ROOT / "odoo" / "addons" / "galantes_jewelry" / "data" / "product_data.xml"
OUTPUT_DIR = ROOT / "public" / "assets" / "products"

CATEGORY_META = {
    "rings": {
        "label": "Rings",
        "bg_start": "#F8F3EA",
        "bg_end": "#E6D4B2",
        "accent": "#9D7A35",
        "stroke": "#3A2D18",
        "badge": "#C6A15B",
        "icon": "ring",
    },
    "bridal": {
        "label": "Bridal",
        "bg_start": "#F7F5FB",
        "bg_end": "#D9D4E8",
        "accent": "#8FA5C6",
        "stroke": "#293247",
        "badge": "#A7BCD8",
        "icon": "solitaire",
    },
    "necklaces": {
        "label": "Necklaces",
        "bg_start": "#EEF7F6",
        "bg_end": "#C9E6E0",
        "accent": "#3E8D8E",
        "stroke": "#163B3B",
        "badge": "#6AB5AF",
        "icon": "necklace",
    },
    "bracelets": {
        "label": "Bracelets",
        "bg_start": "#F6F0ED",
        "bg_end": "#DCC4B8",
        "accent": "#A9664B",
        "stroke": "#4E2C21",
        "badge": "#C48A6F",
        "icon": "bracelet",
    },
    "earrings": {
        "label": "Earrings",
        "bg_start": "#F4F7EF",
        "bg_end": "#DCE8C8",
        "accent": "#708C44",
        "stroke": "#273315",
        "badge": "#9EB86B",
        "icon": "earrings",
    },
    "nautical": {
        "label": "Nautical",
        "bg_start": "#EFF4FA",
        "bg_end": "#C9DBEE",
        "accent": "#3B6EA5",
        "stroke": "#17304D",
        "badge": "#5E8EC1",
        "icon": "compass",
    },
    "gifts": {
        "label": "Gifts",
        "bg_start": "#F9F2EC",
        "bg_end": "#E7D0BB",
        "accent": "#AF6A3B",
        "stroke": "#51290D",
        "badge": "#D28D5B",
        "icon": "gift",
    },
    "ready_to_ship": {
        "label": "Ready To Ship",
        "bg_start": "#F3F7FA",
        "bg_end": "#D3DEE8",
        "accent": "#5C7A92",
        "stroke": "#223848",
        "badge": "#89A5BC",
        "icon": "spark",
    },
}

MATERIAL_META = {
    "gold": ("#D1A24A", "#F2D38A"),
    "gold_14k": ("#D7A956", "#F4DDA6"),
    "gold_18k": ("#C9982D", "#F0CA68"),
    "gold_24k": ("#DAAE3B", "#F8DC7C"),
    "rose_gold": ("#C98678", "#F4C5BC"),
    "rose_gold_14k": ("#C98678", "#F3C2B7"),
    "white_gold": ("#C4CBD8", "#EDF2F7"),
    "white_gold_14k": ("#C4CBD8", "#EDF2F7"),
    "silver": ("#B4BCC8", "#F1F4F7"),
    "silver_925": ("#B4BCC8", "#F1F4F7"),
    "platinum": ("#9BAABD", "#E6EDF6"),
    "mixed": ("#A98450", "#D5CCC0"),
}

LEGACY_ALIASES = {
    "the-islamorada-solitaire": "islamorada-solitaire",
    "anchor-soul-bracelet": "anchor-of-the-soul-bracelet",
    "navigators-chrono-link": "navigators-chrono-link-bracelet",
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def svg_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def category_key(ref_value: str | None) -> str:
    if not ref_value:
        return "gifts"
    ref_value = ref_value.strip()
    if ref_value.endswith("product_category_ready_to_ship"):
        return "ready_to_ship"
    return ref_value.rsplit("_", 1)[-1]


def keyword_icon(slug: str, default_icon: str) -> str:
    if "ring" in slug or "band" in slug:
        return "ring"
    if "bracelet" in slug:
        return "bracelet"
    if "necklace" in slug or "pendant" in slug or "chain" in slug or "charm" in slug:
        return "necklace"
    if "earring" in slug or "stud" in slug or "hoop" in slug:
        return "earrings"
    if "cufflink" in slug:
        return "cufflinks"
    if "tie-bar" in slug or "tie" in slug:
        return "gift"
    if "gift-set" in slug:
        return "gift"
    if "anchor" in slug or "compass" in slug or "lighthouse" in slug or "trident" in slug:
        return "compass"
    return default_icon


def wrap_title(name: str, width: int = 18, max_lines: int = 3) -> list[str]:
    lines = textwrap.wrap(name, width=width)
    return lines[:max_lines]


def parse_products() -> list[dict[str, str]]:
    tree = ET.parse(XML_PATH)
    root = tree.getroot()
    products: list[dict[str, str]] = []
    for record in root.findall(".//record[@model='product.template']"):
        fields = {field.get("name"): (field.text or "").strip() for field in record.findall("field")}
        ref_map = {
            field.get("name"): field.get("ref", "").strip()
            for field in record.findall("field")
            if field.get("ref")
        }
        products.append(
            {
                "name": fields.get("name", ""),
                "slug": fields.get("slug") or slugify(fields.get("name", "")),
                "sku": fields.get("default_code", ""),
                "material": fields.get("material", ""),
                "category": category_key(ref_map.get("categ_id")),
                "tagline": fields.get("tagline", ""),
            }
        )
    return products


def build_wave_lines(stroke: str, accent: str) -> str:
    return f"""
    <path d="M 120 1160 C 320 1080, 520 1240, 720 1160 S 1120 1080, 1320 1160 S 1560 1240, 1680 1180"
      fill="none" stroke="{accent}" stroke-width="20" stroke-linecap="round" opacity="0.28"/>
    <path d="M 80 1240 C 300 1170, 540 1310, 760 1240 S 1180 1170, 1400 1240 S 1600 1300, 1720 1260"
      fill="none" stroke="{stroke}" stroke-width="10" stroke-linecap="round" opacity="0.14"/>
    """


def build_icon(icon: str, fill_primary: str, fill_secondary: str, stroke: str) -> str:
    if icon == "ring":
        return f"""
        <circle cx="800" cy="700" r="182" fill="none" stroke="{stroke}" stroke-width="34"/>
        <circle cx="800" cy="700" r="138" fill="none" stroke="{fill_secondary}" stroke-width="18" opacity="0.92"/>
        <path d="M 705 476 L 800 365 L 895 476 L 800 555 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18" stroke-linejoin="round"/>
        <circle cx="800" cy="440" r="28" fill="{fill_secondary}" opacity="0.86"/>
        """
    if icon == "solitaire":
        return f"""
        <ellipse cx="800" cy="760" rx="206" ry="142" fill="none" stroke="{stroke}" stroke-width="30"/>
        <path d="M 640 595 L 800 428 L 960 595" fill="none" stroke="{stroke}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 708 540 L 800 410 L 892 540 L 800 642 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18" stroke-linejoin="round"/>
        <circle cx="800" cy="525" r="34" fill="{fill_secondary}" opacity="0.92"/>
        """
    if icon == "necklace":
        return f"""
        <path d="M 520 490 C 620 320, 980 320, 1080 490" fill="none" stroke="{stroke}" stroke-width="22" stroke-linecap="round"/>
        <path d="M 610 500 C 675 665, 925 665, 990 500" fill="none" stroke="{fill_secondary}" stroke-width="16" stroke-linecap="round"/>
        <path d="M 800 600 C 740 650, 740 760, 800 815 C 860 760, 860 650, 800 600 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18"/>
        <circle cx="800" cy="676" r="22" fill="{fill_secondary}" opacity="0.9"/>
        """
    if icon == "bracelet":
        return f"""
        <ellipse cx="800" cy="715" rx="234" ry="118" fill="none" stroke="{stroke}" stroke-width="28"/>
        <ellipse cx="800" cy="715" rx="184" ry="82" fill="none" stroke="{fill_secondary}" stroke-width="14" opacity="0.9"/>
        <path d="M 602 712 L 708 612 L 798 703 L 892 606 L 998 712" fill="none" stroke="{fill_primary}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="798" cy="703" r="16" fill="{fill_secondary}"/>
        """
    if icon == "earrings":
        return f"""
        <path d="M 664 485 C 612 485, 574 525, 574 580 C 574 646, 628 680, 664 728 C 700 680, 754 646, 754 580 C 754 525, 716 485, 664 485 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18"/>
        <path d="M 936 485 C 884 485, 846 525, 846 580 C 846 646, 900 680, 936 728 C 972 680, 1026 646, 1026 580 C 1026 525, 988 485, 936 485 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18"/>
        <circle cx="664" cy="422" r="28" fill="{fill_secondary}" stroke="{stroke}" stroke-width="14"/>
        <circle cx="936" cy="422" r="28" fill="{fill_secondary}" stroke="{stroke}" stroke-width="14"/>
        """
    if icon == "cufflinks":
        return f"""
        <rect x="560" y="525" width="196" height="196" rx="42" fill="{fill_primary}" stroke="{stroke}" stroke-width="22"/>
        <rect x="844" y="525" width="196" height="196" rx="42" fill="{fill_secondary}" stroke="{stroke}" stroke-width="22"/>
        <path d="M 756 624 H 844" stroke="{stroke}" stroke-width="18" stroke-linecap="round"/>
        <circle cx="800" cy="624" r="26" fill="{fill_primary}" stroke="{stroke}" stroke-width="14"/>
        """
    if icon == "gift":
        return f"""
        <rect x="582" y="542" width="436" height="320" rx="44" fill="{fill_secondary}" stroke="{stroke}" stroke-width="24"/>
        <path d="M 800 542 V 862" stroke="{stroke}" stroke-width="20"/>
        <path d="M 582 675 H 1018" stroke="{stroke}" stroke-width="20"/>
        <path d="M 800 496 C 760 432, 680 440, 664 490 C 650 540, 712 582, 800 610" fill="{fill_primary}" stroke="{stroke}" stroke-width="18" stroke-linecap="round"/>
        <path d="M 800 496 C 840 432, 920 440, 936 490 C 950 540, 888 582, 800 610" fill="{fill_primary}" stroke="{stroke}" stroke-width="18" stroke-linecap="round"/>
        """
    if icon == "spark":
        return f"""
        <path d="M 800 430 L 858 614 L 1046 670 L 858 726 L 800 910 L 742 726 L 554 670 L 742 614 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18" stroke-linejoin="round"/>
        <circle cx="1100" cy="474" r="24" fill="{fill_secondary}"/>
        <circle cx="542" cy="520" r="18" fill="{fill_secondary}"/>
        <circle cx="1060" cy="862" r="20" fill="{fill_secondary}"/>
        """
    # compass
    return f"""
    <circle cx="800" cy="690" r="214" fill="none" stroke="{stroke}" stroke-width="24"/>
    <circle cx="800" cy="690" r="168" fill="none" stroke="{fill_secondary}" stroke-width="14" opacity="0.9"/>
    <path d="M 800 430 L 858 632 L 1060 690 L 858 748 L 800 950 L 742 748 L 540 690 L 742 632 Z" fill="{fill_primary}" stroke="{stroke}" stroke-width="18" stroke-linejoin="round"/>
    <circle cx="800" cy="690" r="30" fill="{fill_secondary}"/>
    """


def render_svg(product: dict[str, str]) -> str:
    category = CATEGORY_META[product["category"]]
    fill_primary, fill_secondary = MATERIAL_META.get(
        product["material"], (category["accent"], category["badge"])
    )
    icon = keyword_icon(product["slug"], category["icon"])
    title_lines = wrap_title(product["name"])
    title_svg = []
    start_y = 1068
    for index, line in enumerate(title_lines):
        title_svg.append(
            f'<text x="800" y="{start_y + (index * 62)}" text-anchor="middle" fill="{category["stroke"]}" '
            f'font-family="Georgia, Times New Roman, serif" font-size="52" font-weight="700">{svg_escape(line)}</text>'
        )
    subtitle = product["tagline"][:72]
    subtitle_svg = ""
    if subtitle:
        subtitle_svg = (
            f'<text x="800" y="1272" text-anchor="middle" fill="{category["stroke"]}" opacity="0.72" '
            f'font-family="Trebuchet MS, Verdana, sans-serif" font-size="26">{svg_escape(subtitle)}</text>'
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600" role="img" aria-labelledby="title desc">
  <title id="title">{svg_escape(product["name"])}</title>
  <desc id="desc">{svg_escape(product["name"])} vector product artwork for Galante's Jewelry.</desc>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{category["bg_start"]}"/>
      <stop offset="100%" stop-color="{category["bg_end"]}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="{fill_secondary}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="{fill_secondary}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1600" fill="url(#bg)"/>
  <circle cx="800" cy="580" r="380" fill="url(#halo)"/>
  <path d="M 0 280 C 210 180, 370 350, 560 258 S 930 188, 1130 272 S 1440 362, 1600 276 L 1600 0 L 0 0 Z"
    fill="{fill_secondary}" opacity="0.18"/>
  {build_wave_lines(category["stroke"], category["accent"])}
  <rect x="570" y="170" width="460" height="54" rx="27" fill="{category["badge"]}" opacity="0.94"/>
  <text x="800" y="206" text-anchor="middle" fill="{category["stroke"]}" font-family="Trebuchet MS, Verdana, sans-serif" font-size="26" font-weight="700" letter-spacing="4">{svg_escape(category["label"].upper())}</text>
  <text x="180" y="1440" fill="{category["stroke"]}" opacity="0.65" font-family="Trebuchet MS, Verdana, sans-serif" font-size="24" font-weight="700">{svg_escape(product["sku"])}</text>
  <text x="1420" y="1440" text-anchor="end" fill="{category["stroke"]}" opacity="0.65" font-family="Trebuchet MS, Verdana, sans-serif" font-size="24" font-weight="700">{svg_escape(product["material"].replace("_", " ").upper() or "JEWELRY")}</text>
  <text x="800" y="1484" text-anchor="middle" fill="{category["stroke"]}" opacity="0.42" font-family="Trebuchet MS, Verdana, sans-serif" font-size="24" letter-spacing="6">GALANTE'S JEWELRY</text>
  {build_icon(icon, fill_primary, fill_secondary, category["stroke"])}
  {''.join(title_svg)}
  {subtitle_svg}
</svg>
"""


def write_svg(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def generate_svgs(products: Iterable[dict[str, str]]) -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = {}
    count = 0
    for product in products:
        content = render_svg(product)
        write_svg(OUTPUT_DIR / f"{product['slug']}.svg", content)
        generated[product["slug"]] = content
        count += 1

    for alias, target in LEGACY_ALIASES.items():
        content = generated.get(target)
        if content:
            write_svg(OUTPUT_DIR / f"{alias}.svg", content)

    return count


if __name__ == "__main__":
    products = parse_products()
    total = generate_svgs(products)
    print(f"generated {total} SVG product assets in {OUTPUT_DIR}")
