# Current Blockers

## No active technical blockers

- The Android/Termux production host was updated, rebuilt, restarted, and revalidated.
- Public OAuth now redirects to:
  - `https://galantesjewelry.com/auth/google/callback`
- Admin owner OAuth now redirects to:
  - `https://admin.galantesjewelry.com/api/admin/google/oauth/callback`

## Remaining manual step

- If the owner Google account needs to be reconnected, a human still has to complete the Google consent screen in the browser so the refresh token is stored again.
