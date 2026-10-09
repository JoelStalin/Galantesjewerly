#!/usr/bin/env python3
"""
add_vector_exemplar.py
Appends a confirmed incoming photo vector as an additional exemplar for a product SKU,
enabling continuous active learning and multi-view representation in the catalog index.
"""

from __future__ import annotations
import argparse
import json
import time
from pathlib import Path
from ml_similarity import image_vector, load_json, save_json


def main():
    parser = argparse.ArgumentParser(description="Add positive exemplar to vector index")
    parser.add_argument("--image", required=True, help="Path to confirmed image")
    parser.add_argument("--sku", required=True, help="Product SKU")
    parser.add_argument("--product-id", default="", help="Product ID")
    parser.add_argument("--index", required=True, help="Path to image-vectors.json index file")
    args = parser.parse_args()

    img_path = Path(args.image)
    if not img_path.exists():
        print(json.dumps({"ok": False, "error": f"Image file not found: {args.image}"}))
        return 1

    index_path = Path(args.index)
    if not index_path.exists():
        index_data = []
    else:
        index_data = load_json(index_path)

    vec = image_vector(img_path)
    exemplar_id = f"{args.sku}-ex-{int(time.time())}"

    new_entry = {
        "id": exemplar_id,
        "sku": args.sku,
        "productId": args.product_id,
        "path": str(img_path),
        "vector": vec,
        "type": "human_confirmed_exemplar",
        "addedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    index_data.append(new_entry)
    save_json(index_path, index_data)

    print(json.dumps({
        "ok": True,
        "exemplarId": exemplar_id,
        "sku": args.sku,
        "totalIndexSize": len(index_data)
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
