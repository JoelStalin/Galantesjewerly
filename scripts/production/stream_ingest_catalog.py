import json
import io
import base64
import time
import requests
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent.parent
dry_run_path = root / "data" / "inventory-agent" / "manifests" / "odoo-dry-run.json"

if not dry_run_path.exists():
    print(f"Missing {dry_run_path}")
    exit(1)

with open(dry_run_path, "r", encoding="utf-8") as f:
    dry_run = json.load(f)

payloads = dry_run.get("payloads", [])
print(f"Starting real-time 1-by-1 HTTP streaming ingestion of {len(payloads)} products...")

category_titles = {
    "necklaces": "Collar Fino Galantes",
    "necklace": "Collar Fino Galantes",
    "chains": "Cadena de Oro Galantes",
    "chain": "Cadena de Oro Galantes",
    "rings": "Anillo Elegante Galantes",
    "ring": "Anillo Elegante Galantes",
    "earrings": "Aretes Elegantes Galantes",
    "earring": "Aretes Elegantes Galantes",
    "bracelets": "Pulsera Fina Galantes",
    "bracelet": "Pulsera Fina Galantes",
    "pendants": "Dije Elegante Galantes",
    "pendant": "Dije Elegante Galantes",
    "jewelry": "Joya Fina Galantes",
}

def compress_image_to_b64(file_path: Path) -> str | None:
    if not file_path.exists():
        return None
    try:
        with Image.open(file_path) as img:
            img.thumbnail((1920, 1920))
            if img.mode != "RGB":
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as exc:
        print(f"Warning: Image compression failed for {file_path}: {exc}")
        return None

url = "https://odoo.galantesjewelry.com/api/products/ingest"
success_count = 0
fail_count = 0

start_time = time.time()

for idx, item in enumerate(payloads, 1):
    cluster_id = item.get("clusterId", f"item-{idx}")
    sku = item.get("vals", {}).get("default_code") or f"GAL-{cluster_id}"
    cat_key = (item.get("categoryLabel") or "jewelry").lower().strip()
    title = category_titles.get(cat_key, "Joya Fina Galantes")
    
    primary_b64 = None
    primary_path = item.get("primaryImagePath")
    if primary_path:
        primary_b64 = compress_image_to_b64(root / primary_path)
    
    gallery_b64_list = []
    for gpath in item.get("galleryImagePaths", []):
        gb64 = compress_image_to_b64(root / gpath)
        if gb64:
            gallery_b64_list.append(gb64)
    
    product_data = {
        "sku": sku,
        "name": title,
        "price": item.get("vals", {}).get("list_price", 1500),
        "cost": item.get("vals", {}).get("standard_price", 750),
        "type": "consu",  # Mandatory consumable product, NEVER a service
        "available_on_website": True,
        "is_published": True,
        "primaryImageBase64": primary_b64,
        "galleryImagesBase64": gallery_b64_list,
    }
    
    try:
        resp = requests.post(url, json={"products": [product_data]}, timeout=30)
        if resp.status_code == 200 and resp.json().get("success"):
            success_count += 1
            b64_len = len(primary_b64) / 1024 if primary_b64 else 0
            if idx % 10 == 0 or idx == len(payloads):
                elapsed = time.time() - start_time
                rate = idx / elapsed if elapsed > 0 else 0
                print(f"[{idx}/{len(payloads)}] Synced {sku} ({title}) [{b64_len:.1f} KB] -> HTTP 200 OK | Speed: {rate:.1f} items/sec")
        else:
            fail_count += 1
            print(f"[{idx}/{len(payloads)}] FAILED {sku}: HTTP {resp.status_code} - {resp.text[:100]}")
    except Exception as err:
        fail_count += 1
        print(f"[{idx}/{len(payloads)}] ERROR {sku}: {err}")

elapsed = time.time() - start_time
print(f"\n==========================================")
print(f"Streaming Ingestion Completed in {elapsed:.1f}s")
print(f"Success: {success_count} / {len(payloads)}")
print(f"Failed:  {fail_count}")
print(f"==========================================")
