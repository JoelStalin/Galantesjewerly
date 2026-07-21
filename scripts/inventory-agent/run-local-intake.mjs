import { spawn } from 'node:child_process';

const commands = ['drive:scan', 'drive:download', 'image:convert-heic', 'image:features', 'ml:build-index', 'ml:cluster', 'product:metadata-suggest', 'review:export', 'review:seed-estimates', 'review:import', 'odoo:dry-run'];

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/inventory-agent/nodes.mjs', command], { stdio: 'inherit', shell: false, env: { ...process.env, INVENTORY_AGENT_LOCAL_WORKER: 'true' } });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

for (const command of commands) await run(command);
console.log(JSON.stringify({ ok: true, worker: 'local', commands }, null, 2));
