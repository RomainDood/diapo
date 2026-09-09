import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const statusPath = resolve(projectRoot, '.craft/typecheck-status.json');
const nonBlocking = process.argv.includes('--non-blocking');

function writeStatus(status) {
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, JSON.stringify({ status, updatedAt: new Date().toISOString() }) + '\n');
}

writeStatus('running');
const projects = ["tsconfig.app.json"];
let exitCode = 0;
for (const project of projects) {
  const result = spawnSync(resolve(projectRoot, 'node_modules/.bin/tsc'), [
    '-p', project, '--noEmit', '--pretty', 'false',
  ], { cwd: projectRoot, stdio: 'inherit' });
  if (result.status !== 0) exitCode = result.status ?? 1;
}
writeStatus(exitCode === 0 ? 'passed' : 'failed');
process.exitCode = exitCode === 0 || nonBlocking ? 0 : exitCode;
