#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dockerComposePath = resolve(root, 'docker-compose.yml');
const dockerfilePath = resolve(root, 'Dockerfile');
const envLocalPath = resolve(root, '.env.local');

function logOk(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.log(`\x1b[33m!\x1b[0m ${msg}`);
}

function logErr(msg) {
  console.log(`\x1b[31m✗\x1b[0m ${msg}`);
}

function commandExists(cmd, args = ['--version']) {
  const res = spawnSync(cmd, args, { stdio: 'pipe', shell: false });
  return res.status === 0;
}

let failures = 0;

console.log('\nContainerization preflight\n');

if (existsSync(dockerfilePath)) {
  logOk('Dockerfile exists');
} else {
  failures += 1;
  logErr('Dockerfile is missing');
}

if (existsSync(dockerComposePath)) {
  logOk('docker-compose.yml exists');
} else {
  failures += 1;
  logErr('docker-compose.yml is missing');
}

if (commandExists('docker')) {
  logOk('Docker CLI available');
} else {
  failures += 1;
  logErr('Docker CLI not found in PATH');
}

if (commandExists('docker', ['compose', 'version'])) {
  logOk('Docker Compose plugin available');
} else {
  failures += 1;
  logErr('Docker Compose plugin unavailable');
}

if (!existsSync(envLocalPath)) {
  failures += 1;
  logErr('.env.local is missing');
} else {
  logOk('.env.local exists');
  const envLocal = readFileSync(envLocalPath, 'utf8');
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  for (const key of required) {
    const hasKey = new RegExp(`^${key}=`, 'm').test(envLocal);
    if (hasKey) logOk(`${key} set`);
    else {
      failures += 1;
      logErr(`${key} missing`);
    }
  }

  if (/^SUPABASE_DB_PASSWORD=\s*$/m.test(envLocal)) {
    logWarn('SUPABASE_DB_PASSWORD is empty (only needed for psql migration flow)');
  }
}

console.log('');
if (failures > 0) {
  logWarn(`Preflight found ${failures} blocking issue(s).`);
  console.log('Install/start Docker Desktop, then rerun: npm run docker:check\n');
  process.exit(1);
}

logOk('Containerization preflight passed.');
console.log('You can now run: npm run docker:up\n');
