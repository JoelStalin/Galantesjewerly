import json

REQUIRED_MANAGED_STORAGE_IDS = [
    "favicon-1776722808533-favicon-32x32.png",
    "image-1776722792843-logo.webp",
    "image-1776959050826-portada.webp",
    "image-1776960148616-chatgpt-image-apr-23-2026-11-58-48-am.webp",
    "image-1776960207167-chatgpt-image-apr-23-2026-11-58-56-am.webp",
    "image-1776960214904-chatgpt-image-apr-23-2026-11-59-05-am.webp",
]


def byte_length(value):
    if not value:
        return 0
    if isinstance(value, bytes):
        return len(value)
    return len(value.encode("utf-8"))


Attachment = env["ir.attachment"].sudo()
managed = []
for storage_id in REQUIRED_MANAGED_STORAGE_IDS:
    attachment = Attachment.search([
        ("name", "=", storage_id),
        ("res_model", "=", "galante.cms.settings"),
    ], limit=1)
    managed.append({
        "storageId": storage_id,
        "attachmentId": attachment.id or None,
        "bytes": byte_length(attachment.datas),
        "ok": bool(attachment and attachment.datas),
    })

Product = env["product.template"].sudo()
published_products = Product.search([("sale_ok", "=", True), ("available_on_website", "=", True)], order="id asc")
missing_products = published_products.filtered(lambda product: not product.image_1920)

report = {
    "ok": all(item["ok"] for item in managed) and bool(published_products) and not missing_products,
    "managed": managed,
    "productSummary": {
        "total": len(published_products),
        "withImage": len(published_products - missing_products),
        "missingImage": len(missing_products),
    },
    "missingProducts": [{"id": product.id, "name": product.name} for product in missing_products],
}

print(json.dumps(report, indent=2))
if not report["ok"]:
    raise RuntimeError("Odoo image durability verification failed")
