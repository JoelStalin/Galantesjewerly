#!/usr/bin/env python3
"""MediaPipe image classification hook for product category suggestions.

Requires:
  pip install mediapipe
  A MediaPipe-compatible image classifier .tflite model.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = ROOT / "data" / "inventory-agent" / "manifests"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def deps_check(_: argparse.Namespace) -> int:
    missing = []
    try:
        import mediapipe  # noqa: F401
    except Exception:
        missing.append("mediapipe")
    model_path = os.environ.get("MEDIAPIPE_IMAGE_CLASSIFIER_MODEL", "")
    if not model_path:
        missing.append("MEDIAPIPE_IMAGE_CLASSIFIER_MODEL")
    elif not Path(model_path).exists():
        missing.append(f"model_not_found:{model_path}")
    payload = {
        "ok": not missing,
        "missingRequired": missing,
        "install": "python -m pip install mediapipe",
        "modelEnv": "MEDIAPIPE_IMAGE_CLASSIFIER_MODEL",
        "note": "Use a MediaPipe-compatible .tflite classifier. Suggestions remain review-gated.",
    }
    write_json(MANIFESTS / "mediapipe-deps-check.json", payload)
    print(json.dumps(payload, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("deps-check").set_defaults(func=deps_check)
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
