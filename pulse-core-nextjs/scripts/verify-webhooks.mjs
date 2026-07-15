/**
 * Webhook Verification Script
 * Tests all webhook endpoints for proper security and functionality
 */

import { randomBytes } from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ─── AfyaLink Webhook Tests ───────────────────────────────────────────────────

async function testAfyaLinkWebhook() {
  log('\n🔗 Testing AfyaLink Callback Webhook...', 'blue');
  
  const endpoint = `${BASE_URL}/api/afyalink/callback`;
  
  // Test 1: GET endpoint should return health status
  log('  Test 1: GET endpoint health check...', 'yellow');
  try {
    const response = await fetch(endpoint, { method: 'GET' });
    const data = await response.json();
    
    if (response.ok && data.status === 'online') {
      log('  ✅ GET endpoint is online', 'green');
    } else {
      log(`  ❌ GET endpoint returned: ${response.status}`, 'red');
    }
  } catch (error) {
    log(`  ❌ GET request failed: ${error.message}`, 'red');
  }
  
  // Test 2: POST without signature should be rejected
  log('  Test 2: POST without signature should be rejected...', 'yellow');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test', reference: 'test-123' }),
    });
    
    if (response.status === 401) {
      log('  ✅ Unsigned requests are properly rejected', 'green');
    } else {
      log(`  ❌ Expected 401, got ${response.status}`, 'red');
    }
  } catch (error) {
    log(`  ❌ Request failed: ${error.message}`, 'red');
  }
  
  // Test 3: POST with invalid signature should be rejected
  log('  Test 3: POST with invalid signature should be rejected...', 'yellow');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': Date.now().toString(),
        'X-Signature': 'invalid-signature',
        'X-Agent-ID': 'test-agent',
      },
      body: JSON.stringify({ type: 'test', reference: 'test-123' }),
    });
    
    if (response.status === 401) {
      log('  ✅ Invalid signatures are properly rejected', 'green');
    } else {
      log(`  ❌ Expected 401, got ${response.status}`, 'red');
    }
  } catch (error) {
    log(`  ❌ Request failed: ${error.message}`, 'red');
  }
  
  // Test 4: POST with expired timestamp should be rejected
  log('  Test 4: POST with expired timestamp should be rejected...', 'yellow');
  try {
    const expiredTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': expiredTimestamp,
        'X-Signature': 'any-signature',
        'X-Agent-ID': 'test-agent',
      },
      body: JSON.stringify({ type: 'test', reference: 'test-123' }),
    });
    
    if (response.status === 401) {
      log('  ✅ Expired timestamps are properly rejected', 'green');
    } else {
      log(`  ❌ Expected 401, got ${response.status}`, 'red');
    }
  } catch (error) {
    log(`  ❌ Request failed: ${error.message}`, 'red');
  }
}

// ─── Health Check Endpoint Tests ──────────────────────────────────────────────

async function testHealthCheckEndpoints() {
  log('\n🏥 Testing Health Check Endpoints...', 'blue');
  
  const endpoints = [
    { name: 'Liveness', path: '/api/health/live' },
    { name: 'Readiness', path: '/api/health/ready' },
    { name: 'Startup', path: '/api/health/startup' },
    { name: 'Deep Check', path: '/api/health/deep' },
  ];
  
  for (const endpoint of endpoints) {
    const url = `${BASE_URL}${endpoint.path}`;
    log(`  Testing ${endpoint.name} (${url})...`, 'yellow');
    
    try {
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json();
      
      if (response.ok && data.status) {
        log(`  ✅ ${endpoint.name}: ${data.status}`, 'green');
      } else {
        log(`  ⚠️ ${endpoint.name}: ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`  ❌ ${endpoint.name} failed: ${error.message}`, 'red');
    }
  }
}

// ─── FHIR Metadata Endpoint Tests ─────────────────────────────────────────────

async function testFHIREndpoints() {
  log('\n🏥 Testing FHIR Endpoints...', 'blue');
  
  // Test FHIR metadata endpoint (no auth required)
  const metadataUrl = `${BASE_URL}/api/fhir/metadata`;
  log(`  Testing FHIR Metadata (${metadataUrl})...`, 'yellow');
  
  try {
    const response = await fetch(metadataUrl, { method: 'GET' });
    
    if (response.ok) {
      const data = await response.json();
      if (data.resourceType === 'CapabilityStatement') {
        log('  ✅ FHIR Metadata endpoint returns valid CapabilityStatement', 'green');
      } else {
        log('  ⚠️ FHIR Metadata returned unexpected format', 'yellow');
      }
    } else {
      log(`  ⚠️ FHIR Metadata: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`  ❌ FHIR Metadata failed: ${error.message}`, 'red');
  }
  
  // Test FHIR resource endpoints require auth
  const resourceUrl = `${BASE_URL}/api/fhir/Patient`;
  log(`  Testing FHIR Patient endpoint requires auth...`, 'yellow');
  
  try {
    const response = await fetch(resourceUrl, { method: 'GET' });
    
    if (response.status === 401) {
      log('  ✅ FHIR Patient endpoint properly requires authentication', 'green');
    } else {
      log(`  ⚠️ Expected 401, got ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`  ❌ Request failed: ${error.message}`, 'red');
  }
}

// ─── Security Headers Test ────────────────────────────────────────────────────

async function testSecurityHeaders() {
  log('\n🔒 Testing Security Headers...', 'blue');
  
  const url = `${BASE_URL}/api/health/live`;
  
  try {
    const response = await fetch(url, { method: 'GET' });
    const headers = response.headers;
    
    const securityHeaders = [
      { name: 'Strict-Transport-Security', required: false },
      { name: 'X-Content-Type-Options', required: false },
      { name: 'X-Frame-Options', required: false },
      { name: 'Content-Security-Policy', required: false },
    ];
    
    for (const header of securityHeaders) {
      const value = headers.get(header.name);
      if (value) {
        log(`  ✅ ${header.name}: ${value}`, 'green');
      } else {
        const status = header.required ? '❌' : '⚠️';
        log(`  ${status} ${header.name}: Not set`, header.required ? 'red' : 'yellow');
      }
    }
  } catch (error) {
    log(`  ❌ Security headers test failed: ${error.message}`, 'red');
  }
}

// ─── Main Execution ───────────────────────────────────────────────────────────

async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('  AfyaHero Webhook Verification Script', 'blue');
  log('='.repeat(60), 'blue');
  log(`\nBase URL: ${BASE_URL}`, 'blue');
  
  await testAfyaLinkWebhook();
  await testHealthCheckEndpoints();
  await testFHIREndpoints();
  await testSecurityHeaders();
  
  log('\n' + '='.repeat(60), 'blue');
  log('  Verification Complete', 'blue');
  log('='.repeat(60), 'blue');
}

main().catch(console.error);