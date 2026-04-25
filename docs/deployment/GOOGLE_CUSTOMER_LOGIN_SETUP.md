# Google Customer Login Setup

This app already exposes the customer OAuth endpoints:

- Start: `/api/auth/google/start`
- Callback: `/auth/google/callback`

The customer login page is `/auth/login`, but the OAuth callback that Google must call is the callback route above.

## What to enable in Google Cloud

1. Open the target project in Google Cloud Console.
2. Go to `Google Auth platform -> Branding` and configure the consent screen.
3. Go to `Google Auth platform -> Audience` and add test users if the app is still in testing mode.
4. Go to `Google Auth platform -> Clients`.
5. Create or edit an OAuth client of type `Web application`.

## Required client configuration

Authorized JavaScript origins:

- `https://galantesjewelry.com`
- `http://localhost:3000`

Authorized redirect URIs:

- `https://galantesjewelry.com/auth/google/callback`
- `http://localhost:3000/auth/google/callback`

If you use another production hostname, add that exact origin and callback path too. Google requires an exact match for redirect URIs.

## Minimum scopes for customer login

The storefront customer login only needs:

- `openid`
- `email`
- `profile`

## Environment variables

Set these in the app runtime:

```env
GOOGLE_OAUTH_CLIENT_ID=your_web_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_web_client_secret
GOOGLE_OAUTH_REDIRECT_URI=https://galantesjewelry.com/auth/google/callback
GOOGLE_OAUTH_JAVASCRIPT_ORIGIN=https://galantesjewelry.com
GOOGLE_OAUTH_SCOPES=openid email profile
```

Notes:

- `GOOGLE_OAUTH_REDIRECT_URI` must match one of the authorized redirect URIs exactly.
- `GOOGLE_OAUTH_JAVASCRIPT_ORIGIN` should be the public site origin only, without path.
- If the redirect URI env var is omitted, the app now falls back to the current request host and `/auth/google/callback`.

## Expected behavior

- The single Google button on `/auth/login` works for both first-time registration and returning sign-in.
- On first successful Google authentication, the app creates a customer session immediately.
- On future logins, the same button restores the session and returns the customer to `returnTo`.
