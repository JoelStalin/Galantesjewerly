#!/usr/bin/env python3
"""Image normalization tools for the Galantes inventory agent.

The original Drive downloads are never modified. Converted files are written
under data/inventory-agent/converted and referenced through a normalized
manifest used by downstream feature extraction.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = ROOT / "data" / "inventory-agent" / "manifests"
CONVERTED = ROOT / "data" / "inventory-agent" / "converted"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def deps_check(_: argparse.Namespace) -> int:
    missing = []
    try:
        import PIL  # noqa: F401
    except Exception:
        missing.append("Pillow")
    try:
        import pillow_heif  # noqa: F401
    except Exception:
        missing.append("pillow-heif")

    payload = {
        "ok": not missing,
        "missingRequired": missing,
        "install": 'python -m pip install "pillow-heif"',
        "note": "pillow-heif is required only for HEIC/HEIF normalization.",
    }
    write_json(MANIFESTS / "image-convert-deps-check.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


def is_heic(file: dict[str, Any]) -> bool:
    name = str(file.get("name") or file.get("localPath") or "").lower()
    mime = str(file.get("mimeType") or "").lower()
    return name.endswith((".heic", ".heif")) or mime in {"image/heic", "image/heif"}


def convert_heic(_: argparse.Namespace) -> int:
    try:
        from PIL import Image
        from pillow_heif import register_heif_opener
    except Exception as exc:
        payload = {
            "ok": False,
            "error": str(exc),
            "missingRequired": ["pillow-heif"],
            "install": 'python -m pip install "pillow-heif"',
        }
        write_json(MANIFESTS / "heic-conversion.json", payload)
        print(json.dumps(payload, indent=2))
        return 1

    downloads_path = MANIFESTS / "downloads.json"
    if not downloads_path.exists():
        raise FileNotFoundError("Missing downloads.json. Run drive:download first.")

    register_heif_opener()
    CONVERTED.mkdir(parents=True, exist_ok=True)
    downloads = load_json(downloads_path)
    normalized_files = []
    converted = []
    skipped = []
    errors = []

    for file in downloads.get("files", []):
        if not is_heic(file):
            normalized_files.append(file)
            skipped.append({"id": file.get("id"), "name": file.get("name"), "reason": "not_heic"})
            continue

        source = ROOT / file["localPath"]
        target_name = f"{file['id']}-{Path(file['name']).stem}.jpg"
        target = CONVERTED / target_name
        try:
            if not target.exists():
                with Image.open(source) as image:
                    image = image.convert("RGB")
                    image.save(target, format="JPEG", quality=92, optimize=True)
            converted_entry = {
                **file,
                "originalLocalPath": file["localPath"],
                "originalMimeType": file.get("mimeType"),
                "localPath": str(target.relative_to(ROOT)).replace("\\", "/"),
                "mimeType": "image/jpeg",
                "name": f"{Path(file['name']).stem}.jpg",
                "convertedFrom": "heic",
                "sha256": sha256_file(target),
            }
            normalized_files.append(converted_entry)
            converted.append({
                "id": file.get("id"),
                "source": file["localPath"],
                "target": converted_entry["localPath"],
            })
        except Exception as exc:
            errors.append({
                "id": file.get("id"),
                "name": file.get("name"),
                "localPath": file.get("localPath"),
                "error": str(exc),
            })

    normalized = {
        **downloads,
        "normalizedAt": __import__("datetime").datetime.now(__import__("datetime").UTC).isoformat(),
        "sourceManifest": "data/inventory-agent/manifests/downloads.json",
        "files": normalized_files,
        "conversion": {
            "converted": len(converted),
            "skipped": len(skipped),
            "errors": len(errors),
        },
    }
    report = {
        "ok": not errors,
        "converted": converted,
        "skippedCount": len(skipped),
        "errors": errors,
        "normalizedManifest": "data/inventory-agent/manifests/downloads-normalized.json",
    }
    write_json(MANIFESTS / "downloads-normalized.json", normalized)
    write_json(MANIFESTS / "heic-conversion.json", report)
    print(json.dumps({
        "ok": report["ok"],
        "converted": len(converted),
        "skipped": len(skipped),
        "errors": len(errors),
        "normalizedManifest": report["normalizedManifest"],
    }, indent=2))
    return 0 if report["ok"] else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("deps-check").set_defaults(func=deps_check)
    subparsers.add_parser("convert-heic").set_defaults(func=convert_heic)
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
