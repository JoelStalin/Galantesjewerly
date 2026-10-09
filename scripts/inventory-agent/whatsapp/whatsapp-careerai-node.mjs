/**
 * whatsapp-careerai-node.mjs
 * Port and enhancement of the CareerAI WhatsApp Web automation engine for Galantes Jewelry.
 * Integrates:
 *   - Headed off-screen anti-bot trick (--window-position=-32000,-32000)
 *   - Persistent browser context for session retention
 *   - Dedicated inbound listener for whitelisted number +1 786-246-2664
 *   - Direct message and image dispatcher with human-like typing jitter
 *   - Multi-recipient routing (Target Sender & 'galantesbacklog' group)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..', '..');

const CHROME_ARGS = [
  '--start-maximized',
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox'
];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const OFFSCREEN_ARGS = ['--window-position=-32000,-32000'];

const randomJitterMs = (min = 600, max = 1800) => Math.floor(min + Math.random() * (max - min));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveProfileDir(override) {
  if (override) return path.resolve(override);
  if (process.env.WHATSAPP_WEB_PROFILE_DIR) return path.resolve(process.env.WHATSAPP_WEB_PROFILE_DIR);
  return path.resolve(root, 'data', 'inventory-agent', 'whatsapp-session');
}

/**
 * Launch the persistent Chromium browser using CareerAI's validated architecture.
 */
export async function launchWhatsAppBrowser({ profileDir, headless = false, offscreen = true, forceVisible = false } = {}) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    const fallbackPath = 'C:/Users/yoeli/Documents/GetUpSoft_Workspace/platform/orca/workflow-editor/node_modules/playwright/index.mjs';
    playwright = await import(fallbackPath);
  }

  const resolvedDir = resolveProfileDir(profileDir);
  await fs.mkdir(resolvedDir, { recursive: true });

  const isOffscreen = offscreen && !forceVisible && process.env.WHATSAPP_WEB_FORCE_VISIBLE !== '1';
  const args = [...CHROME_ARGS, ...(isOffscreen ? OFFSCREEN_ARGS : [])];

  const context = await playwright.chromium.launchPersistentContext(resolvedDir, {
    channel: 'chrome',
    headless: headless && !isOffscreen,
    viewport: { width: 1366, height: 900 },
    userAgent: USER_AGENT,
    args,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = context.pages().length ? context.pages()[0] : await context.newPage();
  return { context, page };
}

/**
 * Open chat for a specific phone number or group name.
 */
export async function openChat(page, target) {
  const normalized = String(target || '').trim();
  const cleanNumber = normalized.replace(/[^\d]/g, '');

  if (/^\d{7,15}$/.test(cleanNumber)) {
    // Direct phone number deep-link
    const url = `https://web.whatsapp.com/send?phone=${cleanNumber}`;
    if (!page.url().includes(cleanNumber)) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    }
  } else {
    // Group or contact name search in search box
    const searchSelector = 'div[contenteditable="true"][data-tab="3"]';
    await page.waitForSelector(searchSelector, { timeout: 30000 });
    await page.click(searchSelector);
    await page.fill(searchSelector, normalized);
    await wait(800);
    await page.keyboard.press('Enter');
  }

  const composerSelector = '#main div[contenteditable="true"][data-tab="10"]';
  await page.waitForSelector(composerSelector, { timeout: 45000 });
  return composerSelector;
}

/**
 * Send text message with human-like jitter.
 */
export async function sendTextMessage(page, target, text) {
  await wait(randomJitterMs(500, 1200));
  const composer = await openChat(page, target);
  await page.click(composer);
  await page.type(composer, text, { delay: 25 });
  await page.keyboard.press('Enter');
  return { ok: true, target, text, sent_at: new Date().toISOString() };
}

/**
 * Send an image with an optional caption.
 */
export async function sendImageWithCaption(page, target, imagePath, caption = '') {
  await wait(randomJitterMs(600, 1500));
  await openChat(page, target);

  const attachButton = 'span[data-icon="plus"], span[data-icon="clip"], button[aria-label="Attach"]';
  await page.waitForSelector(attachButton, { timeout: 20000 });
  await page.click(attachButton);
  await wait(400);

  const fileInputSelector = 'input[type="file"][accept*="image"]';
  const fileChooserPromise = page.waitForFileChooser({ timeout: 15000 });
  
  // Click photo & video icon
  const photoOption = 'span[data-icon="image"], span[data-icon="attach-image"]';
  await page.click(photoOption).catch(async () => {
    // Fallback: directly set files on hidden input if available
    const input = await page.$(fileInputSelector);
    if (input) await input.setInputFiles(imagePath);
  });

  try {
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);
  } catch {}

  const captionSelector = 'div[contenteditable="true"][data-tab="10"]';
  await page.waitForSelector(captionSelector, { timeout: 20000 });

  if (caption) {
    await page.click(captionSelector);
    await page.type(captionSelector, caption, { delay: 18 });
  }

  const sendBtnSelector = 'span[data-icon="send"]';
  await page.waitForSelector(sendBtnSelector, { timeout: 20000 });
  await page.click(sendBtnSelector);

  await wait(1500); // Wait for upload completion
  return { ok: true, target, imagePath, caption, sent_at: new Date().toISOString() };
}

/**
 * Scrapes incoming unread/recent media messages from the conversation with +1 786-246-2664.
 */
export async function extractRecentMediaMessages(page, targetPhone = '+1 786-246-2664') {
  await openChat(page, targetPhone);
  await wait(1500);

  // Extract recent message rows in #main
  const messages = await page.evaluate(async () => {
    const rows = document.querySelectorAll('#main div[role="row"]');
    const extracted = [];

    for (const row of Array.from(rows).slice(-15)) {
      const imgElem = row.querySelector('img[src^="blob:"], img[src*="whatsapp"]');
      const textElem = row.querySelector('.selectable-text span, .copyable-text span');
      const isOutbound = row.classList.contains('message-out') || !!row.querySelector('[data-icon="msg-dblcheck"]');

      if (imgElem && !isOutbound) {
        extracted.push({
          hasImage: true,
          src: imgElem.src,
          caption: textElem ? textElem.textContent.trim() : '',
          timestamp: new Date().toISOString(),
        });
      }
    }
    return extracted;
  });

  return messages;
}
