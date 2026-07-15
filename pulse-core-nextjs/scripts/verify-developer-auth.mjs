#!/usr/bin/env node
/**
 * AfyaHero Developer API Auth Smoke Test
 *
 * Usage:
 *   npm run verify:developer-auth
 *
 * Required environment variables:
 *   AFYAHERO_BASE_URL
 *   AFYAHERO_APP_ID
 *   AFYAHERO_APP_KEY
 *   AFYAHERO_SIGNING_SECRET
 */

import crypto from 'crypto';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(color, text) {
  console.log(`${color}${text}${colors.reset}`);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sign(method, pathAndQuery, timestampMs, signingSecret) {
  const payload = `${method.toUpperCase()}\n${pathAndQuery}\n${timestampMs}`;
  return crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
}

async function main() {
  const baseUrl = requiredEnv('AFYAHERO_BASE_URL').replace(/\/+$/, '');
  const appId = requiredEnv('AFYAHERO_APP_ID');
  const appKey = requiredEnv('AFYAHERO_APP_KEY');
  const signingSecret = requiredEnv('AFYAHERO_SIGNING_SECRET');

  const pathAndQuery = '/api/developer/auth/verify';
  const timestampMs = Date.now().toString();
  const signature = sign('GET', pathAndQuery, timestampMs, signingSecret);

  log(colors.cyan, '🔎 Running developer auth verification...');

  const response = await fetch(`${baseUrl}${pathAndQuery}`, {
    method: 'GET',
    headers: {
      'x-afyahero-app-id': appId,
      'x-afyahero-app-key': appKey,
      'x-afyahero-timestamp': timestampMs,
      'x-afyahero-signature': signature,
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { parseError: 'non-json-response' };
  }

  if (!response.ok) {
    log(colors.red, `✗ Verification failed (${response.status})`);
    console.error(payload);
    process.exit(1);
  }

  log(colors.green, '✓ Developer auth verification passed');
  console.log({
    appId: payload.appId,
    appType: payload.appType,
    hospitalId: payload.hospitalId,
    scopes: payload.scopes,
    serverTime: payload.serverTime,
  });
}

main().catch((error) => {
  log(colors.yellow, `⚠ ${error.message}`);
  process.exit(1);
});

