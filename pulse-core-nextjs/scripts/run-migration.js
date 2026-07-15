#!/usr/bin/env node

/**
 * Windows-Friendly Migration Script
 * 
 * This script runs Prisma migrations without requiring psql to be installed.
 * It uses the Prisma migrate API directly, making it work on Windows and other platforms.
 * 
 * Usage:
 *   node scripts/run-migration.js [migration-name]
 * 
 * Examples:
 *   node scripts/run-migration.js add_user_settings
 *   node scripts/run-migration.js --create-only add_user_settings
 *   node scripts/run-migration.js --deploy
 */

const { execSync } = require('child_process');
const path = require('path');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    createOnly: false,
    deploy: false,
    name: null,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--create-only') {
      options.createOnly = true;
    } else if (args[i] === '--deploy') {
      options.deploy = true;
    } else if (!args[i].startsWith('--')) {
      options.name = args[i];
    }
  }

  return options;
}

function main() {
  log('AfyaHero Migration Runner', 'bright');
  log('Windows-friendly Prisma migration tool\n', 'cyan');

  const options = parseArgs();

  // Validate arguments
  if (!options.deploy && !options.name) {
    log('Error: Migration name required (unless using --deploy)', 'red');
    log('\nUsage:');
    log('  node scripts/run-migration.js [migration-name]');
    log('  node scripts/run-migration.js --create-only [migration-name]');
    log('  node scripts/run-migration.js --deploy\n');
    process.exit(1);
  }

  // Step 1: Generate Prisma Client
  const generateResult = runCommand(
    'npx prisma generate',
    'Step 1: Generating Prisma Client'
  );

  if (!generateResult.success) {
    log('\n❌ Failed to generate Prisma Client', 'red');
    process.exit(1);
  }

  // Step 2: Run migration or deploy
  if (options.deploy) {
    logStep('Step 2: Deploying migrations to production');
    
    const deployResult = runCommand(
      'npx prisma migrate deploy',
      'Deploying migrations'
    );

    if (!deployResult.success) {
      log('\n❌ Failed to deploy migrations', 'red');
      process.exit(1);
    }

    log('\n✅ Migration deployed successfully', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Verify the changes in your database');
    log('  2. Test the application');
    log('  3. Monitor for any issues');
  } else {
    const migrationCommand = options.createOnly
      ? `npx prisma migrate dev --create-only --name ${options.name}`
      : `npx prisma migrate dev --name ${options.name}`;

    const action = options.createOnly ? 'Creating migration file' : 'Applying migration';
    const migrateResult = runCommand(migrationCommand, `Step 2: ${action}`);

    if (!migrateResult.success) {
      log('\n❌ Migration failed', 'red');
      log('\nTroubleshooting:', 'yellow');
      log('  1. Check your DATABASE_URL in .env');
      log('  2. Ensure database is accessible');
      log('  3. Verify schema changes are valid');
      process.exit(1);
    }

    log('\n✅ Migration successful', 'green');
    
    if (options.createOnly) {
      log('\nMigration file created. Review it before applying:', 'cyan');
      log('  npx prisma migrate dev --name ' + options.name);
    } else {
      log('\nNext steps:', 'cyan');
      log('  1. Review the generated migration in prisma/migrations/');
      log('  2. Test your application with the new schema');
      log('  3. Commit the migration file');
    }
  }

  // Step 3: Generate Prisma Client again (after migration)
  const finalGenerateResult = runCommand(
    'npx prisma generate',
    'Step 3: Regenerating Prisma Client'
  );

  if (!finalGenerateResult.success) {
    log('\n⚠️  Warning: Failed to regenerate Prisma Client', 'yellow');
    log('Run manually: npx prisma generate', 'yellow');
  }

  log('\n' + '='.repeat(60), 'green');
  log('Migration process completed successfully!', 'green');
  log('='.repeat(60), 'green');
}

// Run the script
try {
  main();
} catch (error) {
  log('\n❌ Unexpected error:', 'red');
  log(error.message, 'red');
  process.exit(1);
}
