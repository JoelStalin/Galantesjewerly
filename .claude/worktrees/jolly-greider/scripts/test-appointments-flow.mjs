import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const nextCli = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const modes = [
  { mode: 'success', expectedStatus: 200, expectedRecordStatus: 'email_sent' },
  { mode: 'conflict', expectedStatus: 409, expectedRecordStatus: 'calendar_conflict' },
  { mode: 'calendar_error', expectedStatus: 500, expectedRecordStatus: 'calendar_failed' },
  { mode: 'mail_error', expectedStatus: 502, expectedRecordStatus: 'email_failed' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(500);
  }

  throw new Error(`Server did not become healthy at ${baseUrl}`);
}

async function requestJson(url, method, payload, cookie = '') {
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function postJson(url, payload, cookie = '') {
  return requestJson(url, 'POST', payload, cookie);
}

function futureDate() {
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function readLatestRecord(dataDir) {
  const fileContent = await readFile(path.join(dataDir, 'appointments.json'), 'utf-8');
  const store = JSON.parse(fileContent);
  return store.records[0];
}

async function runCase(testCase, index) {
  const port = 3200 + index;
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = await mkdtemp(path.join(tmpdir(), `galantes-appointments-${testCase.mode}-`));
  const child = spawn(process.execPath, [nextCli, 'start', '-p', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_DATA_DIR: dataDir,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'testpass',
      ADMIN_SECRET_KEY: 'test_admin_secret_key_32_chars_min',
      APPOINTMENT_ENCRYPTION_KEY: 'test_appointment_secret_key_32_chars',
      APPOINTMENT_TEST_MODE: testCase.mode,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForHealth(baseUrl);

    const loginResponse = await postJson(`${baseUrl}/api/admin/auth`, {
      username: 'admin',
      password: 'testpass',
    });
    assert.equal(loginResponse.status, 200, `${testCase.mode}: admin login failed`);
    const cookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.includes('admin_token='), `${testCase.mode}: admin cookie missing`);

    const privateKey = 'fake-private-key-for-test';
    const smtpPassword = 'fake-gmail-app-password';
    const saveResponse = await requestJson(`${baseUrl}/api/admin/integrations`, 'PUT', {
      provider: 'appointments',
      environment: 'development',
      googleCalendarEnabled: true,
      googleCalendarId: 'mock-calendar',
      googleServiceAccountEmail: 'mock-calendar@galantes.iam.gserviceaccount.com',
      gmailNotificationsEnabled: true,
      gmailRecipientInbox: 'ceo@galantesjewelry.com',
      gmailSender: 'joelstalin2105@gmail.com',
      appointmentDurationMinutes: 60,
      appointmentTimezone: 'America/New_York',
      secrets: {
        googlePrivateKey: privateKey,
        gmailSmtpPassword: smtpPassword,
      },
      clearSecrets: [],
    }, cookie);
    assert.equal(saveResponse.status, 200, `${testCase.mode}: appointment settings save failed`);

    const adminReadResponse = await fetch(`${baseUrl}/api/admin/integrations`, {
      headers: { Cookie: cookie },
    });
    const adminText = await adminReadResponse.text();
    assert.equal(adminReadResponse.status, 200, `${testCase.mode}: admin settings read failed`);
    assert.equal(adminText.includes(privateKey), false, `${testCase.mode}: private key leaked in admin JSON`);
    assert.equal(adminText.includes(smtpPassword), false, `${testCase.mode}: SMTP password leaked in admin JSON`);

    const contactResponse = await postJson(`${baseUrl}/api/contact`, {
      name: 'Automation Client',
      email: 'client@example.com',
      phone: '+13055550199',
      inquiryType: 'Bridal & Engagement',
      message: 'I would like to schedule a private consultation.',
      appointmentDate: futureDate(),
      appointmentTime: '10:00',
      honeypot: '',
    });
    assert.equal(contactResponse.status, testCase.expectedStatus, `${testCase.mode}: unexpected contact status`);

    const latestRecord = await readLatestRecord(dataDir);
    assert.equal(latestRecord.status, testCase.expectedRecordStatus, `${testCase.mode}: unexpected record status`);
  } finally {
    child.kill();
    await sleep(500);
    await rm(dataDir, { recursive: true, force: true });
  }
}

for (const [index, testCase] of modes.entries()) {
  await runCase(testCase, index);
  console.log(`appointment flow ${testCase.mode}: pass`);
}
