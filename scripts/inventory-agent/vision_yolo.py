#!/usr/bin/env python3
"""YOLO-assisted product object and category suggestions.

YOLOv8n COCO is used for object/region evidence only. Jewelry category
suggestions remain reviewable because COCO does not provide fine jewelry
classes such as ring, bracelet, necklace, or earrings.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = ROOT / "data" / "inventory-agent" / "manifests"


def import_or_none(module_name: str):
    try:
        return __import__(module_name)
    except Exception:
        return None


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def deps_check(_: argparse.Namespace) -> int:
    missing = []
    if import_or_none("ultralytics") is None:
        missing.append("ultralytics")
    payload = {
        "ok": not missing,
        "missingRequired": missing,
        "install": "python -m pip install ultralytics",
        "model": "yolov8n.pt",
        "note": "YOLOv8n COCO helps with object/region evidence. Jewelry category remains review-gated.",
    }
    write_json(MANIFESTS / "yolo-deps-check.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


def category_from_name(name: str) -> tuple[str | None, float, str]:
    value = name.lower()
    rules = [
        ("ring", ["ring", "anillo"]),
        ("necklace", ["necklace", "collar", "chain", "cadena"]),
        ("bracelet", ["bracelet", "pulsera", "bangle"]),
        ("earrings", ["earring", "earrings", "arete", "aretes"]),
        ("pendant", ["pendant", "dije", "charm"]),
        ("watch", ["watch", "reloj"]),
    ]
    for category, tokens in rules:
        if any(token in value for token in tokens):
            return category, 0.65, "filename_keyword"
    return None, 0.0, "no_filename_signal"


def category_from_geometry(width: int, height: int, detections: list[dict[str, Any]]) -> tuple[str | None, float, str]:
    if width <= 0 or height <= 0:
        return None, 0.0, "missing_dimensions"
    aspect = width / height
    if aspect < 0.72:
        return "necklace", 0.35, "portrait_display_heuristic"
    if aspect > 1.28:
        return "bracelet_or_necklace", 0.3, "landscape_display_heuristic"
    if detections:
        return "jewelry", 0.25, "object_region_detected"
    return None, 0.0, "no_geometry_signal"


def classify(_: argparse.Namespace) -> int:
    deps = deps_check(argparse.Namespace())
    if deps != 0:
        return deps

    from ultralytics import YOLO

    features_path = MANIFESTS / "image-features.json"
    clusters_path = MANIFESTS / "ml-product-clusters.json"
    if not features_path.exists():
        raise FileNotFoundError("Missing image-features.json. Run image:features first.")

    features = load_json(features_path).get("files", [])
    clusters = load_json(clusters_path).get("clusters", []) if clusters_path.exists() else []
    model = YOLO("yolov8n.pt")
    per_image = []

    for file in features:
        image_path = ROOT / file["localPath"]
        result = model.predict(source=str(image_path), imgsz=640, conf=0.25, verbose=False)[0]
        detections = []
        names = result.names
        for box in result.boxes:
            cls_id = int(box.cls[0])
            xyxy = [float(value) for value in box.xyxy[0].tolist()]
            detections.append({
                "class": names.get(cls_id, str(cls_id)),
                "confidence": float(box.conf[0]),
                "xyxy": xyxy,
            })
        name_category, name_conf, name_reason = category_from_name(str(file.get("name", "")))
        geometry_category, geometry_conf, geometry_reason = category_from_geometry(
            int(file.get("width") or 0),
            int(file.get("height") or 0),
            detections,
        )
        suggested_category = name_category or geometry_category or "jewelry"
        confidence = max(name_conf, geometry_conf, 0.15 if detections else 0.05)
        per_image.append({
            "id": file["id"],
            "name": file["name"],
            "localPath": file["localPath"],
            "detections": detections,
            "suggestedCategory": suggested_category,
            "categoryConfidence": confidence,
            "categoryReasons": [name_reason, geometry_reason],
            "reviewRequired": True,
        })

    image_by_id = {item["id"]: item for item in per_image}
    cluster_suggestions = []
    for cluster in clusters:
        image_items = [image_by_id[file["id"]] for file in cluster.get("files", []) if file.get("id") in image_by_id]
        categories = [item["suggestedCategory"] for item in image_items]
        if categories:
            suggested = max(set(categories), key=categories.count)
            agreement = categories.count(suggested) / len(categories)
        else:
            suggested = "jewelry"
            agreement = 0.0
        cluster_suggestions.append({
            "clusterId": cluster["clusterId"],
            "suggestedCategory": suggested,
            "categoryAgreement": agreement,
            "reviewRequired": True,
            "imageIds": [item["id"] for item in image_items],
        })

    payload = {
        "ok": True,
        "model": "yolov8n.pt",
        "policy": "suggestions_only_no_publish_approval",
        "images": per_image,
        "clusters": cluster_suggestions,
    }
    write_json(MANIFESTS / "yolo-category-suggestions.json", payload)
    print(json.dumps({
        "ok": True,
        "images": len(per_image),
        "clusters": len(cluster_suggestions),
        "output": "data/inventory-agent/manifests/yolo-category-suggestions.json",
    }, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("deps-check").set_defaults(func=deps_check)
    subparsers.add_parser("classify").set_defaults(func=classify)
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
