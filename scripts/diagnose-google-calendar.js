#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Diagnose Google Calendar integration config.
 *
 * Usage:  node scripts/diagnose-google-calendar.js
 *
 * Validates env vars, token.json presence, and tries an unauthenticated
 * reachability check against Google OAuth discovery. Does NOT call Google
 * with secrets — safe to run anytime.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let errorCount = 0;
let warnCount = 0;

function pass(label) {
  console.log(`  ${GREEN}✓${RESET} ${label}`);
}

function fail(label, hint) {
  errorCount += 1;
  console.log(`  ${RED}✗${RESET} ${label}`);
  if (hint) console.log(`      ${YELLOW}→ ${hint}${RESET}`);
}

function warn(label, hint) {
  warnCount += 1;
  console.log(`  ${YELLOW}!${RESET} ${label}`);
  if (hint) console.log(`      ${YELLOW}→ ${hint}${RESET}`);
}

function section(title) {
  console.log(`\n${BLUE}── ${title} ──${RESET}`);
}

function isPlaceholder(value) {
  if (!value) return true;
  return /REPLACE_ME|CHANGE_ME|your_|placeholder|GOOGLE_CLIENT_ID|GOOGLE_SECRET/i.test(value);
}

function requireEnv(name, { aliases = [], hint = '' } = {}) {
  const candidates = [name, ...aliases];
  for (const key of candidates) {
    const value = process.env[key];
    if (value && !isPlaceholder(value)) {
      pass(`${name} set ${aliases.length ? `(via ${key})` : ''}`);
      return value;
    }
  }
  fail(`${name} missing or still a placeholder`, hint);
  return null;
}

function optionalEnv(name, { hint = '' } = {}) {
  const value = process.env[name];
  if (!value || isPlaceholder(value)) {
    warn(`${name} not set (optional)`, hint);
    return null;
  }
  pass(`${name} set`);
  return value;
}

console.log(`\n${BLUE}Galante's Jewelry — Google Calendar diagnostic${RESET}`);
console.log(`Date: ${new Date().toISOString()}`);

section('1. OAuth client credentials');
const clientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID', {
  aliases: ['CLIENT_ID'],
  hint: 'Get it from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs',
});
const clientSecret = requireEnv('GOOGLE_OAUTH_CLIENT_SECRET', {
  aliases: ['CLIENT_SECRET'],
  hint: 'Same screen as the Client ID.',
});
if (clientId && !/\.apps\.googleusercontent\.com$/.test(clientId)) {
  warn('Client ID does not end in .apps.googleusercontent.com — double-check you copied the right value.');
}

section('2. Redirect URIs & scopes');
const redirectUri = requireEnv('GOOGLE_OAUTH_REDIRECT_URI', {
  aliases: ['REDIRECT_URI'],
  hint: 'Must match EXACTLY what you registered in Cloud Console.',
});
const scopes = process.env.GOOGLE_OAUTH_SCOPES || '';
if (!scopes.includes('auth/calendar')) {
  fail('GOOGLE_OAUTH_SCOPES missing calendar scope', 'Add https://www.googleapis.com/auth/calendar');
} else {
  pass('GOOGLE_OAUTH_SCOPES includes calendar');
}
if (!scopes.includes('gmail.send')) {
  warn('GOOGLE_OAUTH_SCOPES missing gmail.send (only needed if you want email notifications via Gmail API).');
}

section('3. Calendar target');
const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
pass(`GOOGLE_CALENDAR_ID = "${calendarId}"`);

section('4. Service account (optional alternative)');
const sa = optionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', {
  hint: 'Only if you plan to use a service account instead of the owner OAuth flow.',
});
const pk = optionalEnv('GOOGLE_PRIVATE_KEY');
if (sa && !pk) fail('GOOGLE_SERVICE_ACCOUNT_EMAIL set but GOOGLE_PRIVATE_KEY missing');
if (pk && !sa) fail('GOOGLE_PRIVATE_KEY set but GOOGLE_SERVICE_ACCOUNT_EMAIL missing');

section('5. Refresh token (admin OAuth flow)');
const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
if (!refresh) {
  warn(
    'GOOGLE_OAUTH_REFRESH_TOKEN not set in .env',
    'OK if you will connect the owner account via the admin panel — the token gets stored encrypted in the DB. Only needed in .env for quick local tests.',
  );
} else {
  pass('GOOGLE_OAUTH_REFRESH_TOKEN present');
}

section('6. Express-path token.json (legacy appointment flow)');
const tokenPath = path.resolve(process.cwd(), process.env.GOOGLE_TOKEN_PATH || process.env.TOKEN_PATH || 'token.json');
if (!fs.existsSync(tokenPath)) {
  warn(
    `token.json not found at ${tokenPath}`,
    'Only needed if you use services/calendarService.js (Express). The Next.js /api/v1/appointments route uses the encrypted DB instead.',
  );
} else {
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    if (token.refresh_token) {
      pass('token.json has refresh_token');
    } else {
      fail('token.json exists but has no refresh_token', 'Re-run the OAuth consent flow with prompt=consent&access_type=offline');
    }
  } catch (err) {
    fail(`token.json is not valid JSON: ${err.message}`);
  }
}

section('7. Secrets for encrypted integration storage');
requireEnv('INTEGRATIONS_SECRET_KEY', { hint: 'openssl rand -base64 32' });
requireEnv('APPOINTMENT_ENCRYPTION_KEY', { hint: 'openssl rand -base64 32' });

section('8. Email fallbacks');
optionalEnv('SENDGRID_API_KEY');
optionalEnv('GMAIL_SMTP_PASS', { hint: 'App Password (16 chars, no spaces) from myaccount.google.com/apppasswords' });

section('9. Reachability check — Google OAuth discovery');
(async () => {
  try {
    const res = await fetch('https://accounts.google.com/.well-known/openid-configuration', { cache: 'no-store' });
    if (res.ok) {
      pass(`Google OAuth discovery reachable (HTTP ${res.status})`);
    } else {
      fail(`Google OAuth discovery returned HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`Cannot reach accounts.google.com: ${err.message}`, 'Check internet / firewall / proxy.');
  }

  console.log(`\n${BLUE}──────────────────────────────────${RESET}`);
  if (errorCount === 0 && warnCount === 0) {
    console.log(`${GREEN}✅ All required config present. Safe to connect the owner account in the admin panel.${RESET}\n`);
    process.exit(0);
  } else if (errorCount === 0) {
    console.log(`${YELLOW}⚠  ${warnCount} warning(s). Config is usable but incomplete. Review above.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}❌ ${errorCount} error(s), ${warnCount} warning(s). Fix the errors above before continuing.${RESET}`);
    console.log(`See FIX_GOOGLE_CALENDAR.md for step-by-step instructions.\n`);
    process.exit(1);
  }
})();
