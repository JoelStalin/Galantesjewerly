#!/usr/bin/env python3
"""Single image comparator for WhatsApp incoming intake against local catalog vectors."""

from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path
from ml_similarity import image_vector, cosine_distance, load_json, opencv_absdiff_similarity

ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = ROOT / "data" / "inventory-agent" / "vectors" / "image-vectors.json"


def compare_image(incoming_path_str: str, threshold: float = 0.95):
    incoming_path = Path(incoming_path_str)
    if not incoming_path.exists():
        return {"ok": False, "error": f"Incoming file not found: {incoming_path_str}"}

    if not INDEX_PATH.exists():
        return {
            "ok": True,
            "bestMatch": None,
            "similarity": 0.0,
            "status": "no_index",
            "candidates": []
        }

    try:
        index_data = load_json(INDEX_PATH)
    except Exception as e:
        return {"ok": False, "error": f"Failed to load image vectors index: {e}"}

    incoming_vec = image_vector(incoming_path)

    results = []
    for item in index_data:
        target_vec = item.get("vector")
        if not target_vec:
            continue
        dist = cosine_distance(incoming_vec, target_vec)
        sim = max(0.0, 1.0 - dist)
        results.append({
            "id": item.get("id"),
            "path": item.get("path"),
            "sku": item.get("sku"),
            "productId": item.get("productId"),
            "similarity": round(sim, 4),
        })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    best = results[0] if results else None
    best_sim = best["similarity"] if best else 0.0

    if best_sim >= threshold:
        status = "auto_match"
    elif best_sim >= 0.70:
        status = "ambiguous"
    else:
        status = "no_match"

    return {
        "ok": True,
        "incomingPath": str(incoming_path),
        "status": status,
        "similarity": best_sim,
        "bestMatch": best,
        "topCandidates": results[:5],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to incoming image")
    parser.add_argument("--threshold", type=float, default=0.95, help="Auto-match threshold (default: 0.95)")
    args = parser.parse_args()

    result = compare_image(args.image, args.threshold)
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
