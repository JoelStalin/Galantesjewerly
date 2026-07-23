import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const queuePath = path.join(root, 'data/inventory-agent/review/review-queue.csv');
const clustersPath = path.join(root, 'data/inventory-agent/manifests/ml-product-clusters-reviewed.json');
// Deprecated CLI runner: never write the MCP state file. The active path is
// Google AI Studio through antigravity_inventory_mcp.mjs.
const outputPath = path.join(root, 'data/inventory-agent/review/antigravity-cli-review-deprecated.json');

function csvRows(text) {
  const lines = text.trim().split(/\r?\n/); const headers = lines.shift().split(',');
  return lines.map((line) => { const values = line.split(','); return Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])); });
}
function runGemini(prompt) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' ? 'powershell.exe' : 'gemini';
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(process.env.APPDATA || '', 'npm', 'gemini.ps1'), '-p', prompt, '-o', 'text', '--approval-mode', 'plan']
      : ['-p', prompt, '-o', 'text', '--approval-mode', 'plan'];
    const child = spawn(executable, args, { cwd: root, windowsHide: true, shell: false });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Antigravity timeout after 90 seconds')); }, 90_000);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(err || `gemini exit ${code}`)); });
  });
}
function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/); if (!match) throw new Error('Antigravity returned no JSON');
  const value = JSON.parse(match[0]);
  if (typeof value.sameProduct !== 'boolean' || !Number.isFinite(Number(value.confidence))) throw new Error('Invalid Antigravity decision contract');
  return { sameProduct: value.sameProduct, confidence: Number(value.confidence), reason: String(value.reason || '').slice(0, 240) };
}
const queue = csvRows(await fs.readFile(queuePath, 'utf8')).filter((row) => row.approvePublish !== 'YES');
const clusters = JSON.parse(await fs.readFile(clustersPath, 'utf8')).clusters || [];
const clusterById = new Map(clusters.map((c) => [c.clusterId, c]));
let state = { provider: 'antigravity', account: 'joelstalin2105@gmail.com', completed: [], reviews: [], errors: [] };
try { state = JSON.parse(await fs.readFile(outputPath, 'utf8')); } catch {}
const done = new Set(state.completed || []);
for (const row of queue) {
  if (done.has(row.clusterId)) continue;
  const cluster = clusterById.get(row.clusterId); if (!cluster) { state.errors.push({ clusterId: row.clusterId, error: 'Cluster not found' }); continue; }
  const images = (cluster.files || []).map((f) => path.resolve(root, f.localPath));
  const prompt = `Analiza las siguientes imágenes locales del mismo cluster de inventario: ${images.join(', ')}. Decide si TODAS muestran el mismo producto físico para una sola ficha Odoo. Responde SOLO JSON válido: {"sameProduct":true|false,"confidence":0-1,"reason":"máximo 20 palabras"}. Si hay duda, usa false.`;
  try { const result = parseJson(await runGemini(prompt)); state.reviews.push({ clusterId: row.clusterId, imageCount: images.length, ...result, reviewedAt: new Date().toISOString() }); state.completed.push(row.clusterId); }
  catch (error) { state.errors.push({ clusterId: row.clusterId, error: String(error.message || error).slice(0, 300) }); }
  await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`);
}
console.log(JSON.stringify({ ok: state.errors.length === 0, provider: state.provider, reviewed: state.completed.length, pending: queue.length - state.completed.length, errors: state.errors.length, output: 'data/inventory-agent/review/antigravity-cluster-review.json' }, null, 2));
