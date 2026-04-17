# Selenium Strategy

## Objective

Provide a reproducible, evidence-backed E2E suite that validates:

- admin login
- protected route access
- session persistence across refresh
- session persistence across browser restart with the same test profile
- image upload
- save and reload
- image replacement
- logout and access denial

## Canonical Commands

```bash
python tests/e2e/profile_manager.py --profile Default
python tests/e2e/public_smoke.py
python tests/e2e/admin_image_session_flow.py
```

## Runtime Rules Applied

- use a persistent cloned Chrome profile
- do not point Selenium at the live host profile directory directly
- include friendly handling when the source profile is locked by an open Chrome session
- use explicit waits, not mixed implicit and explicit waits
- capture screenshots for critical transitions
- write a report and machine-readable result file per run

## Artifact Contract

Every run writes to:

`tests/e2e/artifacts/YYYY-MM-DD_HH-mm-ss/`

Artifacts include:

- `report.md`
- `result.json`
- step screenshots
- generated test images
- `browser-console.log` when available
- `errors.log` on failures or cleanup errors

## Validated Run

- Successful canonical run: `tests/e2e/artifacts/2026-03-25_20-08-59/`
- Result: `pass`
- Created temporary record: `f_1774483764214`
- First managed image: `/api/image?id=image-1774483767970-first-upload.webp`
- Second managed image: `/api/image?id=image-1774483781252-second-upload.webp`

## Why Earlier Failed Runs Were Kept

Artifact directories `2026-03-25_19-57-23`, `2026-03-25_19-59-46`, and `2026-03-25_20-04-09` remain as debugging evidence. They show the progression from failing public render checks to the final stable run.

## Sources

- 2026-03-25: Selenium Chrome documentation shows `ChromeOptions` argument usage and experimental options
- 2026-03-25: Selenium wait documentation states that explicit waits poll for a specific condition and warns not to mix implicit and explicit waits
- local mandatory rules: `context/operations/testing_selenium_rules.md`
