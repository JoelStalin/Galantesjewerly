#!/usr/bin/env python3
"""
gdrive_multi_angle_matcher.py
Multi-Angle Google Drive Matcher for Galantes Jewelry Inventory Agent.

Features:
1. Searches the Google Drive catalog (51 gallery-ready products, 185 unique photos)
   when the user indicates that none of the initial prospects match ('ninguna', '3', 'NO').
2. Compares the incoming intake image across multiple angles (Frontal, Lateral, 45° Perspective).
3. Evaluates 3D stone geometry (shape, mm width, aspect ratio, circularity).
4. Generates a luxury multi-angle contact sheet showcasing the intake photo next to all matched angles.
"""

from __future__ import annotations
import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "data" / "inventory-agent" / "manifests" / "gallery-ready-products.json"
EVIDENCE_DIR = ROOT / "data" / "inventory-agent" / "evidence"

try:
    from ml_similarity import image_vector, cosine_distance
    from stone_geometry_knn import detect_stone_3d_geometry
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent))
    from ml_similarity import image_vector, cosine_distance
    from stone_geometry_knn import detect_stone_3d_geometry


def search_google_drive_multi_angle(
    incoming_image_path: str | Path,
    manifest_path: Optional[Path] = None,
    top_k: int = 3
) -> Dict[str, Any]:
    """
    Scans the Google Drive multi-angle dataset and compares the intake image
    against all camera angles of each candidate cluster.
    """
    in_p = Path(incoming_image_path)
    if not in_p.exists():
        return {"ok": False, "error": f"Incoming image not found: {incoming_image_path}"}

    m_path = manifest_path or MANIFEST_PATH
    if not m_path.exists():
        return {"ok": False, "error": f"Manifest not found: {m_path}"}

    with open(m_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    products = data.get("products", [])
    in_vec = image_vector(in_p)
    in_geom = detect_stone_3d_geometry(in_p)
    in_width = in_geom.get("estimated_width_mm", 6.0)
    in_shape = in_geom.get("shape", "Solitaire")

    scored_clusters = []
    total_angles_evaluated = 0

    for prod in products:
        cid = prod.get("clusterId", "unknown")
        primary_rel = prod.get("primaryImagePath", "")
        gallery_rels = prod.get("galleryImagePaths", [])
        all_rels = [primary_rel] + gallery_rels

        angle_matches = []
        for idx, rel in enumerate(all_rels):
            full_img_p = ROOT / rel
            if not full_img_p.exists():
                continue

            total_angles_evaluated += 1
            ang_vec = image_vector(full_img_p)
            dist = cosine_distance(in_vec, ang_vec)
            sim = max(0.0, 1.0 - dist)

            # Angle tag heuristic based on index
            if idx == 0:
                angle_label = "Frontal / Cenital (Ángulo 1)"
            elif idx == 1:
                angle_label = "Lateral / Perfil (Ángulo 2)"
            elif idx == 2:
                angle_label = "Perspectiva 45° (Ángulo 3)"
            elif idx == 3:
                angle_label = "Macro / Detalle (Ángulo 4)"
            else:
                angle_label = f"Toma Adicional (Ángulo {idx+1})"

            angle_matches.append({
                "angle_index": idx + 1,
                "label": angle_label,
                "rel_path": rel,
                "abs_path": str(full_img_p),
                "similarity": round(sim, 4),
                "similarity_pct": round(sim * 100, 1)
            })

        if not angle_matches:
            continue

        # Sort angles by match similarity descending
        angle_matches.sort(key=lambda x: x["similarity"], reverse=True)
        best_angle = angle_matches[0]
        avg_sim = sum(a["similarity"] for a in angle_matches) / len(angle_matches)

        # 3D stone geometry evaluation on the best angle
        best_geom = detect_stone_3d_geometry(best_angle["abs_path"])
        cand_width = best_geom.get("estimated_width_mm", 6.0)
        width_ratio = 1.0 - min(1.0, abs(in_width - cand_width) / max(6.0, in_width))
        shape_match = 1.0 if best_geom.get("shape") == in_shape else 0.85

        # Multi-angle consensus score: 50% best angle visual + 25% avg angles visual + 25% 3D stone geometry
        consensus_score = round(
            0.50 * best_angle["similarity"] +
            0.25 * avg_sim +
            0.25 * (width_ratio * 0.6 + shape_match * 0.4),
            4
        )

        scored_clusters.append({
            "cluster_id": cid,
            "sku": f"GAL-GD-{cid[-4:]}",
            "consensus_score": consensus_score,
            "consensus_pct": round(consensus_score * 100, 1),
            "best_angle": best_angle,
            "avg_similarity": round(avg_sim, 4),
            "angles_count": len(angle_matches),
            "angles": angle_matches,
            "best_angle_geometry": best_geom
        })

    # Sort clusters by consensus score descending
    scored_clusters.sort(key=lambda x: x["consensus_score"], reverse=True)
    top_matches = scored_clusters[:top_k]

    return {
        "ok": True,
        "incoming_image": str(in_p),
        "incoming_geometry": in_geom,
        "total_clusters_searched": len(products),
        "total_angles_evaluated": total_angles_evaluated,
        "best_cluster": top_matches[0] if top_matches else None,
        "top_matches": top_matches
    }


def generate_multi_angle_contact_sheet(
    incoming_image_path: str | Path,
    matched_cluster: Dict[str, Any],
    output_path: str | Path
) -> str:
    """
    Renders an elegant, high-res visual comparison sheet:
    [Foto Intake Chat] | [Ángulo 1 Frontal] | [Ángulo 2 Lateral] | [Ángulo 3 Perspectiva]
    with percentage badges and 3D measurements.
    """
    from PIL import Image, ImageDraw

    card_w = 260
    card_h = 260
    pad = 16
    header_h = 60
    footer_h = 50

    angles = matched_cluster.get("angles", [])[:3]
    total_panels = 1 + len(angles)  # 1 intake + up to 3 angles

    total_w = total_panels * card_w + (total_panels + 1) * pad
    total_h = card_h + header_h + footer_h + pad * 2 + 30

    canvas = Image.new("RGB", (total_w, total_h), (15, 23, 42))  # luxury deep navy
    draw = ImageDraw.Draw(canvas)

    # Top Luxury Banner
    draw.rectangle([0, 0, total_w, header_h], fill=(30, 41, 59))
    draw.text(
        (pad + 10, 14),
        "GALANTE'S JEWELRY - BÚSQUEDA MULTI-ÁNGULO EN GOOGLE DRIVE",
        fill=(212, 175, 55)  # Gold
    )
    cid = matched_cluster.get("cluster_id", "")
    sku = matched_cluster.get("sku", "")
    c_pct = matched_cluster.get("consensus_pct", 0.0)
    draw.text(
        (pad + 10, 36),
        f"Mejor Coincidencia: Cluster {cid} ({sku}) | Consenso Multi-Ángulo: {c_pct}% | {matched_cluster.get('angles_count')} Tomas Analizadas",
        fill=(203, 213, 225)
    )

    resample_filter = getattr(getattr(Image, 'Resampling', Image), 'LANCZOS', getattr(Image, 'ANTIALIAS', 1))

    # Panel 0: Intake Image
    x0 = pad
    y0 = header_h + pad
    draw.rectangle([x0, y0, x0 + card_w, y0 + 26], fill=(59, 130, 246))  # Blue badge
    draw.text((x0 + 8, y0 + 5), "FOTO DE INGRESO (CHAT)", fill=(255, 255, 255))

    in_card = Image.new("RGB", (card_w, card_h), (10, 15, 28))
    try:
        in_img = Image.open(incoming_image_path).convert("RGB")
        in_img.thumbnail((card_w - 6, card_h - 6), resample_filter)
        in_card.paste(in_img, ((card_w - in_img.width) // 2, (card_h - in_img.height) // 2))
    except Exception as e:
        pass
    canvas.paste(in_card, (x0, y0 + 28))
    draw.rectangle([x0, y0 + 28, x0 + card_w, y0 + 28 + card_h], outline=(71, 85, 105), width=1)

    # Panels 1..N: Google Drive Angles
    for i, ang in enumerate(angles):
        x = pad + (i + 1) * (card_w + pad)
        pct = ang.get("similarity_pct", 0.0)
        draw.rectangle([x, y0, x + card_w, y0 + 26], fill=(212, 175, 55) if i == 0 else (51, 65, 85))
        badge_title = f"{ang.get('label')} - {pct}%"
        draw.text((x + 8, y0 + 5), badge_title, fill=(15, 23, 42) if i == 0 else (241, 245, 249))

        ang_card = Image.new("RGB", (card_w, card_h), (10, 15, 28))
        img_p = Path(ang.get("abs_path", ""))
        if img_p.exists():
            try:
                aimg = Image.open(img_p).convert("RGB")
                aimg.thumbnail((card_w - 6, card_h - 6), resample_filter)
                ang_card.paste(aimg, ((card_w - aimg.width) // 2, (card_h - aimg.height) // 2))
            except Exception:
                pass
        canvas.paste(ang_card, (x, y0 + 28))
        draw.rectangle([x, y0 + 28, x + card_w, y0 + 28 + card_h], outline=(71, 85, 105), width=1)

    # Bottom Instructions Banner
    bot_y = total_h - footer_h + 8
    draw.rectangle([pad, bot_y, total_w - pad, bot_y + 34], fill=(30, 41, 59))
    footer_text = f"Responde 'APROBAR' en Galantesbacklog para vincular {sku}, o 'NUEVO' para crear joya artesanal."
    draw.text((pad + 14, bot_y + 9), footer_text, fill=(212, 175, 55))

    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_p, quality=92)
    return str(out_p)


def main():
    parser = argparse.ArgumentParser(description="Google Drive Multi-Angle Matcher")
    parser.add_argument("--image", required=True, help="Path to incoming intake image")
    parser.add_argument("--top-k", type=int, default=3, help="Number of top clusters to return")
    parser.add_argument("--out", default=str(EVIDENCE_DIR / "gdrive_multi_angle_match.jpg"), help="Output sheet path")
    args = parser.parse_args()

    res = search_google_drive_multi_angle(args.image, top_k=args.top_k)
    if not res.get("ok"):
        print(json.dumps(res, indent=2))
        sys.exit(1)

    best = res.get("best_cluster")
    if best:
        sheet_path = generate_multi_angle_contact_sheet(args.image, best, args.out)
        res["multi_angle_sheet_path"] = sheet_path

    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
