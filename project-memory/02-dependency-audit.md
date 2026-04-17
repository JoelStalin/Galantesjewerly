# Dependency Audit

## Essential and Correctly Used

- `next@16.2.1`
  - App Router is the correct framework base.
  - `output: "standalone"` is aligned with Docker and Termux packaging.
- `react@19.2.4` and `react-dom@19.2.4`
  - correct runtime pair for the current Next version
- `sharp@0.34.5`
  - correct for server-side image normalization, format conversion, and deterministic output size
- `jose@6.2.2`
  - correct for stateless signed admin sessions in the current Next runtime
- `tailwindcss@^4` and `@tailwindcss/postcss@^4`
  - correctly installed and actively used in the storefront and admin UI
- TypeScript and Next ESLint packages
  - active and validated through `npm run lint` and `npm run build`

## Essential but Previously Misused

- `next`
  - standalone output was configured, but the local production start path did not sync `public` and `.next/static` into `.next/standalone`
  - runtime writes were not pinned to the repo `data` directory, so standalone could drift into `.next/standalone/data`
- `jose`
  - token signing was already viable, but cookie option handling needed request-aware `secure` logic to avoid breaking local HTTP verification flows
- `sharp`
  - upload processing existed as a direction, but validation and invalid-image error handling were incomplete until `lib/storage.ts` was hardened

## Absent but Added

- `.dockerignore`
  - added to keep Docker context deterministic and smaller
- `tests/e2e/requirements.txt`
  - added to pin Selenium for reproducible Python setup
- `app/api/health/route.ts`
  - added for Docker and reverse-proxy health checks
- `lib/runtime-paths.ts`
  - added to normalize the writable data root across runtimes
- `scripts/start-standalone.mjs`
  - added to make the standalone runtime repo-aware

## Present but Unnecessary or Secondary

- `scripts/functional_test.py`
  - legacy diagnostic script, not the authoritative E2E runner
- `selenium_test.py`
  - ad hoc operator check, not the canonical evidence suite
- archived bundles in repo root
  - operational artifacts, not runtime dependencies

## Candidates Explicitly Rejected

- NextAuth or heavier auth frameworks
  - rejected because the project has a single-admin credential model and no database-backed user domain
- object storage SDKs
  - rejected for this intervention because local filesystem storage already satisfies the current scope when combined with Docker volumes and `APP_DATA_DIR`
- `webdriver-manager`
  - rejected because Selenium Manager handled the Chrome driver successfully in the validated runs

## Risk Notes

- `components/admin/ImageUploader.tsx` still uses a plain `<img>` preview because the preview can be a blob URL and a managed route URL. This leaves one lint warning from `@next/next/no-img-element`, but it does not block build or runtime behavior.
- `ADMIN_PASSWORD` is still env-driven plain credential comparison. This is acceptable for the current single-admin scope but remains a security simplification, not an enterprise auth design.
