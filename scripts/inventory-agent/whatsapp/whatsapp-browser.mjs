import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_ARGS = [
  '--start-maximized',
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox'
];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Off-screen trick from CareerAI to run WhatsApp Web headed without being visible, avoiding headless anti-bot detection
const OFFSCREEN_ARGS = ['--window-position=-32000,-32000'];

export function resolveProfileDir(override) {
  if (override) return path.resolve(override);
  if (process.env.WHATSAPP_WEB_PROFILE_DIR) {
    return path.resolve(process.env.WHATSAPP_WEB_PROFILE_DIR);
  }
  // Default to user's dedicated orca whatsapp profile
  return path.resolve(process.env.USERPROFILE || 'C:/Users/yoeli', '.orca/chrome_profile/whatsapp-web');
}

export async function launchBrowser({ profileDir, headless = false, offscreen = false, forceVisible = false } = {}) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (err) {
    // Fallback to local node_modules path
    const fallbackPath = 'C:/Users/yoeli/Documents/GetUpSoft_Workspace/platform/orca/workflow-editor/node_modules/playwright/index.mjs';
    playwright = await import(fallbackPath);
  }

  const resolvedDir = resolveProfileDir(profileDir);
  const isOffscreen = offscreen && !forceVisible && process.env.WHATSAPP_WEB_FORCE_VISIBLE !== '1';
  const args = [...CHROME_ARGS, ...(isOffscreen ? OFFSCREEN_ARGS : [])];

  const context = await playwright.chromium.launchPersistentContext(resolvedDir, {
    channel: 'chrome',
    headless: headless && !isOffscreen, // Keep false if offscreen trick is used
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

export async function connectForLogin(options = {}) {
  return launchBrowser({ ...options, headless: false, offscreen: false, forceVisible: true });
}

export async function connectForWorker(options = {}) {
  return launchBrowser({ ...options, headless: false, offscreen: true });
}
