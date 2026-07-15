import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const [, , command, ...extraArgs] = process.argv;
const allowedCommands = new Set(['dev', 'build', 'start']);

if (!command || !allowedCommands.has(command)) {
  console.error('Usage: node scripts/run-superadmin-mode.mjs <dev|build|start> [...args]');
  process.exit(1);
}

const commandArgs = command === 'dev'
  ? ['dev', '--webpack', '--port', '3004', ...extraArgs]
  : command === 'build'
    ? ['build', '--webpack', ...extraArgs]
    : [command, ...extraArgs];
const require = createRequire(import.meta.url);
const nextCliPath = require.resolve('next/dist/bin/next');

const child = spawn(process.execPath, [nextCliPath, ...commandArgs], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    AFYAHERO_APP_MODE: 'superadmin',
  },
});

child.on('error', (error) => {
  console.error('Failed to launch standalone superadmin mode:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
