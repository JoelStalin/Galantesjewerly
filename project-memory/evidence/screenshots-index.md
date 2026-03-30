# Screenshots Index

## Successful Run: `tests/e2e/artifacts/2026-03-25_20-08-59/`

- `01_dashboard_authenticated.png`
  - proves successful login and authenticated dashboard access
- `02_session_after_refresh.png`
  - proves session persisted after page refresh
- `03_session_after_browser_restart.png`
  - proves session persisted after closing and reopening Chrome with the same test profile
- `04_featured_record_created.png`
  - proves temporary featured record creation
- `05_first_upload_preview.png`
  - proves file selection and local preview
- `06_after_first_save.png`
  - proves first managed image save
- `07_saved_image_after_reload.png`
  - proves managed image persisted after dashboard reload
- `08_public_render_initial.png`
  - proves public homepage rendered the saved managed image
- `09_record_updated_before_replace.png`
  - proves edit state before replacement save
- `10_after_image_replace.png`
  - proves replacement image save succeeded
- `11_public_render_after_replace.png`
  - proves public homepage switched to the replacement image
- `12_cleanup_created_record.png`
  - proves temporary record cleanup
- `13_logout_confirmed.png`
  - proves manual logout
- `14_access_denied_after_logout.png`
  - proves protected access was denied after logout

## Failure Evidence Retained

- `tests/e2e/artifacts/2026-03-25_19-57-23/99_failure.png`
  - early browser instability during login verification
- `tests/e2e/artifacts/2026-03-25_19-59-46/99_failure.png`
  - public-render timeout before featured-item ordering was forced for the temporary test item
- `tests/e2e/artifacts/2026-03-25_20-04-09/99_failure.png`
  - repeated public-render timeout confirming the same root cause
