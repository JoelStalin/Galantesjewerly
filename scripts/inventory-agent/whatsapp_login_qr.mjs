import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

// Dedicated isolated profile for Galantes Jewelry WhatsApp (separate from CareerAI)
const profileDir = path.resolve(
  process.env.WHATSAPP_WEB_PROFILE_DIR ||
  path.join(root, '.chrome_profile_whatsapp')
);

const outDir = path.join(root, 'data', 'inventory-agent', 'evidence');
fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

let playwright;
try {
  playwright = await import('playwright');
} catch (e) {
  playwright = await import('file:///C:/Users/yoeli/Documents/GetUpSoft_Workspace/platform/orca/workflow-editor/node_modules/playwright/index.mjs');
}

console.log('=================================================================');
console.log('   GALANTES JEWELRY - WHATSAPP WEB LOGIN & QR HANDOFF');
console.log('=================================================================');
console.log(`Director de Perfil: ${profileDir}`);
console.log('Abriendo Google Chrome visible para escanear el QR...');

const context = await playwright.chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1366, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

const page = context.pages().length ? context.pages()[0] : await context.newPage();

await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.bringToFront().catch(() => {});

console.log('\n>>> Por favor escanea el codigo QR que aparece en la ventana de Chrome con tu WhatsApp. <<<');
console.log('Esperando sesion activa...');

let loggedIn = false;
let poll = 0;

while (!loggedIn) {
  await new Promise((r) => setTimeout(r, 3000));
  poll++;

  try {
    const qrLocator = page.locator('canvas[aria-label*="Scan"], canvas[aria-label*="scan"], div[data-testid="qrcode"]').first();
    const qrVisible = await qrLocator.isVisible().catch(() => false);

    if (qrVisible) {
      const qrShotPath = path.join(outDir, 'whatsapp-live-qr.png');
      await qrLocator.screenshot({ path: qrShotPath }).catch(() => {});
    }

    if (chatListVisible && !qrVisible) {
      loggedIn = true;
      const shotPath = path.join(outDir, 'whatsapp-web-session-active.png');
      await page.screenshot({ path: shotPath }).catch(() => {});
      
      const record = {
        ok: true,
        logged_in: true,
        detected_at: new Date().toISOString(),
        profile_dir: profileDir,
        screenshot: shotPath
      };
      
      fs.writeFileSync(path.join(outDir, 'whatsapp-session-status.json'), JSON.stringify(record, null, 2));
      console.log('\n=================================================================');
      console.log('>>> EXITO: ¡Sesion de WhatsApp Web conectada y lista! <<<');
      console.log('=================================================================');
      break;
    }

    if (poll % 10 === 0) {
      console.log(`[Esperando QR] Han transcurrido ~${poll * 3} segundos. La ventana sigue abierta...`);
    }
  } catch {}
}

await context.close();
console.log('Navegador cerrado. Perfil guardado con sesion activa.');
