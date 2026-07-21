import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const intervalMs = Number(process.env.INVENTORY_AGENT_MONITOR_INTERVAL_MS || 300000);
const logPath = path.join(root, 'data/inventory-agent/logs/monitor-loop.jsonl');
const liveStatusPath = path.join(root, 'data/inventory-agent/manifests/live-status.json');

async function run(command) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/inventory-agent/nodes.mjs', command], { cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, INVENTORY_AGENT_LOCAL_WORKER: 'true' } });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ command, code, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }));
  });
}

async function tick() {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const results = [];
  for (const command of ['status', 'gemini:same-product-review', 'gemini:apply-same-product-review', 'inventory:autocorrect-loop', 'errors:use-cases']) results.push(await run(command));
  const liveStatus = { workflow: 'galantes-inventory-agent', updatedAt: new Date().toISOString(), state: results.some((result) => result.code !== 0) ? 'blocked' : 'running', nodes: results.map((result) => ({ command: result.command, status: result.code === 0 ? 'completed' : 'failed', exitCode: result.code })), evidence: { log: 'data/inventory-agent/logs/monitor-loop.jsonl', autocorrection: 'data/inventory-agent/manifests/autocorrection-loop.json', gemini: 'data/inventory-agent/review/gemini-same-product-review.json' } };
  await fs.writeFile(liveStatusPath, `${JSON.stringify(liveStatus, null, 2)}\n`);
  await fs.appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), results })}\n`);
  if (results.some((result) => result.code !== 0)) process.exitCode = 1;
}

await tick();
setInterval(tick, intervalMs);
