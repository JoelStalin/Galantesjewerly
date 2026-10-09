import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 4000;
const SESSION_DIR = process.env.SESSION_DIR || '/app/data/whatsapp-session';
fs.mkdirSync(SESSION_DIR, { recursive: true });

let browser = null;
let page = null;
let latestFrame = null;
let isStreaming = false;
let sessionState = 'initializing';
let pairingCode = null;

async function launchBrowser() {
  try {
    sessionState = 'launching_browser';
    console.log('[whatsapp-browser] Launching Chromium with user data dir:', SESSION_DIR);
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
      userDataDir: SESSION_DIR,
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    );

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    sessionState = 'navigating_whatsapp';
    console.log('[whatsapp-browser] Navigating to https://web.whatsapp.com ...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.warn('goto warning:', e.message));

    console.log('[whatsapp-browser] Page loaded.');
    startFrameLoop();
  } catch (err) {
    console.error('[whatsapp-browser] Launch error:', err);
    sessionState = 'error: ' + err.message;
  }
}

async function startFrameLoop() {
  isStreaming = true;
  while (isStreaming && page) {
    try {
      latestFrame = await page.screenshot({ type: 'jpeg', quality: 75 });
      
      const hasChats = await page.$('div#pane-side, div[aria-label="Chat list"]').then(Boolean).catch(() => false);
      const hasQR = await page.$('canvas[aria-label*="Scan"], div[data-ref]').then(Boolean).catch(() => false);
      const codeEl = await page.$('div[data-testid="link-device-phone-number-code-screen"], span[data-testid="link-code"]').then(Boolean).catch(() => false);

      if (hasChats) {
        sessionState = 'logged_in';
      } else if (codeEl) {
        sessionState = 'pairing_code_ready';
      } else if (hasQR) {
        sessionState = 'qr_ready';
      } else {
        sessionState = 'waiting_page';
      }

      // Auto-dismiss any onboarding/update modals
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const cont = btns.find(b => b.textContent && b.textContent.trim().toLowerCase() === 'continue');
        if (cont) cont.click();
        const closeX = document.querySelector('span[data-icon="x"]');
        if (closeX) closeX.click();
      }).catch(() => {});
    } catch (e) {
      // transient screenshot error while navigating
    }
    await new Promise(r => setTimeout(r, 600));
  }
}

app.get('/status', async (req, res) => {
  res.json({
    ok: true,
    state: sessionState,
    pairingCode,
    hasFrame: Boolean(latestFrame),
    timestamp: Date.now()
  });
});

app.get('/frame', (req, res) => {
  if (!latestFrame) {
    return res.status(404).send('No frame yet');
  }
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(latestFrame);
});

app.post('/click', async (req, res) => {
  const { x, y } = req.body;
  if (!page || typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ ok: false, error: 'Invalid coordinates' });
  }
  try {
    await page.mouse.click(x, y);
    await new Promise(r => setTimeout(r, 100));
    latestFrame = await page.screenshot({ type: 'jpeg', quality: 75 });
    res.json({ ok: true, clicked: { x, y } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/type', async (req, res) => {
  const { text, key } = req.body;
  if (!page) {
    return res.status(400).json({ ok: false, error: 'Browser not ready' });
  }
  try {
    if (text) {
      await page.keyboard.type(text);
    } else if (key) {
      await page.keyboard.press(key);
    }
    latestFrame = await page.screenshot({ type: 'jpeg', quality: 75 });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/action', async (req, res) => {
  const { action, phoneNumber } = req.body;
  if (!page) {
    return res.status(400).json({ ok: false, error: 'Browser not ready' });
  }

  try {
    if (action === 'refresh') {
      await page.reload({ waitUntil: 'networkidle2' });
      return res.json({ ok: true, message: 'Reloaded' });
    }

    if (action === 'link_phone') {
      const linkBtn = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span, button'));
        const found = spans.find(s => s.textContent && s.textContent.toLowerCase().includes('link with phone number'));
        if (found) {
          found.click();
          return true;
        }
        return false;
      });

      if (!linkBtn) {
        return res.json({ ok: false, message: 'Could not find Link with phone number button' });
      }

      await new Promise(r => setTimeout(r, 1500));

      const num = phoneNumber || '7862462664';
      const typed = await page.evaluate((phoneVal) => {
        const input = document.querySelector('input[type="tel"], input[data-testid*="phone-number-input"]');
        if (input) {
          input.focus();
          input.value = '';
          return true;
        }
        return false;
      }, num);

      if (typed) {
        await page.keyboard.type(num);
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');
      }

      return res.json({ ok: true, message: 'Phone pairing triggered', num });
    }

    if (action === 'get_chats') {
      const chats = await page.evaluate(() => {
        const titles = [];
        document.querySelectorAll('#pane-side span[title]').forEach(s => {
          const t = s.getAttribute('title');
          if (t && !titles.includes(t)) titles.push(t);
        });
        return titles;
      });
      return res.json({ ok: true, chats });
    }

    if (action === 'eval') {
      const { code } = req.body;
      const result = await page.evaluate(code);
      return res.json({ ok: true, result });
    }

    if (action === 'send_chat') {
      const { target, text } = req.body;
      const cleanPhone = String(target || '').replace(/[^\d]/g, '');

      // 1. Open chat
      if (/^\d{7,15}$/.test(cleanPhone)) {
        await page.goto(`https://web.whatsapp.com/send?phone=${cleanPhone}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      } else {
        // Search group or contact by name in DOM or search box
        const directFound = await page.evaluate((groupQuery) => {
          const spans = Array.from(document.querySelectorAll('#pane-side span[title]'));
          const match = spans.find(s => {
            const t = s.getAttribute('title');
            return t && t.toLowerCase().includes(groupQuery.toLowerCase());
          });
          if (match) {
            match.click();
            return true;
          }
          return false;
        }, target);

        if (!directFound) {
          const searchInput = await page.$('div[contenteditable="true"][data-tab="3"], input[data-tab="3"]');
          if (searchInput) {
            await searchInput.click();
            await page.evaluate((el, query) => {
              el.focus();
              document.execCommand('selectAll', false, null);
              document.execCommand('delete', false, null);
              document.execCommand('insertText', false, query);
            }, searchInput, target);
            await new Promise(r => setTimeout(r, 1500));
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      await new Promise(r => setTimeout(r, 1200));

      // 2. Type in composer
      const composer = await page.waitForSelector('#main div[contenteditable="true"]', { timeout: 30000 });
      if (!composer) {
        return res.status(404).json({ ok: false, error: 'Chat composer not found' });
      }

      await composer.click();
      await page.evaluate((el, msg) => {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, msg);
      }, composer, text);
      await new Promise(r => setTimeout(r, 400));
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 1000));

      return res.json({ ok: true, sent: true, target, text });
    }

    if (action === 'send_image') {
      const { target, filePath, caption } = req.body;
      if (target) {
        await page.evaluate((groupQuery) => {
          const spans = Array.from(document.querySelectorAll('#pane-side span[title]'));
          const match = spans.find(s => s.getAttribute('title') && s.getAttribute('title').toLowerCase().includes(groupQuery.toLowerCase()));
          if (match) {
            const row = match.closest('div[role="listitem"]') || match.closest('div[role="row"]') || match.closest('div[tabindex="-1"]') || match;
            row.scrollIntoView({ behavior: 'instant', block: 'center' });
            row.click();
          }
        }, target);
        await new Promise(r => setTimeout(r, 1200));
      }

      let fileInput = await page.$('footer input[type="file"], input[accept="image/*"], #main input[type="file"]');
      if (!fileInput) {
        const attachBtn = await page.$('button[aria-label="Attach"], button[title="Attach"], span[data-icon="plus"]');
        if (attachBtn) {
          await attachBtn.click();
          await new Promise(r => setTimeout(r, 800));
          fileInput = await page.$('footer input[type="file"], input[accept="image/*"], #main input[type="file"]');
        }
      }

      if (!fileInput) {
        return res.status(404).json({ ok: false, error: 'Chat file input not found' });
      }

      await fileInput.uploadFile(filePath);
      await new Promise(r => setTimeout(r, 2500));

      if (caption) {
        const box = await page.waitForSelector('div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][data-tab="6"], div[role="textbox"]', { timeout: 10000 }).catch(() => null);
        if (box) {
          await box.click();
          await page.evaluate((el, text) => {
            el.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, text);
          }, box, caption);
          await new Promise(r => setTimeout(r, 600));
        }
      }

      const sendBtn = await page.waitForSelector('span[data-icon="send"], div[aria-label="Send"], span[data-icon="send-light"]', { timeout: 10000 }).catch(() => null);
      if (sendBtn) {
        await sendBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await new Promise(r => setTimeout(r, 2500));
      latestFrame = await page.screenshot({ type: 'jpeg', quality: 75 }).catch(() => null);
      return res.json({ ok: true, sent: true, filePath, target });
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Standalone interactive live browser page
app.get('/live', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Galantes Jewelry - Live WhatsApp Browser</title>
  <style>
    body { margin:0; padding:16px; background:#0b1120; color:#f8fafc; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; }
    h1 { margin-bottom:4px; font-size:20px; }
    .controls { display:flex; gap:8px; margin-bottom:12px; }
    button { background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:600; }
    button:hover { background:#334155; }
    .viewer { position:relative; border:2px solid #334155; border-radius:8px; overflow:hidden; background:#020617; box-shadow:0 10px 25px rgba(0,0,0,0.5); cursor:crosshair; }
    #viewport { width:1000px; height:625px; display:block; }
    .status-bar { margin-top:8px; font-size:13px; color:#94a3b8; }
  </style>
</head>
<body>
  <h1>🌐 Navegador en Vivo (Servidor Galantes Jewelry)</h1>
  <p style="color:#94a3b8;font-size:13px;margin-top:0">Sesión interactiva en tiempo real ejecutada directamente en el servidor GCP</p>
  
  <div class="controls">
    <button onclick="doAction('refresh')">🔄 Recargar Página</button>
    <button onclick="linkPhone()">📱 Vincular +1 786-246-2664</button>
    <button onclick="typeKey('Enter')">⏎ Enviar Enter</button>
  </div>

  <div class="viewer">
    <img id="viewport" src="/frame" alt="Live Browser Viewport" />
  </div>

  <div class="status-bar" id="status">Conectando con el navegador en vivo...</div>

  <script>
    const img = document.getElementById('viewport');
    const statusEl = document.getElementById('status');

    function refreshFrame() {
      img.src = '/frame?t=' + Date.now();
    }
    setInterval(refreshFrame, 600);

    async function checkStatus() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        statusEl.innerText = 'Estado: ' + data.state.toUpperCase() + ' | Actualizado: ' + new Date().toLocaleTimeString();
      } catch (e) {
        statusEl.innerText = 'Error comunicando con el navegador';
      }
    }
    setInterval(checkStatus, 2000);
    checkStatus();

    img.addEventListener('click', async (e) => {
      const rect = img.getBoundingClientRect();
      const scaleX = 1280 / rect.width;
      const scaleY = 800 / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);
      
      statusEl.innerText = 'Clic enviado en (' + x + ', ' + y + ')...';
      await fetch('/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      });
      refreshFrame();
    });

    async function doAction(action) {
      await fetch('/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      refreshFrame();
    }

    async function linkPhone() {
      statusEl.innerText = 'Solicitando vinculación con +1 786-246-2664...';
      await fetch('/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_phone', phoneNumber: '7862462664' })
      });
      refreshFrame();
    }

    async function typeKey(key) {
      await fetch('/type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      refreshFrame();
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('[whatsapp-browser] Server listening on port ' + PORT);
  launchBrowser();
});
