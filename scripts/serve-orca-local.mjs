import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = process.env.ORCA_RUNTIME_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../apps/orca');
const root = path.join(runtimeRoot, 'workflow-editor', 'dist');
const blueprintFile = path.join(runtimeRoot, 'data', 'workflow_blueprints.json');
const tenantsFile = path.join(runtimeRoot, 'data', 'orca-tenants.json');
const port = Number(process.env.ORCA_UI_PORT || 4173);
const host = process.env.ORCA_UI_HOST || '127.0.0.1';
const hermesBaseUrl = process.env.HERMES_BASE_URL || 'https://hermes.dev/v1';
const hermesApiKey = process.env.HERMES_API_KEY || '';

function readBlueprint(tenantId = 'galantesjewelry') {
  const all = JSON.parse(fs.readFileSync(blueprintFile, 'utf8'));
  const item = all.find((workflow) => workflow.id === 'galantes-inventory-agent' && (tenantId === 'galantesjewelry' || workflow.user_id === 'yoeli'));
  if (!item) throw new Error('galantes-inventory-agent blueprint not found');
  return {
    id: item.id,
    name: item.name,
    active: false,
    nodes: item.nodes.map((node, index) => ({
      id: node.id,
      name: node.label,
      type: `orca.${node.type}`,
      position: { x: index * 260, y: 120 },
      data: { label: node.label, type: node.type, workflowNodeType: node.type },
      parameters: { label: node.label, workflowNodeType: node.type },
      typeVersion: 1,
    })),
    connections: Object.fromEntries(item.nodes.map((node) => [node.id,
      item.edges.filter((edge) => edge.from === node.id).map((edge) => ({ node_id: edge.to, type: 'main', index: 0 }))
    ])),
    settings: item.settings,
    orca_meta: { tenant_id: 'galantesjewelry', project_id: 'galantesjewelry' },
  };
}

const nodeTypes = {
  'orca.trigger': { name: 'orca.trigger', displayName: 'Orca Trigger', category: 'Trigger', description: 'Starts an Orca workflow.' },
  'orca.worker': { name: 'orca.worker', displayName: 'Orca Local Worker', category: 'Galantes Inventory', description: 'Runs a local inventory worker.' },
  'orca.decision': { name: 'orca.decision', displayName: 'Orca Decision', category: 'Galantes Inventory', description: 'Applies a reviewed decision.' },
  'orca.approval': { name: 'orca.approval', displayName: 'Human Approval', category: 'Governance', description: 'Requires explicit human approval.' },
  'orca.recovery': { name: 'orca.recovery', displayName: 'Autocorrection', category: 'Governance', description: 'Records and retries recoverable errors.' },
  'orca.validation': { name: 'orca.validation', displayName: 'Validation', category: 'Galantes Inventory', description: 'Validates a manifest or dry-run.' },
  'orca.test': { name: 'orca.test', displayName: 'Selenium Profile 9 QA', category: 'Testing', description: 'Runs browser evidence checks.' },
  'orca.report': { name: 'orca.report', displayName: 'Evidence Report', category: 'Reporting', description: 'Publishes run evidence.' },
};

function sendJson(res, value) {
  const body = JSON.stringify(value);
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 2_000_000) reject(new Error('Request body too large')); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer((req, res) => {
  try {
    if (req.url?.startsWith('/api/tenants')) return sendJson(res, JSON.parse(fs.readFileSync(tenantsFile, 'utf8')));
    if (req.url?.startsWith('/api/n8n/workflows')) {
      const tenant = req.headers['x-orca-tenant'] || new URL(req.url, 'http://localhost').searchParams.get('tenant') || 'galantesjewelry';
      return sendJson(res, { data: [readBlueprint(tenant)] });
    }
    if (req.url === '/api/n8n/node-types') return sendJson(res, nodeTypes);
    if (req.url === '/api/stats') return sendJson(res, { tenant_id: 'galantesjewelry', status: 'local', workflows: 2 });
    if (req.url === '/api/pipeline/stats') return sendJson(res, { workflow: 'galantes-inventory-agent', state: 'running' });
    if (req.url === '/api/hermes/doctor') return hermesRequest('/models').then((payload) => sendJson(res, { ok: true, provider: 'hermes', mode: 'api-server', models: payload.data || [] })).catch((error) => { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, provider: 'hermes', error: error.message })); });
    if (req.url === '/api/hermes/run' && req.method === 'POST') return readBody(req).then((raw) => {
      const input = JSON.parse(raw || '{}');
      if (!Array.isArray(input.messages) || input.messages.length === 0) throw new Error('messages must be a non-empty array');
      return hermesRequest('/chat/completions', { method: 'POST', body: JSON.stringify({ model: input.model || 'hermes-agent', messages: input.messages, stream: false }) });
    }).then((payload) => sendJson(res, payload)).catch((error) => { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, provider: 'hermes', error: error.message })); });
    if (req.url === '/vite.svg') {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>');
    }
    const requested = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    const relative = requested === '/' ? '/index.html' : requested;
    const target = path.resolve(root, `.${relative}`);
    if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(target);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});
async function hermesRequest(endpoint, options = {}) {
  if (!hermesApiKey) throw new Error('HERMES_API_KEY is not configured in the Orca runtime');
  const response = await fetch(`${hermesBaseUrl.replace(/\/$/, '')}${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${hermesApiKey}`, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Hermes API ${response.status}`);
  return response.json();
}
server.listen(port, host, () => console.log(`Orca local UI adapter listening on http://${host}:${port}`));
