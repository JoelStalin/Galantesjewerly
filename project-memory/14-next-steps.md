# Next Steps

## Immediate Next Step if Work Continues

- keep using the current Docker + Nginx + persistent `data/` model as the baseline deployment contract

## Priority Backlog

1. add credential hashing and rate limiting to the admin login path
2. add automated backup and restore scripts for `data/cms.json` and `data/blobs`
3. add a storage abstraction if multi-host or CDN-backed image delivery becomes necessary
4. convert remaining public-site anchor tags to `next/link` where appropriate
5. decide the long-term production host for the Android-operated deployment model
