import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const envPath = path.join(root, '.env.local');

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function updateEnvLine(key, value) {
  let content = '';
  try {
    content = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const lines = content ? content.split(/\r?\n/) : [];
  const pattern = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`);
  let updated = false;
  const next = lines.map((line) => {
    if (pattern.test(line)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!updated) next.push(`${key}=${value}`);
  await fs.writeFile(envPath, `${next.filter((line, index) => line.length > 0 || index < next.length - 1).join('\n')}\n`);
}

async function readOAuthClientConfig(clientPath) {
  const absolutePath = path.resolve(root, clientPath);
  const payload = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  const config = payload.installed || payload.web;
  if (!config?.client_id || !config?.client_secret) {
    throw new Error(`Invalid OAuth client JSON at ${absolutePath}`);
  }
  return config;
}

function listenForCode(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://localhost:${port}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Google OAuth error: ${error}`);
          server.close();
          reject(new Error(`Google OAuth error: ${error}`));
          return;
        }
        if (!code) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Missing OAuth code.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Autenticacion completada. Puedes cerrar esta ventana.');
        server.close();
        resolve(code);
      } catch (error) {
        server.close();
        reject(error);
      }
    });
    server.on('error', reject);
    server.listen(port, 'localhost', () => {
      const address = server.address();
      if (typeof address === 'object' && address?.port) {
        server.emit('oauth-port', address.port);
      }
    });
  });
}

function reserveCallbackPort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(preferredPort, 'localhost', () => {
      const address = server.address();
      const port = typeof address === 'object' && address?.port ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
  });
}

async function openBrowser(url) {
  const { spawn } = await import('node:child_process');
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['url.dll,FileProtocolHandler', url]
    : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

async function main() {
  await loadEnvFile(envPath);

  const clientJson = process.env.GOOGLE_OAUTH_CLIENT_JSON || 'secrets/google-drive-oauth-client.json';
  const tokenPath = process.env.GOOGLE_DRIVE_TOKEN_JSON || 'secrets/google-drive-token.json';
  const preferredPort = Number(process.env.GOOGLE_OAUTH_LOCAL_PORT || '0');
  const port = await reserveCallbackPort(preferredPort);
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ];

  const config = await readOAuthClientConfig(clientJson);
  const client = new OAuth2Client(config.client_id, config.client_secret, redirectUri);
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: scopes,
  });

  const codePromise = listenForCode(port);
  console.log(`Opening Google OAuth in browser on localhost port ${port}.`);
  console.log('If the browser does not open, paste this URL manually:');
  console.log(authUrl);
  await openBrowser(authUrl);

  const code = await codePromise;
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh_token. Revoke app access and retry with prompt=consent.');
  }

  const absoluteTokenPath = path.resolve(root, tokenPath);
  await fs.mkdir(path.dirname(absoluteTokenPath), { recursive: true });
  await fs.writeFile(absoluteTokenPath, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  await updateEnvLine('GOOGLE_DRIVE_TOKEN_JSON', tokenPath);
  await updateEnvLine('GOOGLE_OAUTH_REDIRECT_URI', redirectUri);
  await updateEnvLine('GOOGLE_OAUTH_SCOPES', scopes.join(' '));

  console.log('Google Drive OAuth token saved: GOOGLE_DRIVE_TOKEN_JSON=<set>');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
