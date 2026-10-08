import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..', '..');

export async function openChat(page, targetPhoneOrGroup) {
  const normalizedPhone = targetPhoneOrGroup.replace(/[^\d+]/g, '');
  if (normalizedPhone.startsWith('+') || /^\d+$/.test(normalizedPhone)) {
    const rawNumber = normalizedPhone.replace(/[^\d]/g, '');
    await page.goto(`https://web.whatsapp.com/send?phone=${rawNumber}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  } else {
    // Group search
    const searchSelector = 'div[contenteditable="true"][data-tab="3"]';
    await page.waitForSelector(searchSelector, { timeout: 30000 });
    await page.click(searchSelector);
    await page.fill(searchSelector, targetPhoneOrGroup);
    await page.keyboard.press('Enter');
  }

  const composerSelector = '#main div[contenteditable="true"][data-tab="10"]';
  await page.waitForSelector(composerSelector, { timeout: 45000 });
  return composerSelector;
}

export async function sendTextMessage(page, target, text) {
  const composer = await openChat(page, target);
  await page.click(composer);
  await page.type(composer, text, { delay: 25 });
  await page.keyboard.press('Enter');
  return { ok: true, sent_at: new Date().toISOString() };
}

export async function sendImageWithCaption(page, target, imagePath, caption = '') {
  await openChat(page, target);

  // Click the attachment button ('+' or paperclip)
  const attachButton = 'span[data-icon="plus"], span[data-icon="clip"], button[aria-label="Attach"]';
  await page.waitForSelector(attachButton, { timeout: 15000 });
  await page.click(attachButton);

  // File input for image
  const fileInputSelector = 'input[type="file"][accept*="image"]';
  const fileChooserPromise = page.waitForFileChooser();
  const photoOption = 'span[data-icon="image"], span[data-icon="attach-image"]';
  await page.click(photoOption).catch(() => {});

  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(imagePath);

  // Wait for caption field and send button
  const captionSelector = 'div[contenteditable="true"][data-tab="10"]';
  await page.waitForSelector(captionSelector, { timeout: 15000 });
  if (caption) {
    await page.click(captionSelector);
    await page.type(captionSelector, caption, { delay: 20 });
  }

  // Send button (green circle with arrow)
  const sendButtonSelector = 'span[data-icon="send"]';
  await page.waitForSelector(sendButtonSelector, { timeout: 15000 });
  await page.click(sendButtonSelector);

  return { ok: true, imagePath, caption, sent_at: new Date().toISOString() };
}
