const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
const TOKEN_PATH = path.resolve(process.cwd(), process.env.GOOGLE_TOKEN_PATH || 'token.json');
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

function assertOAuthConfig() {
  const missing = [
    !CLIENT_ID ? 'CLIENT_ID' : '',
    !CLIENT_SECRET ? 'CLIENT_SECRET' : '',
    !REDIRECT_URI ? 'REDIRECT_URI' : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    const error = new Error(`Google OAuth configuration is missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}

function createOAuth2Client() {
  assertOAuthConfig();
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function loadToken() {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf8');
    const token = JSON.parse(content);

    if (!token.refresh_token && !token.access_token) {
      throw new Error('token.json does not contain OAuth credentials.');
    }

    return token;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const authError = new Error('Google OAuth token.json is missing. Authorize the owner account first.');
      authError.statusCode = 401;
      throw authError;
    }

    throw error;
  }
}

async function saveToken(token) {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function buildAuthUrl() {
  const client = createOAuth2Client();

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
  });
}

async function exchangeCodeAndSaveToken(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token && !tokens.access_token) {
    const error = new Error('Google OAuth did not return usable credentials.');
    error.statusCode = 502;
    throw error;
  }

  await saveToken(tokens);
  return tokens;
}

async function getAuthorizedClient() {
  const client = createOAuth2Client();
  const storedToken = await loadToken();
  client.setCredentials(storedToken);

  try {
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Google OAuth access token refresh returned an empty token.');
    }

    await saveToken({
      ...storedToken,
      ...client.credentials,
      refresh_token: client.credentials.refresh_token || storedToken.refresh_token,
    });

    return client;
  } catch (error) {
    if (error.message && error.message.includes('invalid_grant')) {
      error.statusCode = 401;
      error.publicMessage = 'Google OAuth authorization expired or was revoked. Reconnect the owner account.';
    }

    throw error;
  }
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  TOKEN_PATH,
  CALENDAR_SCOPES,
  buildAuthUrl,
  exchangeCodeAndSaveToken,
  getAuthorizedClient,
  saveToken,
};
