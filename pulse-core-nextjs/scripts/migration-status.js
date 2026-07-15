#!/usr/bin/env node

/**
 * Migration Status Dashboard
 * 
 * This script shows the current status of Prisma migrations.
 * It displays applied migrations, pending migrations, and database connection status.
 * 
 * Usage:
 *   node scripts/migration-status.js
 */

const { execSync } = require('child_process');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(step, 'bright');
  log('='.repeat(60), 'cyan');
}

function runCommand(command) {
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function main() {
  log('AfyaHero Migration Status', 'bright');
  log('Prisma migration status dashboard\n', 'cyan');

  // Get migration status
  logStep('Migration Status');
  const statusResult = runCommand('npx prisma migrate status');
  
  if (statusResult.success) {
    log(statusResult.output, 'blue');
  } else {
    log('Failed to get migration status', 'red');
    log(statusResult.error, 'red');
    log('\nTroubleshooting:', 'yellow');
    log('  1. Check DATABASE_URL in .env file');
    log('  2. Ensure database is accessible');
    log('  3. Verify Prisma schema is valid');
    process.exit(1);
  }

  // Parse and display migration info
  const lines = statusResult.output.split('\n');
  let appliedMigrations = 0;
  let pendingMigrations = 0;
  
  for (const line of lines) {
    if (line.includes('Applied')) {
      appliedMigrations++;
    } else if (line.includes('Pending')) {
      pendingMigrations++;
    }
  }

  // Summary
  logStep('Summary');
  if (appliedMigrations > 0) {
    log(`✓ Applied migrations: ${appliedMigrations}`, 'green');
  } else {
    log('No migrations applied yet', 'yellow');
  }
  
  if (pendingMigrations > 0) {
    log(`⚠ Pending migrations: ${pendingMigrations}`, 'yellow');
    log('  Run: node scripts/run-migration.js', 'cyan');
  } else if (appliedMigrations > 0) {
    log('✓ All migrations applied', 'green');
  }

  // Next steps
  log('\n' + '='.repeat(60), 'cyan');
  log('Available Commands:', 'bright');
  log('='.repeat(60), 'cyan');
  log('  node scripts/run-migration.js [name]     - Create and apply migration', 'cyan');
  log('  node scripts/run-migration.js --deploy    - Deploy to production', 'cyan');
  log('  node scripts/rollback-migration.js        - Rollback last migration', 'cyan');
  log('  npx prisma studio                        - Open database viewer', 'cyan');
  log('  npx prisma generate                       - Regenerate Prisma Client', 'cyan');
}

// Run the script
try {
  main();
} catch (error) {
  log('\n❌ Unexpected error:', 'red');
  log(error.message, 'red');
  process.exit(1);
}
