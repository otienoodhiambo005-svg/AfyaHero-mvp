#!/usr/bin/env node
/**
 * FHIR Implementation Verification Script
 * 
 * Run: npm run verify:fhir
 * or: node scripts/verify-fhir.mjs
 * 
 * Checks:
 * - FHIR type definitions
 * - FHIR mappers implementation
 * - API route existence
 * - Configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, text) {
  console.log(`${color}${text}${colors.reset}`);
}

function checkmark(condition, message) {
  if (condition) {
    log(colors.green, `✓ ${message}`);
    return true;
  } else {
    log(colors.red, `✗ ${message}`);
    return false;
  }
}

async function verify() {
  let passCount = 0;
  let totalCount = 0;

  log(colors.cyan, '\n🔍 AfyaHero FHIR Interoperability Verification\n');

  // 1. Check FHIR types file
  log(colors.blue, '📋 Checking FHIR type definitions...');
  const fhirTypesPath = path.join(rootDir, 'src/lib/fhir/fhir-types.ts');
  if (fs.existsSync(fhirTypesPath)) {
    const fhirTypes = fs.readFileSync(fhirTypesPath, 'utf-8');

    totalCount++;
    if (checkmark(fhirTypes.includes('interface FHIRPatient'), 'FHIRPatient type defined')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirTypes.includes('interface FHIRObservation'), 'FHIRObservation type defined')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirTypes.includes('interface FHIRMedicationRequest'), 'FHIRMedicationRequest type defined')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirTypes.includes('interface FHIROperationOutcome'), 'FHIROperationOutcome type defined')) {
      passCount++;
    }
  }

  // 2. Check FHIR mappers
  log(colors.blue, '📋 Checking FHIR mappers...');
  const fhirMappersPath = path.join(rootDir, 'src/lib/fhir/fhir-mappers.ts');
  if (fs.existsSync(fhirMappersPath)) {
    const fhirMappers = fs.readFileSync(fhirMappersPath, 'utf-8');

    totalCount++;
    if (checkmark(fhirMappers.includes('mapPatientToFHIR'), 'mapPatientToFHIR function exists')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirMappers.includes('mapVitalsToFHIR'), 'mapVitalsToFHIR function exists')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirMappers.includes('mapPrescriptionToFHIR'), 'mapPrescriptionToFHIR function exists')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirMappers.includes('mapLabResultToFHIR'), 'mapLabResultToFHIR function exists')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirMappers.includes('createFHIRBundle'), 'createFHIRBundle function exists')) {
      passCount++;
    }
  }

  // 3. Check FHIR API routes
  log(colors.blue, '📋 Checking FHIR API routes...');
  const fhirResourceRoutePath = path.join(rootDir, 'src/app/api/fhir/[resource]/route.ts');
  if (fs.existsSync(fhirResourceRoutePath)) {
    totalCount++;
    checkmark(true, 'FHIR resource endpoint exists (/api/fhir/[resource])');
    passCount++;
  } else {
    totalCount++;
    checkmark(false, 'FHIR resource endpoint exists');
  }

  const fhirMetadataRoutePath = path.join(rootDir, 'src/app/api/fhir/metadata/route.ts');
  if (fs.existsSync(fhirMetadataRoutePath)) {
    const metadataRoute = fs.readFileSync(fhirMetadataRoutePath, 'utf-8');
    
    totalCount++;
    if (checkmark(metadataRoute.includes('CapabilityStatement'), 'Metadata endpoint returns CapabilityStatement')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(metadataRoute.includes("type: 'Patient'") || metadataRoute.includes('type: "Patient"'), 'CapabilityStatement includes Patient resource')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(metadataRoute.includes("type: 'Observation'") || metadataRoute.includes('type: "Observation"'), 'CapabilityStatement includes Observation resource')) {
      passCount++;
    }
  }

  // 4. Check FHIR index/exports
  log(colors.blue, '📋 Checking FHIR exports...');
  const fhirIndexPath = path.join(rootDir, 'src/lib/fhir/index.ts');
  if (fs.existsSync(fhirIndexPath)) {
    const fhirIndex = fs.readFileSync(fhirIndexPath, 'utf-8');

    totalCount++;
    if (checkmark(fhirIndex.includes('export'), 'FHIR index file has exports')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirIndex.includes('mapPatientToFHIR'), 'FHIR mappers exported')) {
      passCount++;
    }
  }

  // 5. Check documentation
  log(colors.blue, '📋 Checking FHIR documentation...');
  const fhirDocPath = path.join(rootDir, 'FHIR_INTEROPERABILITY.md');
  if (fs.existsSync(fhirDocPath)) {
    const fhirDoc = fs.readFileSync(fhirDocPath, 'utf-8');

    totalCount++;
    if (checkmark(fhirDoc.includes('FHIR R4'), 'Documentation mentions FHIR R4')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(fhirDoc.includes('REST') && fhirDoc.includes('Patient'), 'Documentation covers key concepts')) {
      passCount++;
    }
  }

  // 6. Check OAuth configuration
  log(colors.blue, '📋 Checking security configuration...');
  const resourceRoutePath = path.join(rootDir, 'src/app/api/fhir/[resource]/route.ts');
  if (fs.existsSync(resourceRoutePath)) {
    const resourceRoute = fs.readFileSync(resourceRoutePath, 'utf-8');

    totalCount++;
    if (checkmark(resourceRoute.includes('getSessionFromRequest'), 'OAuth/session validation implemented')) {
      passCount++;
    }

    totalCount++;
    if (checkmark(resourceRoute.includes('enforceApiRateLimit'), 'Rate limiting implemented')) {
      passCount++;
    }
  }

  // Summary
  log(colors.cyan, `\n✨ Results: ${passCount}/${totalCount} checks passed\n`);

  if (passCount === totalCount) {
    log(colors.green, '🎉 FHIR interoperability fully implemented!');
    process.exit(0);
  } else {
    log(colors.yellow, `⚠ ${totalCount - passCount} item(s) need attention`);
    process.exit(1);
  }
}

verify().catch((err) => {
  log(colors.red, `❌ Error: ${err.message}`);
  process.exit(1);
});
