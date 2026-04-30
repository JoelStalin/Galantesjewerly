import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const standaloneDir = resolve(process.cwd(), '.next', 'standalone');
const standaloneServerCandidates = [
  resolve(standaloneDir, 'server.js'),
  resolve(standaloneDir, 'app', 'server.js'),
];
const standaloneServer = standaloneServerCandidates.find(existsSync);

function syncRuntimeAsset(sourcePath, destinationPaths) {
  if (!existsSync(sourcePath)) {
    return;
  }

  for (const destinationPath of destinationPaths) {
    rmSync(destinationPath, { force: true, recursive: true });
    mkdirSync(dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath, { recursive: true });
  }
}

if (!standaloneServer) {
  console.error('Standalone build not found. Run "npm run build" before "npm run start".');
  process.exit(1);
}

syncRuntimeAsset(resolve(process.cwd(), 'public'), [
  resolve(standaloneDir, 'public'),
  resolve(standaloneDir, 'app', 'public'),
]);
syncRuntimeAsset(resolve(process.cwd(), '.next', 'static'), [
  resolve(standaloneDir, '.next', 'static'),
  resolve(standaloneDir, 'app', '.next', 'static'),
]);

const child = spawn(process.execPath, [standaloneServer], {
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_DATA_DIR: process.env.APP_DATA_DIR ?? resolve(process.cwd(), 'data'),
    NODE_ENV: process.env.NODE_ENV ?? 'production',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
