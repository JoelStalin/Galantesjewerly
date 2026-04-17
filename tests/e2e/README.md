# Selenium E2E

## Purpose

This suite validates the admin login, persistent session behavior, image upload lifecycle, protected routes, and public rendering using a persistent cloned Chrome profile.

## Commands

```bash
python tests/e2e/profile_manager.py --profile Default
python tests/e2e/admin_image_session_flow.py
python tests/e2e/admin_google_oauth_smoke.py
python tests/e2e/public_smoke.py
npm run e2e:appointments
npm run e2e:appointments:production
```

## Production Appointment Calendar/Gmail Flow

`npm run e2e:appointments:production` is a guarded real-production test. It first checks `/api/health`,
masked admin integration settings, Calendar connectivity, Gmail SMTP connectivity, and IMAP access to the recipient.
It only creates a real appointment when all required credentials exist and `E2E_PRODUCTION_REAL_SEND=1` is set.

Required local environment for the real run:

```bash
set E2E_PRODUCTION_REAL_SEND=1
set GMAIL_RECEIPT_USER=ceo@galantesjewelry.com
set GMAIL_RECEIPT_IMAP_APP_PASSWORD=<google-workspace-app-password>
npm run e2e:appointments:production
```

Use Gmail/Google Workspace App Passwords or OAuth credentials only. Do not use or store the normal mailbox password.
The recipient App Password stays local and is never saved in the repo or admin panel.

## URLs Tested

- `/`
- `/admin/login`
- `/admin/dashboard`
- `/api/admin/auth`
- `/api/admin/auth/logout`
- `/api/admin/content`
- `/api/admin/session`
- `/api/admin/upload`
- `/contact`
- `/api/contact`
- `/api/admin/integrations`
- `/api/admin/integrations/test`
- `/api/admin/google/oauth/start`
- `/api/contact/availability`

## Primary Selectors

- `login-username`
- `login-password`
- `login-submit`
- `logout-button`
- `tab-featured`
- `add-featured-button`
- `featured-card-{id}`
- `featured-title-{id}`
- `featured-content-{id}`
- `featured-image-input-{id}`
- `featured-image-preview-{id}`
- `featured-action-text-{id}`
- `featured-action-link-{id}`
- `save-featured-{id}`
- `delete-featured-{id}`
- `admin-notice`
- `featured-dot-{index}`
- `featured-public-card-{id}`
- `featured-public-image-{id}`
- `contact-name`
- `contact-email`
- `contact-phone`
- `contact-inquiry-type`
- `contact-appointment-date`
- `contact-appointment-time`
- `contact-message`
- `contact-submit`
- `contact-success`

## Artifacts

Each execution writes to `tests/e2e/artifacts/YYYY-MM-DD_HH-mm-ss/` and includes:

- `report.md`
- `result.json`
- `errors.log` when the run fails or cleanup reports an error
- `browser-console.log` when browser console output is available
- step screenshots
- generated PNG upload fixtures used during the run

## Profile Strategy

- Host source profile: `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\<profile>`
- Test runtime clone: `tests/e2e/.runtime/chrome-user-data/<profile>`
- The suite never points Selenium at the live host profile directory directly.
- If Chrome keeps the source profile locked and no runtime clone exists yet, the scripts stop with a friendly message asking for Chrome to be closed manually.
