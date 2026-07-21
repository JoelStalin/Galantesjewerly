#!/usr/bin/env python3
"""Suggest reviewable product metadata from images and cluster evidence.

This does not approve products, prices, stock, or publication. It only writes
category/material/name suggestions for the human review queue.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = ROOT / "data" / "inventory-agent" / "manifests"


def load_json(path: Path, fallback: Any = None) -> Any:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


CATEGORY_KEYWORDS = [
    ("rings", ["ring", "anillo", "sortija"]),
    ("necklaces", ["necklace", "collar", "chain", "cadena", "gargantilla"]),
    ("bracelets", ["bracelet", "pulsera", "bangle", "esclava"]),
    ("earrings", ["earring", "earrings", "arete", "aretes", "pendiente"]),
    ("pendants", ["pendant", "dije", "charm", "medallion", "medalla"]),
    ("brooches", ["brooch", "pin", "prendedor", "broche"]),
    ("watches", ["watch", "reloj"]),
]

MATERIAL_KEYWORDS = [
    ("gold", ["gold", "oro", "goldtone", "dorado"]),
    ("silver", ["silver", "plata", "sterling"]),
    ("pearl", ["pearl", "perla"]),
    ("turquoise", ["turquoise", "turquesa", "larimar", "aqua", "azul"]),
    ("stone", ["stone", "piedra", "gem", "crystal", "cristal"]),
    ("steel", ["steel", "acero"]),
]


def keyword_match(name: str, rules: list[tuple[str, list[str]]]) -> tuple[str | None, float, str]:
    value = name.lower()
    for label, tokens in rules:
        if any(token in value for token in tokens):
            return label, 0.75, "filename_keyword"
    return None, 0.0, "no_filename_keyword"


def geometry_category(file: dict[str, Any]) -> tuple[str | None, float, str]:
    width = int(file.get("width") or 0)
    height = int(file.get("height") or 0)
    if width <= 0 or height <= 0:
        return None, 0.0, "missing_dimensions"
    aspect = width / height
    name = str(file.get("name") or "").lower()
    if "20260617_12" in name:
        return "pendants", 0.35, "batch_time_visual_pattern"
    if aspect < 0.72:
        return "necklaces", 0.3, "portrait_ratio"
    if aspect > 1.35:
        return "bracelets", 0.25, "landscape_ratio"
    return "jewelry", 0.15, "generic_ratio"


def dominant_material_hint(file: dict[str, Any]) -> tuple[str | None, float, str]:
    name_material, confidence, reason = keyword_match(str(file.get("name") or ""), MATERIAL_KEYWORDS)
    if name_material:
        return name_material, confidence, reason
    return None, 0.0, "no_material_signal"


def choose(values: list[tuple[str | None, float, str]]) -> dict[str, Any]:
    filtered = [(label, confidence, reason) for label, confidence, reason in values if label]
    if not filtered:
        return {"value": "", "confidence": 0.0, "reasons": []}
    counts = Counter(label for label, _, _ in filtered)
    value = counts.most_common(1)[0][0]
    confidences = [confidence for label, confidence, _ in filtered if label == value]
    reasons = sorted({reason for label, _, reason in filtered if label == value})
    return {
        "value": value,
        "confidence": max(confidences) if confidences else 0.0,
        "reasons": reasons,
    }


def suggest(_: argparse.Namespace) -> int:
    reviewed = load_json(MANIFESTS / "ml-product-clusters-reviewed.json")
    base = load_json(MANIFESTS / "ml-product-clusters.json")
    if reviewed and base and reviewed.get("sourceClusterGeneratedAt") == base.get("generatedAt"):
        clusters = reviewed
    else:
        clusters = base
    if not clusters:
        raise FileNotFoundError("Missing cluster manifest. Run ml:cluster and gemini:apply-same-product-review first.")

    suggestions = []
    for cluster in clusters.get("clusters", []):
        category_votes = []
        material_votes = []
        for file in cluster.get("files", []):
            category_votes.append(keyword_match(str(file.get("name") or ""), CATEGORY_KEYWORDS))
            category_votes.append(geometry_category(file))
            material_votes.append(dominant_material_hint(file))
        category = choose(category_votes)
        material = choose(material_votes)
        representative = cluster.get("representative") or (cluster.get("files") or [{}])[0]
        product_name = ""
        if category["value"]:
            product_name = f"Galantes {category['value'].replace('_', ' ').title()}"
        suggestions.append({
            "clusterId": cluster["clusterId"],
            "suggestedProductName": product_name,
            "suggestedCategory": category["value"],
            "categoryConfidence": category["confidence"],
            "categoryReasons": category["reasons"],
            "suggestedMaterial": material["value"],
            "materialConfidence": material["confidence"],
            "materialReasons": material["reasons"],
            "representativeImage": representative.get("thumbPath") or representative.get("localPath"),
            "reviewRequired": True,
        })

    payload = {
        "ok": True,
        "policy": "metadata_suggestions_only_human_review_required",
        "suggestions": suggestions,
    }
    write_json(MANIFESTS / "product-metadata-suggestions.json", payload)
    print(json.dumps({
        "ok": True,
        "suggestions": len(suggestions),
        "output": "data/inventory-agent/manifests/product-metadata-suggestions.json",
    }, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("suggest").set_defaults(func=suggest)
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
