#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const OPENAPI_FILE = 'openapi.yaml';

const REQUIRED_PATHS = [
  '/api/apps/auth/issue',
  '/api/apps/auth/refresh',
  '/api/apps/auth/introspect',
  '/api/apps/patient/me',
  '/api/apps/patient/appointments',
  '/api/apps/chp/patients',
  '/api/apps/chp/visit-notes',
  '/api/apps/facilities',
  '/api/apps/medications',
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(OPENAPI_FILE, 'utf8');
} catch (error) {
  fail(`Cannot read ${OPENAPI_FILE}: ${error.message}`);
}

let spec;
try {
  spec = load(raw);
} catch (error) {
  fail(`Invalid YAML syntax in ${OPENAPI_FILE}: ${error.message}`);
}

if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
  fail('OpenAPI document must be a YAML object at the root.');
}

if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
  fail("Missing or invalid 'openapi' version (expected OpenAPI 3.x).");
}

if (!spec.info || typeof spec.info !== 'object' || Array.isArray(spec.info)) {
  fail("Missing or invalid 'info' object.");
}

if (!spec.paths || typeof spec.paths !== 'object' || Array.isArray(spec.paths)) {
  fail("Missing or invalid 'paths' object.");
}

const missingPaths = REQUIRED_PATHS.filter((path) => !(path in spec.paths));

if (missingPaths.length > 0) {
  fail(
    `Missing required app paths in ${OPENAPI_FILE}:\n${missingPaths
      .map((path) => `  - ${path}`)
      .join('\n')}`
  );
}

console.log(`PASS: ${OPENAPI_FILE} YAML is valid and required app paths are present.`);
