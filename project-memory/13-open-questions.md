# Open Questions

## Non-blocking Security Questions

- Should admin credentials move from plain env comparison to hashed storage with rate limiting?
- Should session revocation be added beyond cookie expiry and secret rotation?

## Non-blocking Storage Questions

- At what data volume should managed images move from local filesystem storage to object storage?
- Is scheduled backup of `data/cms.json` and `data/blobs` required for production?

## Operational Questions

- Which remote Linux host is the long-term Docker target for the Android-operated deployment model?
- Will Cloudflare Tunnel remain mandatory in every production deployment, or only in the Android/Termux edge scenario?

## UI and Code Hygiene Questions

- Should the admin preview migrate from plain `<img>` to a different preview strategy to eliminate the remaining lint warning?
- Should the homepage links in `app/page.tsx` and `components/FeaturedCarousel.tsx` be converted fully to `next/link` for consistency?
