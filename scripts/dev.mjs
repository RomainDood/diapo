import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const processes = [
  spawn(process.execPath, [resolve(projectRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: 'inherit',
  }),
  spawn(process.execPath, [resolve(projectRoot, 'scripts/typecheck.mjs'), '--non-blocking'], {
    cwd: projectRoot,
    stdio: 'inherit',
  }),
];

const stop = () => {
  for (const child of processes) child.kill('SIGTERM');
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
processes[0].once('exit', (code) => {
  stop();
  process.exitCode = code ?? 1;
});
