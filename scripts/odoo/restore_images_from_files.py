import base64
import json
import mimetypes
import os
from pathlib import Path

BRANDING_ASSETS = {
    "favicon_url": "/api/image?id=favicon-1776722808533-favicon-32x32.png",
    "logo_url": "/api/image?id=image-1776722792843-logo.webp",
    "hero_image_url": "/api/image?id=image-1776959050826-portada.webp",
}

FEATURED_IMAGES = [
    "/api/image?id=image-1776960148616-chatgpt-image-apr-23-2026-11-58-48-am.webp",
    "/api/image?id=image-1776960207167-chatgpt-image-apr-23-2026-11-58-56-am.webp",
    "/api/image?id=image-1776960214904-chatgpt-image-apr-23-2026-11-59-05-am.webp",
]


def storage_id_from_url(url):
    if "id=" not in url:
        return None
    return url.split("id=", 1)[1].split("&", 1)[0]


def image_files(blobs_dir):
    return sorted(path for path in blobs_dir.iterdir() if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})


def product_seed_files(blobs_dir):
    return [path for path in image_files(blobs_dir) if path.name.startswith("20260610_") and path.suffix.lower() in {".jpg", ".jpeg"}]


def content_type(path):
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def read_b64(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def load_cms(record):
    if not record or not record.cms_snapshot_json:
        return {"settings": {}, "sections": [], "featured_items": []}
    try:
        parsed = json.loads(record.cms_snapshot_json)
    except Exception:
        parsed = {"settings": {}, "sections": [], "featured_items": []}
    parsed.setdefault("settings", {})
    parsed.setdefault("sections", [])
    parsed.setdefault("featured_items", [])
    return parsed


blobs_dir = Path(os.environ.get("GALANTES_BLOBS_DIR", "/tmp/galantes-blobs"))
overwrite_product_images = os.environ.get("OVERWRITE_PRODUCT_IMAGES", "false").lower() == "true"

if not blobs_dir.exists():
    raise RuntimeError(f"Blob directory does not exist: {blobs_dir}")

Settings = env["galante.cms.settings"].sudo()
settings_record = Settings.search([], limit=1)
if not settings_record:
    settings_record = Settings.create({})

cms = load_cms(settings_record)
cms["settings"].update(BRANDING_ASSETS)
for section in cms.get("sections", []):
    if section.get("section_identifier") == "hero":
        section["image_url"] = BRANDING_ASSETS["hero_image_url"]
for index, item in enumerate(cms.get("featured_items", [])):
    if index < len(FEATURED_IMAGES):
        item["image_url"] = FEATURED_IMAGES[index]
settings_record.write({"cms_snapshot_json": json.dumps(cms)})

Attachment = env["ir.attachment"].sudo()
managed_results = []
required_ids = [storage_id_from_url(url) for url in list(BRANDING_ASSETS.values()) + FEATURED_IMAGES]
for storage_id in [item for item in required_ids if item]:
    source = blobs_dir / storage_id
    if not source.exists():
        managed_results.append({"storageId": storage_id, "ok": False, "reason": "missing_file"})
        continue
    values = {
        "name": storage_id,
        "datas": read_b64(source),
        "mimetype": content_type(source),
        "type": "binary",
        "public": True,
        "res_model": "galante.cms.settings",
        "res_id": settings_record.id,
    }
    attachment = Attachment.search([
        ("name", "=", storage_id),
        ("res_model", "=", "galante.cms.settings"),
    ], limit=1)
    action = "updated" if attachment else "created"
    if attachment:
        attachment.write(values)
    else:
        attachment = Attachment.create(values)
    managed_results.append({"storageId": storage_id, "ok": True, "action": action, "attachmentId": attachment.id, "bytes": source.stat().st_size})

Product = env["product.template"].sudo()
domain = [("sale_ok", "=", True), ("available_on_website", "=", True)]
if not overwrite_product_images:
    domain.append(("image_1920", "=", False))
seed_files = product_seed_files(blobs_dir)
products = Product.search(domain, order="id asc", limit=len(seed_files))
product_results = []
for product, source in zip(products, seed_files):
    product.write({"image_1920": read_b64(source)})
    product_results.append({"productId": product.id, "name": product.name, "fileName": source.name, "bytes": source.stat().st_size})

env.cr.commit()

published_products = Product.search([("sale_ok", "=", True), ("available_on_website", "=", True)], order="id asc")
missing_products = published_products.filtered(lambda product: not product.image_1920)

report = {
    "ok": all(item["ok"] for item in managed_results) and not missing_products,
    "managedImages": managed_results,
    "productImagesSet": product_results,
    "publishedProducts": len(published_products),
    "missingProductImages": [{"id": product.id, "name": product.name} for product in missing_products],
}

print(json.dumps(report, indent=2))
if not report["ok"]:
    raise RuntimeError("Image restore completed but durability validation failed")
