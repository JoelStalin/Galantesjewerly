#!/usr/bin/env python3
"""Local image similarity tools for the Galantes inventory agent.

Commands:
  deps-check     Report optional Python dependencies.
  build-index    Build dataframe, simple visual vectors, nearest neighbors.
  cluster        Build same-product candidate clusters from nearest neighbors.
  contact-sheets Generate review contact sheets for clusters.

This script is deterministic and does not call LLMs or production services.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = ROOT / "data" / "inventory-agent" / "manifests"
VECTORS = ROOT / "data" / "inventory-agent" / "vectors"
REVIEW = ROOT / "data" / "inventory-agent" / "review"


def import_or_none(module_name: str):
    try:
        return __import__(module_name)
    except Exception:
        return None


def check_deps() -> dict[str, Any]:
    modules = {
        "pandas": import_or_none("pandas"),
        "numpy": import_or_none("numpy"),
        "PIL": import_or_none("PIL"),
        "sklearn": import_or_none("sklearn"),
        "cv2": import_or_none("cv2"),
        "imagehash": import_or_none("imagehash"),
        "faiss": import_or_none("faiss"),
    }
    required = ["pandas", "numpy", "PIL", "sklearn"]
    missing_required = [name for name in required if modules[name] is None]
    missing_optional = [name for name in ["cv2", "imagehash", "faiss"] if modules[name] is None]
    return {
        "ok": not missing_required,
        "missingRequired": missing_required,
        "missingOptional": missing_optional,
        "note": "Install required packages before build-index. faiss and imagehash are optional enhancements.",
    }


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def hamming_hex(left: str, right: str) -> int:
    value = int(left, 16) ^ int(right, 16)
    return value.bit_count()


def image_vector(image_path: Path) -> list[float]:
    import numpy as np
    from PIL import Image, ImageStat, ImageFilter

    with Image.open(image_path) as image:
        image = image.convert("RGB")
        resized = image.resize((16, 16))
        arr = np.asarray(resized, dtype=np.float32) / 255.0
        color_hist = []
        for channel in range(3):
            hist, _ = np.histogram(arr[:, :, channel], bins=16, range=(0.0, 1.0), density=True)
            color_hist.extend(hist.astype(np.float32).tolist())

        gray = image.convert("L").resize((32, 32))
        gray_arr = np.asarray(gray, dtype=np.float32) / 255.0
        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_arr = np.asarray(edges, dtype=np.float32) / 255.0
        stat = ImageStat.Stat(image)
        means = [value / 255.0 for value in stat.mean]
        stddev = [value / 255.0 for value in stat.stddev]
        compact = [
            float(gray_arr.mean()),
            float(gray_arr.std()),
            float(edge_arr.mean()),
            float(edge_arr.std()),
            *means,
            *stddev,
        ]
        vector = np.array([*color_hist, *compact], dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector.tolist()


def cosine_distance(left: list[float], right: list[float]) -> float:
    import numpy as np

    a = np.asarray(left, dtype=np.float32)
    b = np.asarray(right, dtype=np.float32)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 1.0
    return float(1.0 - (np.dot(a, b) / denom))


def opencv_prepare_absdiff_image(image_path: Path) -> Any | None:
    cv2 = import_or_none("cv2")
    if cv2 is None:
        return None
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        return None
    size = (256, 256)
    image = cv2.resize(image, size, interpolation=cv2.INTER_AREA)
    return cv2.GaussianBlur(image, (21, 21), 0)


def opencv_absdiff_similarity(
    left_path: Path,
    right_path: Path,
    prepared_images: dict[str, Any] | None = None,
) -> dict[str, float] | None:
    cv2 = import_or_none("cv2")
    if cv2 is None:
        return None
    if prepared_images is None:
        left = opencv_prepare_absdiff_image(left_path)
        right = opencv_prepare_absdiff_image(right_path)
    else:
        left = prepared_images.get(str(left_path))
        right = prepared_images.get(str(right_path))
    if left is None or right is None:
        return None
    diff = cv2.absdiff(left, right)
    threshold = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)[1]
    changed = float(cv2.countNonZero(threshold))
    total = float(left.shape[0] * left.shape[1])
    changed_ratio = changed / total
    return {
        "opencvChangedRatio": changed_ratio,
        "opencvAbsDiffSimilarity": 1.0 - changed_ratio,
    }


def build_index(args: argparse.Namespace) -> int:
    deps = check_deps()
    if not deps["ok"]:
        write_json(MANIFESTS / "ml-deps-check.json", deps)
        print(json.dumps(deps, indent=2))
        return 1

    import numpy as np
    import pandas as pd
    from sklearn.neighbors import NearestNeighbors

    features_path = MANIFESTS / "image-features.json"
    if not features_path.exists():
        raise FileNotFoundError("Missing image-features.json. Run image:features first.")

    manifest = load_json(features_path)
    rows = manifest.get("files", [])
    vectors = []
    output_rows = []
    for row in rows:
        absolute_path = ROOT / row["localPath"]
        vector = image_vector(absolute_path)
        vectors.append(vector)
        output_rows.append({**row, "vectorModel": "local-color-edge-v1"})

    VECTORS.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(output_rows)
    df.to_parquet(VECTORS / "image-features.parquet", index=False)
    np.save(VECTORS / "image-vectors.npy", np.asarray(vectors, dtype=np.float32))

    prepared_images = {
        str(ROOT / row["localPath"]): opencv_prepare_absdiff_image(ROOT / row["localPath"])
        for row in output_rows
    }
    neighbors = []
    if len(vectors) > 1:
        matrix = np.asarray(vectors, dtype=np.float32)
        k = min(max(2, int(args.k)), len(vectors))
        nn = NearestNeighbors(n_neighbors=k, metric="cosine")
        nn.fit(matrix)
        distances, indices = nn.kneighbors(matrix)
        for source_index, row in enumerate(output_rows):
            for rank, target_index in enumerate(indices[source_index].tolist()):
                if source_index == target_index:
                    continue
                target = output_rows[target_index]
                opencv_scores = opencv_absdiff_similarity(
                    ROOT / row["localPath"],
                    ROOT / target["localPath"],
                    prepared_images,
                ) or {}
                neighbors.append({
                    "sourceId": row["id"],
                    "targetId": target["id"],
                    "rank": rank,
                    "cosineDistance": float(distances[source_index][rank]),
                    "dhashDistance": hamming_hex(str(row["dhash"]), str(target["dhash"])),
                    **opencv_scores,
                })

    neighbors_df = pd.DataFrame(neighbors)
    neighbors_df.to_parquet(VECTORS / "image-neighbors.parquet", index=False)
    payload = {
        "ok": True,
        "method": "local-color-edge-v1 + sklearn NearestNeighbors",
        "images": len(output_rows),
        "neighbors": len(neighbors),
        "outputs": {
            "features": "data/inventory-agent/vectors/image-features.parquet",
            "vectors": "data/inventory-agent/vectors/image-vectors.npy",
            "neighbors": "data/inventory-agent/vectors/image-neighbors.parquet",
        },
        "warning": "This local vector is a deterministic baseline. Add CLIP/SigLIP later for stronger semantic matching.",
    }
    write_json(MANIFESTS / "ml-similarity-index.json", payload)
    print(json.dumps(payload, indent=2))
    return 0


@dataclass
class DisjointSet:
    parent: dict[str, str]

    def find(self, value: str) -> str:
        self.parent.setdefault(value, value)
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, left: str, right: str) -> None:
        self.parent[self.find(right)] = self.find(left)


def cluster(args: argparse.Namespace) -> int:
    deps = check_deps()
    if not deps["ok"]:
        write_json(MANIFESTS / "ml-deps-check.json", deps)
        print(json.dumps(deps, indent=2))
        return 1

    import pandas as pd

    features_file = VECTORS / "image-features.parquet"
    neighbors_file = VECTORS / "image-neighbors.parquet"
    if not features_file.exists() or not neighbors_file.exists():
        raise FileNotFoundError("Missing ML index files. Run build-index first.")

    features = pd.read_parquet(features_file)
    neighbors = pd.read_parquet(neighbors_file)
    dsu = DisjointSet(parent={})
    for image_id in features["id"].tolist():
        dsu.find(str(image_id))

    cosine_threshold = float(args.cosine_threshold)
    dhash_threshold = int(args.dhash_threshold)
    relaxed_dhash = int(args.relaxed_dhash_threshold)
    opencv_threshold = float(args.opencv_threshold)
    neighbors = neighbors.copy()
    if "opencvAbsDiffSimilarity" not in neighbors:
        neighbors["opencvAbsDiffSimilarity"] = 0.0
    def score_edge(edge: Any) -> float:
        return max(
            1.0 - min(float(edge["cosineDistance"]), 1.0),
            1.0 - min(float(edge["dhashDistance"]) / 64.0, 1.0),
            float(edge.get("opencvAbsDiffSimilarity") or 0.0),
        )

    def decide_edge(edge: Any) -> str:
        cosine = float(edge["cosineDistance"])
        dhash = int(edge["dhashDistance"])
        opencv_similarity = float(edge.get("opencvAbsDiffSimilarity") or 0.0)
        strict_match = cosine <= cosine_threshold and dhash <= dhash_threshold
        near_duplicate = (
            cosine <= 0.08
            and dhash <= relaxed_dhash
            and opencv_similarity >= opencv_threshold
        )
        if strict_match or near_duplicate:
            return "auto_same_product"
        if edge["sameProductScore"] >= 0.60:
            return "gemini_review"
        return "different_product"

    neighbors["sameProductScore"] = neighbors.apply(score_edge, axis=1)
    neighbors["decisionBand"] = neighbors.apply(decide_edge, axis=1)
    strong_edges = neighbors[neighbors["decisionBand"] == "auto_same_product"]
    gemini_edges = neighbors[neighbors["decisionBand"] == "gemini_review"]
    for _, edge in strong_edges.iterrows():
        dsu.union(str(edge["sourceId"]), str(edge["targetId"]))

    groups: dict[str, list[dict[str, Any]]] = {}
    feature_by_id = {str(row["id"]): row for row in features.to_dict(orient="records")}
    for image_id in feature_by_id:
        groups.setdefault(dsu.find(image_id), []).append(feature_by_id[image_id])

    clusters = []
    cluster_index = 1
    max_candidate_component_size = int(getattr(args, "max_candidate_component_size", 25))
    for files in groups.values():
        ids = {str(file["id"]) for file in files}
        cluster_edges = neighbors[
            neighbors["sourceId"].astype(str).isin(ids)
            & neighbors["targetId"].astype(str).isin(ids)
        ]
        min_cosine = None
        max_dhash = None
        max_opencv_similarity = None
        if not cluster_edges.empty:
            min_cosine = float(cluster_edges["cosineDistance"].min())
            max_dhash = int(cluster_edges["dhashDistance"].max())
            if "opencvAbsDiffSimilarity" in cluster_edges:
                max_opencv_similarity = float(cluster_edges["opencvAbsDiffSimilarity"].max())
        confidence = "high" if (
            len(files) > 1
            and min_cosine is not None
            and min_cosine <= cosine_threshold
            and max_dhash is not None
            and max_dhash <= relaxed_dhash
        ) else "candidate"
        if len(files) == 1:
            confidence = "single"
        if (
            len(files) > max_candidate_component_size
            and confidence != "high"
        ):
            for file in files:
                clusters.append({
                    "clusterId": f"ml-cluster-{cluster_index:04d}",
                    "status": "needs_review",
                    "confidence": "single",
                    "reasonCodes": [
                        "nearest_neighbor",
                        "dhash_prefilter",
                        "opencv_absdiff",
                        "large_candidate_component_split",
                    ],
                    "minCosineDistance": None,
                    "maxDhashDistance": None,
                    "maxOpenCvAbsDiffSimilarity": None,
                    "representative": file,
                    "files": [file],
                    "needsHumanReview": True,
                })
                cluster_index += 1
            continue
        clusters.append({
            "clusterId": f"ml-cluster-{cluster_index:04d}",
            "status": "needs_review",
            "confidence": confidence,
            "reasonCodes": ["nearest_neighbor", "dhash_prefilter", "opencv_absdiff"],
            "minCosineDistance": min_cosine,
            "maxDhashDistance": max_dhash,
            "maxOpenCvAbsDiffSimilarity": max_opencv_similarity,
            "representative": files[0],
            "files": files,
            "needsHumanReview": confidence != "high",
        })
        cluster_index += 1

    payload = {
        "ok": True,
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").UTC).isoformat(),
        "method": "nearest-neighbor-connected-components",
        "thresholds": {
            "autoSameProductScore": 0.85,
            "geminiReviewMinScore": 0.60,
            "cosineDistance": cosine_threshold,
            "dhashDistance": dhash_threshold,
            "relaxedDhashDistance": relaxed_dhash,
            "opencvAbsDiffSimilarity": opencv_threshold,
            "maxCandidateComponentSize": max_candidate_component_size,
        },
        "clusters": clusters,
        "geminiReviewPairs": gemini_edges.to_dict(orient="records"),
    }
    write_json(MANIFESTS / "ml-product-clusters.json", payload)
    print(json.dumps({
        "ok": True,
        "clusters": len(clusters),
        "multiImageClusters": sum(1 for item in clusters if len(item["files"]) > 1),
        "output": "data/inventory-agent/manifests/ml-product-clusters.json",
    }, indent=2))
    return 0


def contact_sheets(args: argparse.Namespace) -> int:
    deps = check_deps()
    if "PIL" in deps["missingRequired"]:
        print(json.dumps(deps, indent=2))
        return 1

    from PIL import Image, ImageDraw

    reviewed_path = MANIFESTS / "ml-product-clusters-reviewed.json"
    base_path = MANIFESTS / "ml-product-clusters.json"
    clusters_path = base_path
    if reviewed_path.exists() and base_path.exists():
        reviewed = load_json(reviewed_path)
        base = load_json(base_path)
        if reviewed.get("sourceClusterGeneratedAt") == base.get("generatedAt"):
            clusters_path = reviewed_path
    elif reviewed_path.exists():
        clusters_path = reviewed_path
    if not clusters_path.exists():
        raise FileNotFoundError("Missing ml-product-clusters.json. Run cluster first.")

    clusters_manifest = load_json(clusters_path)
    REVIEW.mkdir(parents=True, exist_ok=True)
    outputs = []
    for cluster_item in clusters_manifest.get("clusters", []):
        files = cluster_item.get("files", [])
        if not files:
            continue
        tile_w, tile_h, label_h = 220, 220, 34
        cols = min(4, max(1, len(files)))
        rows = math.ceil(len(files) / cols)
        sheet = Image.new("RGB", (cols * tile_w, rows * (tile_h + label_h)), "white")
        draw = ImageDraw.Draw(sheet)
        for index, file in enumerate(files):
            source = ROOT / file["localPath"]
            with Image.open(source) as image:
                image = image.convert("RGB")
                image.thumbnail((tile_w, tile_h))
                x = (index % cols) * tile_w + (tile_w - image.width) // 2
                y = (index // cols) * (tile_h + label_h) + (tile_h - image.height) // 2
                sheet.paste(image, (x, y))
            label_y = (index // cols) * (tile_h + label_h) + tile_h
            draw.text(((index % cols) * tile_w + 8, label_y + 8), str(file["name"])[:32], fill=(0, 0, 0))
        output = REVIEW / f"{cluster_item['clusterId']}-contact-sheet.jpg"
        sheet.save(output, quality=88)
        outputs.append(str(output.relative_to(ROOT)).replace("\\", "/"))

    payload = {"ok": True, "sheets": outputs, "count": len(outputs)}
    write_json(REVIEW / "contact-sheets.json", payload)
    print(json.dumps(payload, indent=2))
    return 0


def deps_check(_: argparse.Namespace) -> int:
    payload = check_deps()
    write_json(MANIFESTS / "ml-deps-check.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("deps-check").set_defaults(func=deps_check)

    build = subparsers.add_parser("build-index")
    build.add_argument("--k", default=6)
    build.set_defaults(func=build_index)

    cluster_parser = subparsers.add_parser("cluster")
    cluster_parser.add_argument("--cosine-threshold", default=0.035)
    cluster_parser.add_argument("--dhash-threshold", default=8)
    cluster_parser.add_argument("--relaxed-dhash-threshold", default=18)
    cluster_parser.add_argument("--opencv-threshold", default=0.92)
    cluster_parser.add_argument("--max-candidate-component-size", default=25)
    cluster_parser.set_defaults(func=cluster)

    subparsers.add_parser("contact-sheets").set_defaults(func=contact_sheets)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
