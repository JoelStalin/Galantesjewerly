import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = process.env.ORCA_RUNTIME_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../apps/orca');
const root = path.join(runtimeRoot, 'workflow-editor', 'dist');
const blueprintFile = path.join(runtimeRoot, 'data', 'workflow_blueprints.json');
const tenantsFile = path.join(runtimeRoot, 'data', 'orca-tenants.json');
const dataDir = path.resolve(process.cwd(), 'data/inventory-agent');
const feedbackFile = path.join(dataDir, 'orca-classification-feedback.json');
const port = Number(process.env.ORCA_UI_PORT || 4173);
const host = process.env.ORCA_UI_HOST || '127.0.0.1';
const hermesBaseUrl = process.env.HERMES_BASE_URL || 'https://hermes.dev/v1';
const hermesApiKey = process.env.HERMES_API_KEY || '';

// --- ORCA WORKFLOW DEBUGGER STATE ENGINE ---
let debugState = {
  status: 'idle', // idle, running, paused_at_breakpoint, completed, failed
  current_node_id: null,
  step_index: 0,
  breakpoints: new Set(['node-classification-02', 'node-human-approval-04']),
  node_outputs: {},
  logs: [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Orca Debug Engine initialized with breakpoints support.' }
  ],
};

function ensureFeedbackFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(feedbackFile)) {
    const initialLogs = [
      {
        id: 'cls-1001',
        cluster_id: 'GAL-1001',
        image_url: '/assets/products/gold-ring.jpg',
        image_filename: 'cluster-1001-1.jpg',
        predicted_category: 'Rings',
        predicted_tags: ['18K Gold', 'Cluster Ring', 'Diamonds'],
        confidence: 0.94,
        model_name: 'hermes-agent-v1',
        timestamp: new Date().toISOString(),
        status: 'approved',
        admin_feedback: {
          corrected_category: 'Rings',
          corrected_tags: ['18K Gold', 'Cluster Ring', 'Diamonds'],
          reviewer_notes: 'Accurate classification confirmed.',
          reviewed_at: new Date().toISOString(),
        },
      },
      {
        id: 'cls-1002',
        cluster_id: 'GAL-1002',
        image_url: '/assets/products/gold-necklace.jpg',
        image_filename: 'cluster-1002-1.jpg',
        predicted_category: 'Pendants',
        predicted_tags: ['Yellow Gold', 'Chain'],
        confidence: 0.72,
        model_name: 'hermes-agent-v1',
        timestamp: new Date().toISOString(),
        status: 'corrected',
        admin_feedback: {
          corrected_category: 'Necklaces',
          corrected_tags: ['Layered Gold', '18K Gold', 'Necklace'],
          reviewer_notes: 'Reclassified from Pendant to Layered Necklace.',
          reviewed_at: new Date().toISOString(),
        },
      },
    ];
    fs.writeFileSync(feedbackFile, JSON.stringify(initialLogs, null, 2), 'utf8');
  }
}

function readClassificationLogs() {
  ensureFeedbackFile();
  try {
    return JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeClassificationLogs(logs) {
  ensureFeedbackFile();
  fs.writeFileSync(feedbackFile, JSON.stringify(logs, null, 2), 'utf8');
}

function readBlueprint(tenantId = 'galantesjewelry') {
  if (!fs.existsSync(blueprintFile)) {
    // Return standard blueprint structure if file path doesn't exist locally
    return {
      id: 'galantes-inventory-agent',
      name: 'Galantes Jewelry Inventory Agent',
      active: false,
      nodes: [
        { id: 'node-drive-fetch-01', label: 'Drive Photo Ingestion', type: 'orca.worker' },
        { id: 'node-classification-02', label: 'Vision AI & Cluster Classification', type: 'orca.decision' },
        { id: 'node-human-approval-04', label: 'Human Admin Review & Overrides', type: 'orca.approval' },
        { id: 'node-odoo-sync-05', label: 'Odoo Consumable Sync', type: 'orca.validation' },
        { id: 'node-qa-evidence-06', label: 'Selenium Profile 9 QA', type: 'orca.test' }
      ],
      connections: {
        'node-drive-fetch-01': [{ node_id: 'node-classification-02', type: 'main', index: 0 }],
        'node-classification-02': [{ node_id: 'node-human-approval-04', type: 'main', index: 0 }],
        'node-human-approval-04': [{ node_id: 'node-odoo-sync-05', type: 'main', index: 0 }],
        'node-odoo-sync-05': [{ node_id: 'node-qa-evidence-06', type: 'main', index: 0 }]
      },
      settings: {},
      orca_meta: { tenant_id: 'galantesjewelry', project_id: 'galantesjewelry' }
    };
  }
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
    const parsedUrl = new URL(req.url, `http://${host}:${port}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api/tenants')) return sendJson(res, fs.existsSync(tenantsFile) ? JSON.parse(fs.readFileSync(tenantsFile, 'utf8')) : [{ id: 'galantesjewelry', name: 'Galantes Jewelry' }]);
    if (pathname.startsWith('/api/n8n/workflows')) {
      const tenant = req.headers['x-orca-tenant'] || parsedUrl.searchParams.get('tenant') || 'galantesjewelry';
      return sendJson(res, { data: [readBlueprint(tenant)] });
    }
    if (pathname === '/api/n8n/node-types') return sendJson(res, nodeTypes);
    if (pathname === '/api/stats') return sendJson(res, { tenant_id: 'galantesjewelry', status: 'local', workflows: 2 });
    if (pathname === '/api/pipeline/stats') return sendJson(res, { workflow: 'galantes-inventory-agent', state: debugState.status });

    // --- DEBUGGER & BREAKPOINT APIS ---
    if (pathname === '/api/orca/execution/state') {
      return sendJson(res, {
        status: debugState.status,
        current_node_id: debugState.current_node_id,
        step_index: debugState.step_index,
        breakpoints: Array.from(debugState.breakpoints),
        node_outputs: debugState.node_outputs,
        logs: debugState.logs,
      });
    }

    if (pathname === '/api/orca/execution/control' && req.method === 'POST') {
      return readBody(req).then((raw) => {
        const body = JSON.parse(raw || '{}');
        const action = body.action; // start, step, pause, resume, toggle_breakpoint, override

        if (action === 'toggle_breakpoint') {
          const nodeId = body.node_id;
          if (debugState.breakpoints.has(nodeId)) {
            debugState.breakpoints.delete(nodeId);
            debugState.logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Breakpoint removed from node ${nodeId}` });
          } else {
            debugState.breakpoints.add(nodeId);
            debugState.logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Breakpoint set on node ${nodeId}` });
          }
        } else if (action === 'start') {
          debugState.status = 'running';
          debugState.step_index = 0;
          debugState.current_node_id = 'node-drive-fetch-01';
          debugState.logs.push({ timestamp: new Date().toISOString(), level: 'info', message: 'Workflow debug execution started.' });
        } else if (action === 'step' || action === 'resume') {
          const nodes = ['node-drive-fetch-01', 'node-classification-02', 'node-human-approval-04', 'node-odoo-sync-05', 'node-qa-evidence-06'];
          const currentIndex = nodes.indexOf(debugState.current_node_id);
          const nextIndex = currentIndex + 1;

          if (nextIndex < nodes.length) {
            const nextNode = nodes[nextIndex];
            debugState.current_node_id = nextNode;
            debugState.step_index = nextIndex;

            if (debugState.breakpoints.has(nextNode)) {
              debugState.status = 'paused_at_breakpoint';
              debugState.logs.push({ timestamp: new Date().toISOString(), level: 'warn', message: `Execution PAUSED at breakpoint: ${nextNode}` });
            } else {
              debugState.status = 'running';
              debugState.logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Executed node: ${nextNode}` });
            }
          } else {
            debugState.status = 'completed';
            debugState.logs.push({ timestamp: new Date().toISOString(), level: 'info', message: 'Workflow completed successfully.' });
          }
        } else if (action === 'override') {
          const nodeId = body.node_id;
          const outputData = body.output;
          debugState.node_outputs[nodeId] = outputData;
          debugState.logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Node ${nodeId} output manually overridden by Admin.` });
        }

        return sendJson(res, {
          ok: true,
          status: debugState.status,
          current_node_id: debugState.current_node_id,
          breakpoints: Array.from(debugState.breakpoints),
          logs: debugState.logs,
        });
      });
    }

    // --- CLASSIFICATION LOGS & LM FEEDBACK APIS ---
    if (pathname === '/api/orca/classification-logs') {
      return sendJson(res, { data: readClassificationLogs() });
    }

    if (pathname === '/api/orca/classification-logs/review' && req.method === 'POST') {
      return readBody(req).then((raw) => {
        const body = JSON.parse(raw || '{}');
        const logs = readClassificationLogs();
        const index = logs.findIndex((l) => l.id === body.id);
        if (index !== -1) {
          logs[index] = {
            ...logs[index],
            status: body.status,
            admin_feedback: {
              corrected_category: body.corrected_category || logs[index].predicted_category,
              corrected_tags: body.corrected_tags || logs[index].predicted_tags,
              reviewer_notes: body.reviewer_notes || 'Reviewed by Admin',
              reviewed_at: new Date().toISOString(),
            },
          };
          writeClassificationLogs(logs);
          debugState.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Admin feedback recorded for image log ${body.id}: status=${body.status}`,
          });
        }
        return sendJson(res, { ok: true, logs });
      });
    }

    if (pathname === '/api/hermes/doctor') return hermesRequest('/models').then((payload) => sendJson(res, { ok: true, provider: 'hermes', mode: 'api-server', models: payload.data || [] })).catch((error) => { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, provider: 'hermes', error: error.message })); });
    if (pathname === '/api/hermes/run' && req.method === 'POST') return readBody(req).then((raw) => {
      const input = JSON.parse(raw || '{}');
      if (!Array.isArray(input.messages) || input.messages.length === 0) throw new Error('messages must be a non-empty array');
      return hermesRequest('/chat/completions', { method: 'POST', body: JSON.stringify({ model: input.model || 'hermes-agent', messages: input.messages, stream: false }) });
    }).then((payload) => sendJson(res, payload)).catch((error) => { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, provider: 'hermes', error: error.message })); });

    if (pathname === '/vite.svg') {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>');
    }
    const relative = pathname === '/' ? '/index.html' : pathname;
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

server.listen(port, host, () => console.log(`Orca local UI & Debugger adapter listening on http://${host}:${port}`));
