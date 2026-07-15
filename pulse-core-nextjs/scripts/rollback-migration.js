#!/usr/bin/env node

/**
 * Migration Rollback Script
 * 
 * This script rolls back the last applied Prisma migration.
 * It uses the Prisma migrate API directly, making it work on Windows and other platforms.
 * 
 * Usage:
 *   node scripts/rollback-migration.js
 *   node scripts/rollback-migration.js --to [migration-name]
 * 
 * Examples:
 *   node scripts/rollback-migration.js
 *   node scripts/rollback-migration.js --to 20240101000000_add_user_settings
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(step, 'bright');
  log('='.repeat(60), 'cyan');
}

function runCommand(command, description) {
  logStep(description);
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'inherit'
    });
    log('✓ Success', 'green');
    return { success: true, output };
  } catch (error) {
    log('✗ Failed', 'red');
    log(error.message, 'red');
    return { success: false, error };
  }
}

function getMigrationStatus() {
  try {
    const output = execSync('npx prisma migrate status', { encoding: 'utf-8' });
    return output;
  } catch (error) {
    log('Failed to get migration status', 'red');
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    to: null,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) {
      options.to = args[i + 1];
      i++;
    }
  }

  return options;
}

function main() {
  log('AfyaHero Migration Rollback', 'bright');
  log('Windows-friendly Prisma migration rollback tool\n', 'cyan');

  const options = parseArgs();

  // Step 1: Show current migration status
  logStep('Step 1: Current Migration Status');
  const status = getMigrationStatus();
  if (status) {
    log(status, 'blue');
  }

  // Step 2: Generate Prisma Client
  const generateResult = runCommand(
    'npx prisma generate',
    'Step 2: Generating Prisma Client'
  );

  if (!generateResult.success) {
    log('\n❌ Failed to generate Prisma Client', 'red');
    process.exit(1);
  }

  // Step 3: Rollback migration
  let rollbackCommand;
  if (options.to) {
    rollbackCommand = `npx prisma migrate resolve --rolled-back "${options.to}"`;
    logStep(`Step 3: Rolling back to migration: ${options.to}`);
  } else {
    rollbackCommand = 'npx prisma migrate resolve --rolled-back "last"';
    logStep('Step 3: Rolling back last migration');
  }

  const rollbackResult = runCommand(rollbackCommand, 'Rolling back migration');

  if (!rollbackResult.success) {
    log('\n❌ Rollback failed', 'red');
    log('\nTroubleshooting:', 'yellow');
    log('  1. Check if there are applied migrations to rollback');
    log('  2. Verify DATABASE_URL is correct');
    log('  3. Check migration status with: npx prisma migrate status');
    process.exit(1);
  }

  // Step 4: Reset database (if needed)
  log('\n⚠️  Note: Prisma does not support automatic rollback of schema changes.', 'yellow');
  log('You may need to manually revert the schema or use:', 'yellow');
  log('  npx prisma migrate reset --force', 'yellow');
  log('\n⚠️  WARNING: This will DELETE ALL DATA in your database!', 'red');

  // Step 5: Regenerate Prisma Client
  const finalGenerateResult = runCommand(
    'npx prisma generate',
    'Step 4: Regenerating Prisma Client'
  );

  if (!finalGenerateResult.success) {
    log('\n⚠️  Warning: Failed to regenerate Prisma Client', 'yellow');
    log('Run manually: npx prisma generate', 'yellow');
  }

  log('\n' + '='.repeat(60), 'green');
  log('Rollback completed successfully!', 'green');
  log('='.repeat(60), 'green');
  log('\nNext steps:', 'cyan');
  log('  1. Verify the schema matches your expectations');
  log('  2. Test your application');
  log('  3. If needed, manually revert schema changes in schema.prisma');
  log('  4. Re-run migrations if needed');
}

// Run the script
try {
  main();
} catch (error) {
  log('\n❌ Unexpected error:', 'red');
  log(error.message, 'red');
  process.exit(1);
}
