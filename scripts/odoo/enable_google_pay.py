#!/usr/bin/env python3
"""
Enable Stripe provider in Odoo and prepare Google Pay checkout flow.

Google Pay is not configured directly in Odoo. The usual production flow is:
1) Configure Stripe in Odoo payment providers.
2) Enable Google Pay in Stripe dashboard.
3) Odoo checkout automatically offers Google Pay via Stripe where supported.
"""

from __future__ import annotations

import os
import sys
import xmlrpc.client


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def pick_field(available: set[str], candidates: list[str]) -> str | None:
    for item in candidates:
        if item in available:
            return item
    return None


def main() -> int:
    url = required_env("ODOO_URL").rstrip("/")
    db = required_env("ODOO_DB")
    username = required_env("ODOO_USERNAME")
    password = required_env("ODOO_PASSWORD")

    stripe_public = required_env("STRIPE_PUBLISHABLE_KEY")
    stripe_secret = required_env("STRIPE_SECRET_KEY")
    stripe_webhook = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
    uid = common.authenticate(db, username, password, {})
    if not uid:
        raise RuntimeError("Odoo authentication failed")

    models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

    provider_ids = models.execute_kw(
        db,
        uid,
        password,
        "payment.provider",
        "search",
        [[("code", "=", "stripe")]],
        {"limit": 1},
    )

    if not provider_ids:
        raise RuntimeError("Stripe provider not found in Odoo. Install/enable Stripe provider first.")

    provider_id = provider_ids[0]

    fields_meta = models.execute_kw(
        db,
        uid,
        password,
        "payment.provider",
        "fields_get",
        [],
        {"attributes": ["string", "type"]},
    )
    available_fields = set(fields_meta.keys())

    public_key_field = pick_field(
        available_fields,
        ["stripe_publishable_key", "stripe_public_key", "stripe_api_key"],
    )
    secret_key_field = pick_field(
        available_fields,
        ["stripe_secret_key", "stripe_api_secret", "stripe_private_key"],
    )
    webhook_field = pick_field(
        available_fields,
        ["stripe_webhook_secret", "stripe_endpoint_secret"],
    )

    state_field = pick_field(available_fields, ["state"])

    update_values: dict[str, str] = {}
    if public_key_field:
        update_values[public_key_field] = stripe_public
    if secret_key_field:
        update_values[secret_key_field] = stripe_secret
    if webhook_field and stripe_webhook:
        update_values[webhook_field] = stripe_webhook
    if state_field:
        update_values[state_field] = "enabled"

    if not update_values:
        raise RuntimeError("No compatible Stripe fields detected in payment.provider")

    models.execute_kw(
        db,
        uid,
        password,
        "payment.provider",
        "write",
        [[provider_id], update_values],
    )

    print("Stripe provider updated in Odoo.")
    print("Next steps to finish Google Pay:")
    print("1) Stripe Dashboard > Settings > Payment methods > Google Pay: Enable")
    print("2) Stripe Dashboard > Webhooks: use your production endpoint")
    print("3) Odoo > Website > Payment Providers: verify Stripe is enabled")
    print("4) Test checkout from a supported browser/device")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
