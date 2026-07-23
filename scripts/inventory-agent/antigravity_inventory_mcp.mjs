import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const queuePath = path.join(root, 'data/inventory-agent/review/review-queue.csv');
const clustersPath = path.join(root, 'data/inventory-agent/manifests/ml-product-clusters-reviewed.json');
const statePath = path.join(root, 'data/inventory-agent/review/antigravity-cluster-review.json');
const errorPath = path.join(root, 'data/inventory-agent/review/mcp-errors.jsonl');

const textResult = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const csvRows = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()?.split(',') || [];
  return lines.filter(Boolean).map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
};
const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
};
const readQueue = async () => csvRows(await fs.readFile(queuePath, 'utf8'));
const readClusters = async () => (await readJson(clustersPath, { clusters: [] })).clusters || [];
const saveState = async (state) => {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};
const logError = async (tool, error, input) => {
  await fs.mkdir(path.dirname(errorPath), { recursive: true });
  await fs.appendFile(errorPath, `${JSON.stringify({ at: new Date().toISOString(), tool, error: String(error?.message || error), input })}\n`);
};
const tools = [
  { name: 'inventory_review_status', description: 'Estado real de la cola de revisión del agente de inventario.', inputSchema: { type: 'object', properties: {} } },
  { name: 'inventory_get_pending_clusters', description: 'Obtiene clusters pendientes con rutas locales de imágenes para revisión visual.', inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 20 }, offset: { type: 'integer', minimum: 0 } } } },
  { name: 'inventory_get_cluster', description: 'Obtiene un cluster específico y sus imágenes locales.', inputSchema: { type: 'object', required: ['clusterId'], properties: { clusterId: { type: 'string' } } } },
  { name: 'inventory_record_review', description: 'Registra una decisión visual explícita devuelta por Antigravity; no publica en Odoo.', inputSchema: { type: 'object', required: ['clusterId', 'sameProduct', 'confidence', 'reason'], properties: { clusterId: { type: 'string' }, sameProduct: { type: 'boolean' }, confidence: { type: 'number', minimum: 0, maximum: 1 }, reason: { type: 'string', minLength: 1, maxLength: 500 } } } },
  { name: 'inventory_record_error', description: 'Registra un error del workflow como caso de uso para corrección posterior.', inputSchema: { type: 'object', required: ['node', 'error'], properties: { node: { type: 'string' }, error: { type: 'string' }, context: { type: 'object' } } } }
];

async function callTool(name, input = {}) {
  if (name === 'inventory_review_status') {
    const [queue, state] = await Promise.all([readQueue(), readJson(statePath, { completed: [], reviews: [], errors: [] })]);
    const pending = queue.filter((row) => row.approvePublish !== 'YES' && !(state.completed || []).includes(row.clusterId));
    return { ok: true, tenant: 'galantesjewelry', provider: 'antigravity', totalReviewQueue: queue.filter((row) => row.approvePublish !== 'YES').length, completed: (state.completed || []).length, pending: pending.length, errors: (state.errors || []).length, publication: 'protected: no Odoo writes performed' };
  }
  if (name === 'inventory_get_pending_clusters') {
    const [queue, clusters, state] = await Promise.all([readQueue(), readClusters(), readJson(statePath, { completed: [] })]);
    const done = new Set(state.completed || []); const byId = new Map(clusters.map((cluster) => [cluster.clusterId, cluster]));
    const rows = queue.filter((row) => row.approvePublish !== 'YES' && !done.has(row.clusterId)).slice(input.offset || 0, (input.offset || 0) + (input.limit || 10));
    return { ok: true, clusters: rows.map((row) => ({ ...row, files: (byId.get(row.clusterId)?.files || []).map((file) => ({ id: file.id, name: file.name, localPath: path.resolve(root, file.localPath), thumbPath: path.resolve(root, file.thumbPath) })) })) };
  }
  if (name === 'inventory_get_cluster') {
    const cluster = (await readClusters()).find((item) => item.clusterId === input.clusterId);
    if (!cluster) throw new Error(`Cluster not found: ${input.clusterId}`);
    return { ok: true, cluster: { ...cluster, files: (cluster.files || []).map((file) => ({ ...file, localPath: path.resolve(root, file.localPath), thumbPath: path.resolve(root, file.thumbPath) })) } };
  }
  if (name === 'inventory_record_review') {
    const queue = await readQueue(); if (!queue.some((row) => row.clusterId === input.clusterId)) throw new Error(`Cluster not in review queue: ${input.clusterId}`);
    const state = await readJson(statePath, { provider: 'antigravity', account: 'joelstalin2105@gmail.com', completed: [], reviews: [], errors: [] });
    state.completed = [...new Set([...(state.completed || []), input.clusterId])];
    state.reviews = [...(state.reviews || []).filter((review) => review.clusterId !== input.clusterId), { clusterId: input.clusterId, sameProduct: input.sameProduct, confidence: input.confidence, reason: input.reason, reviewedAt: new Date().toISOString(), source: 'antigravity-mcp' }];
    await saveState(state); return { ok: true, recorded: input.clusterId, publication: 'still protected; human/Odoo gate required' };
  }
  if (name === 'inventory_record_error') { await logError(name, input.error, input); return { ok: true, recorded: true, case: { node: input.node, error: input.error } }; }
  throw new Error(`Unknown tool: ${name}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let request;
  try { request = JSON.parse(line); } catch { continue; }
  if (request.method === 'notifications/initialized') continue;
  let result;
  try {
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'galantes-inventory-antigravity', version: '1.0.0' } };
    else if (request.method === 'tools/list') result = { tools };
    else if (request.method === 'tools/call') result = await callTool(request.params?.name, request.params?.arguments || {});
    else if (request.method === 'ping') result = {};
    else if (request.id !== undefined) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } })}\n`); continue; }
    if (request.id !== undefined) process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result: request.method === 'tools/call' ? textResult(result) : result })}\n`);
  } catch (error) {
    await logError(request.method, error, request.params);
    if (request.id !== undefined) process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: String(error.message || error) }) }] } })}\n`);
  }
}
