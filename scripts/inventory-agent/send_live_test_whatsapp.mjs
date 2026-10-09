import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirname, '..', '..');
const profileDir = path.resolve(
  process.env.WHATSAPP_WEB_PROFILE_DIR ||
  path.join(root, '.chrome_profile_whatsapp')
);

let playwright;
try {
  playwright = await import('playwright');
} catch (e) {
  playwright = await import('file:///C:/Users/yoeli/Documents/GetUpSoft_Workspace/platform/orca/workflow-editor/node_modules/playwright/index.mjs');
}

console.log('Abriendo navegador con la sesion activa de WhatsApp...');
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

const targetNumber = '17862462664';
const message = 'Galantes Jewelry Inventory Agent: Test de conexion real a WhatsApp y orquestacion con Orca.';

console.log(`Navegando al chat con +1 786-246-2664 (https://web.whatsapp.com/send?phone=${targetNumber})...`);
await page.goto(`https://web.whatsapp.com/send?phone=${targetNumber}`, { waitUntil: 'domcontentloaded' }).catch(() => {});

// Dismiss modal if present ("What's new on WhatsApp Web")
try {
  await page.waitForTimeout(4000);
  const continueBtn = page.locator('button:has-text("Continue"), div[role="button"]:has-text("Continue")');
  if (await continueBtn.isVisible()) {
    console.log('Cerrando modal "What\'s new on WhatsApp Web"...');
    await continueBtn.click();
    await page.waitForTimeout(1000);
  }
} catch (e) {}

const composerSelector = '#main div[contenteditable="true"][data-tab="10"]';
console.log('Esperando el campo de texto del chat...');
await page.waitForSelector(composerSelector, { timeout: 60000 });

console.log('Escribiendo mensaje de prueba en el chat...');
await page.click(composerSelector);
await page.type(composerSelector, message, { delay: 40 });
await page.keyboard.press('Enter');

console.log('Mensaje enviado. Esperando confirmacion en pantalla...');
await page.waitForTimeout(5000);

const screenshotPath = 'C:/Users/yoeli/Documents/Galantesjewelry/data/inventory-agent/evidence/whatsapp-live-sent-confirmation.png';
await page.screenshot({ path: screenshotPath });
console.log(`Captura de pantalla guardada en: ${screenshotPath}`);

await context.close();
console.log('Prueba en vivo completada exitosamente.');
