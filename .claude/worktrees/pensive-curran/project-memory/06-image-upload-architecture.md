# Image Upload Architecture

## Scope

This document describes the final image flow used by the admin panel, public site, standalone runtime, and Docker runtime.

## Final Flow

1. Admin UI selects a file through `components/admin/ImageUploader.tsx`.
2. The component creates a local browser preview for immediate feedback.
3. The component sends `FormData` to `POST /api/admin/upload`.
4. `app/api/admin/upload/route.ts` verifies the admin session and parses `request.formData()`.
5. `lib/storage.ts` validates:
   - max size 5 MB
   - MIME type in `image/jpeg`, `image/png`, `image/webp`, `image/jpg`
   - extension in `.jpg`, `.jpeg`, `.png`, `.webp`
6. `sharp` normalizes the file:
   - standard images -> resized inside 1200x1200 and exported as WebP
   - favicons -> resized to 32x32 and exported as PNG
7. The processed file is written to `APP_DATA_DIR/blobs`.
8. The upload endpoint returns a managed URL: `/api/image?id=<storageId>`.
9. Admin content saves that URL into `data/cms.json`.
10. Public and admin UIs render the stored URL.
11. `GET /api/image` streams the file back with immutable cache headers.

## Storage Layout

- Metadata and references: `data/cms.json`
- Binary files: `data/blobs/<storageId>`
- Runtime data root:
  - local standalone -> repo `data/`
  - Docker -> `/app/data`
  - Termux standalone -> exported `APP_DATA_DIR`

## Replace and Delete Behavior

- When an existing image reference is replaced, `lib/db.ts` collects removed managed URLs and calls `deleteManagedImage`.
- When a featured item is deleted, its managed image is also removed if no other record still references it.
- Public image URLs remain stable only for the lifetime of the referenced blob.

## Why This Design Was Chosen

- The repository already used a file-backed CMS.
- The current scope did not require a database or external object storage.
- Docker volume binding and `APP_DATA_DIR` make local persistence reproducible.
- The architecture remains portable to Termux standalone mode.

## Operational Limits

- This is single-node local filesystem storage.
- It assumes shared access to one writable volume.
- It does not deduplicate identical binary payloads.
- It does not yet version images or keep historical revisions.

## Migration Path if Storage Grows

- Keep `data/cms.json` references but move blob storage behind an adapter.
- Replace the file writer in `lib/storage.ts` with an object-storage implementation.
- Preserve the managed URL contract or migrate records in place.

## Evidence

- Successful first upload: `tests/e2e/artifacts/2026-03-25_20-08-59/06_after_first_save.png`
- Successful replacement: `tests/e2e/artifacts/2026-03-25_20-08-59/10_after_image_replace.png`
- Public render after replacement: `tests/e2e/artifacts/2026-03-25_20-08-59/11_public_render_after_replace.png`

## Sources

- 2026-03-25: Next.js Route Handlers support standard request body APIs and `request.formData()`
- 2026-03-25: Next.js Image component extends `<img>` for optimized rendering, but the admin preview intentionally keeps a plain `<img>` because it must render blob URLs immediately
