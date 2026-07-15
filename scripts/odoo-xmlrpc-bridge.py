#!/usr/bin/env python3
"""Minimal XML-RPC bridge for Odoo calls used by the Node publication workflow."""

from __future__ import annotations

import json
import sys
import xmlrpc.client


def _read_request() -> dict:
  raw = sys.stdin.read()
  if not raw.strip():
    raise ValueError("Missing JSON request payload.")
  return json.loads(raw)


def _execute(payload: dict):
  base_url = str(payload["baseUrl"]).rstrip("/")
  database = str(payload["database"])
  username = str(payload.get("username") or "admin")
  password = str(payload["password"])
  model = str(payload["model"])
  method = str(payload["method"])
  args = payload.get("args") or []
  kwargs = payload.get("kwargs") or {}

  common = xmlrpc.client.ServerProxy(f"{base_url}/xmlrpc/2/common", allow_none=True)
  uid = common.authenticate(database, username, password, {})
  if not uid:
    raise PermissionError("Odoo XML-RPC authentication failed.")

  models = xmlrpc.client.ServerProxy(f"{base_url}/xmlrpc/2/object", allow_none=True)
  result = models.execute_kw(database, uid, password, model, method, args, kwargs)
  return result


def main() -> int:
  try:
    payload = _read_request()
    result = _execute(payload)
    json.dump({"ok": True, "result": result}, sys.stdout, ensure_ascii=False)
    return 0
  except Exception as exc:  # pragma: no cover - bridge safety
    json.dump(
      {
        "ok": False,
        "error": str(exc),
      },
      sys.stdout,
      ensure_ascii=False,
    )
    return 1


if __name__ == "__main__":
  raise SystemExit(main())
