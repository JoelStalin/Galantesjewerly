#!/usr/bin/env python3
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
m_path = ROOT / "data" / "inventory-agent" / "manifests" / "gallery-ready-products.json"

if not m_path.exists():
    print(f"Manifest not found: {m_path}")
    exit(1)

with open(m_path, "r", encoding="utf-8") as f:
    data = json.load(f)

products = data.get("products", [])
found_primary = 0
total_gallery = 0
found_gallery = 0

for p in products:
    prim = ROOT / p["primaryImagePath"]
    if prim.exists():
        found_primary += 1
    for g in p.get("galleryImagePaths", []):
        total_gallery += 1
        gp = ROOT / g
        if gp.exists():
            found_gallery += 1

print(f"Manifest products: {len(products)}")
print(f"Primary images found: {found_primary}/{len(products)}")
print(f"Gallery multi-angle images found: {found_gallery}/{total_gallery}")
