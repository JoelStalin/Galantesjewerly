#!/usr/bin/env python3
"""
generate_labeled_comparison.py
Creates a multi-panel visual comparison collage between an incoming WhatsApp photo
and proposed catalog candidates from Odoo, clearly labeled with badges, similarity
percentages, and SKUs so the human operator can make an instant, unambiguous decision.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def create_blank_card(width: int, height: int, bg_color=(24, 24, 27)) -> Image.Image:
    return Image.new("RGB", (width, height), bg_color)


def fit_image(img_path: str, target_size: int = 400) -> Image.Image:
    try:
        p = Path(img_path)
        if not p.exists():
            card = Image.new("RGB", (target_size, target_size), (40, 40, 45))
            draw = ImageDraw.Draw(card)
            draw.text((target_size // 4, target_size // 2), "Image Not Found", fill=(200, 200, 200))
            return card

        img = Image.open(p).convert("RGB")
        # Aspect fit into square target_size x target_size
        img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
        
        card = Image.new("RGB", (target_size, target_size), (18, 18, 20))
        offset_x = (target_size - img.width) // 2
        offset_y = (target_size - img.height) // 2
        card.paste(img, (offset_x, offset_y))
        return card
    except Exception as e:
        card = Image.new("RGB", (target_size, target_size), (40, 40, 45))
        draw = ImageDraw.Draw(card)
        draw.text((target_size // 4, target_size // 2), f"Error: {e}", fill=(255, 100, 100))
        return card


def draw_header_badge(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, width: int, is_original: bool = False):
    badge_height = 36
    bg_color = (197, 160, 89) if is_original else (45, 55, 72)  # Gold for original, Slate for candidate
    text_color = (10, 10, 10) if is_original else (240, 240, 240)
    
    draw.rectangle([x, y, x + width, y + badge_height], fill=bg_color)
    
    # Text
    draw.text((x + 12, y + 8), text, fill=text_color)


def generate_comparison_montage(
    original_path: str,
    candidates: list[dict],
    output_path: str,
    panel_size: int = 400,
    padding: int = 20,
) -> str:
    # Limit to top 2-3 candidates
    candidates = candidates[:3]
    total_panels = 1 + len(candidates)
    
    # We arrange horizontally if <= 3 panels, or 2x2 grid if 4
    if total_panels <= 3:
        cols = total_panels
        rows = 1
    else:
        cols = 2
        rows = 2

    canvas_width = cols * panel_size + (cols + 1) * padding
    canvas_height = rows * (panel_size + 45) + (rows + 1) * padding + 70  # +70 for footer banner
    
    canvas = Image.new("RGB", (canvas_width, canvas_height), (15, 17, 23))
    draw = ImageDraw.Draw(canvas)
    
    # 1. Render Original Panel
    orig_img = fit_image(original_path, panel_size)
    x0 = padding
    y0 = padding
    draw_header_badge(draw, "[ ORIGINAL ] WhatsApp Intake", x0, y0, panel_size, is_original=True)
    canvas.paste(orig_img, (x0, y0 + 38))
    # Border
    draw.rectangle([x0, y0 + 38, x0 + panel_size, y0 + 38 + panel_size], outline=(197, 160, 89), width=2)
    
    # 2. Render Candidates Panels
    for idx, cand in enumerate(candidates):
        c_idx = idx + 1
        if rows == 1:
            cx = padding + c_idx * (panel_size + padding)
            cy = padding
        else:
            col_pos = c_idx % 2
            row_pos = c_idx // 2
            cx = padding + col_pos * (panel_size + padding)
            cy = padding + row_pos * (panel_size + 45 + padding)
            
        sku = cand.get("sku") or cand.get("id") or f"Item {c_idx}"
        sim = cand.get("similarity", 0.0)
        sim_pct = f"{sim * 100:.1f}%" if sim <= 1.0 else f"{sim:.1f}%"
        badge_title = f"[ OPTION {c_idx} ] SKU: {sku} ({sim_pct} Match)"
        
        cand_img_path = cand.get("path") or ""
        cand_img = fit_image(cand_img_path, panel_size)
        
        draw_header_badge(draw, badge_title, cx, cy, panel_size, is_original=False)
        canvas.paste(cand_img, (cx, cy + 38))
        draw.rectangle([cx, cy + 38, cx + panel_size, cy + 38 + panel_size], outline=(70, 80, 95), width=2)
        
    # 3. Footer Prompt Banner
    footer_y = canvas_height - 60
    draw.rectangle([padding, footer_y, canvas_width - padding, footer_y + 44], fill=(28, 32, 40))
    prompt_msg = "Galante's Inventory Assistant • Reply '1', '2' or 'NO' to send to Backlog"
    draw.text((padding + 20, footer_y + 14), prompt_msg, fill=(210, 215, 225))
    
    # Save output
    out_dir = Path(output_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, quality=92)
    return str(output_path)


def main():
    parser = argparse.ArgumentParser(description="Generate labeled image comparison collage for WhatsApp review")
    parser.add_argument("--original", required=True, help="Path to original WhatsApp image")
    parser.add_argument("--candidates", required=True, help="JSON file path or raw JSON string of candidates")
    parser.add_argument("--output", required=True, help="Output image file path")
    args = parser.parse_args()

    candidates_input = args.candidates.strip()
    if os.path.exists(candidates_input):
        with open(candidates_input, "r", encoding="utf-8") as f:
            candidates = json.load(f)
    else:
        candidates = json.loads(candidates_input)

    out_file = generate_comparison_montage(args.original, candidates, args.output)
    print(json.dumps({"ok": True, "output": out_file}))


if __name__ == "__main__":
    main()
