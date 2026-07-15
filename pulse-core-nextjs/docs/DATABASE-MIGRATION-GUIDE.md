# AfyaHero Database Migration Guide

This guide covers Prisma setup, Supabase database connection, and migration workflows for the AfyaHero project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Prisma Configuration](#prisma-configuration)
- [Supabase Connection](#supabase-connection)
- [Migration Workflows](#migration-workflows)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ installed
- PostgreSQL client tools (psql) installed
- Supabase account and project created
- Git repository access

### Installing PostgreSQL Client Tools

**Windows:**
```powershell
# Download PostgreSQL installer from https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

**macOS:**
```bash
brew install postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql-client
```

## Environment Setup

### 1. Environment Variables

Create or update your `.env` file in the project root:

```env
# Database Connection
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# Supabase (if using Supabase)
SUPABASE_URL="your-supabase-project-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

### 2. Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D tsx
```

## Prisma Configuration

### Prisma Schema Location

The Prisma schema is located at:
```
prisma/schema.prisma
```

### Schema Structure

The schema includes:
- Core models (Hospital, Profile, Patient)
- Clinical models (Appointment, LabRequest, Prescription)
- Portal-specific models (UserSettings)
- Compliance models (AuditLog, SecurityIncident)

### Generating Prisma Client

After any schema changes, regenerate the Prisma client:

```bash
npx prisma generate
```

This updates the TypeScript types and client code.

## Supabase Connection

### Option 1: Direct PostgreSQL Connection

Use your Supabase database connection string:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### Option 2: Using Supabase CLI

Install Supabase CLI:
```bash
npm install -g supabase
```

Link to your Supabase project:
```bash
supabase login
supabase link --project-ref [YOUR-PROJECT-REF]
```

### Option 3: Local Development with Supabase

Start a local Supabase instance:
```bash
supabase start
```

This provides a local PostgreSQL instance that mirrors your production setup.

## Migration Workflows

### Creating a New Migration

When you modify `prisma/schema.prisma`, create a migration:

```bash
npx prisma migrate dev --name describe_your_changes
```

Example:
```bash
npx prisma migrate dev --name add_user_settings_table
```

This:
1. Creates a new migration file in `prisma/migrations/`
2. Applies the migration to your development database
3. Regenerates the Prisma client

### Bot Integration Migration

The WhatsApp and USSD bot integration requires adding new tables to the database. Run the following migration to add bot-related tables:

```bash
npx prisma migrate dev --name add_bot_integration_tables
```

This migration adds:
- `BotMessage` - Track all bot messages (WhatsApp and USSD)
- `MedicationReminder` - Medication reminder schedules
- `MedicationAdherence` - Track patient medication adherence
- Updates to `Patient` model with bot message relations
- Updates to `Prescription` model with medication reminder relations

**Using the Windows-Friendly Migration Script:**

For Windows environments or when psql is not available, use the custom migration script:

```bash
node scripts/run-migration.js add_bot_integration_tables
```

This script:
- Uses Prisma migrate API directly (no psql required)
- Works on Windows, macOS, and Linux
- Provides colored output and progress tracking
- Automatically regenerates Prisma client

**Options:**
```bash
# Create migration file only (review before applying)
node scripts/run-migration.js --create-only add_bot_integration_tables

# Deploy migrations to production
node scripts/run-migration.js --deploy
```

### Applying Migrations to Production

**For Supabase:**

```bash
# Generate migration SQL
npx prisma migrate dev --create-only --name your_migration_name

# Apply to Supabase via Dashboard or CLI
supabase db push
```

Or use the Prisma migration apply with your production DATABASE_URL:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Using the AfyaHero Schema Compatibility Script

The project includes a PowerShell script for schema application:

```bash
npm run db:apply-schema-compat
```

This script:
- Validates the current schema
- Applies compatibility patches
- Requires `psql` to be installed

**Note:** This script is designed for PostgreSQL on Google Cloud SQL. For Supabase, use Prisma migrations instead.

## Common Operations

### Reset Database

**Development only - destroys all data:**

```bash
npx prisma migrate reset
```

### View Database in Prisma Studio

```bash
npx prisma studio
```

This opens a web-based database viewer at `http://localhost:5555`.

### Seed Database

Create a seed file at `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Your seeding logic here
  await prisma.hospital.create({
    data: {
      name: 'Example Hospital',
      location: 'Nairobi, Kenya',
    }
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Run seed:
```bash
npx prisma db seed
```

### Inspect Database Schema

```bash
npx prisma db pull
```

This updates your Prisma schema to match the actual database structure.

### Format Prisma Schema

```bash
npx prisma format
```

## Rollback Procedures

### Rolling Back a Migration

**Development Environment:**

```bash
# Reset database to initial state (WARNING: destroys all data)
npx prisma migrate reset
```

**Production Environment:**

For production, create a rollback migration manually:

1. Create a new migration that reverses the changes:
```bash
npx prisma migrate dev --create-only --name rollback_bot_integration
```

2. Edit the generated migration file to reverse the changes
3. Apply the migration:
```bash
npx prisma migrate deploy
```

### Using Migration Status

Check migration status:
```bash
npx prisma migrate status
```

Resolve stuck migrations:
```bash
npx prisma migrate resolve --applied "migration_name"
npx prisma migrate resolve --rolled-back "migration_name"
```

## Troubleshooting

### Connection Issues

**Error:** `Connection refused` or `Can't reach database`

**Solutions:**
1. Verify DATABASE_URL is correct
2. Check database is running
3. Verify network connectivity
4. Check firewall rules

**For Supabase:**
1. Verify project is active (not paused)
2. Check connection string from Supabase Dashboard > Settings > Database
3. Ensure you're using the correct password

### Migration Conflicts

**Error:** `Migration failed with error`

**Solutions:**
1. Check if migration already applied: `npx prisma migrate status`
2. Resolve conflicts manually in migration files
3. Use `npx prisma migrate resolve --applied` for stuck migrations

### Prisma Client Version Mismatch

**Error:** `Prisma Client version mismatch`

**Solution:**
```bash
npx prisma generate
```

### TypeScript Errors After Schema Changes

**Solution:**
```bash
npx prisma generate
```

This regenerates TypeScript types to match your schema.

## Best Practices

1. **Always review migrations** before applying to production
2. **Backup database** before major schema changes
3. **Use descriptive migration names** (e.g., `add_user_settings_table` not `migration_1`)
4. **Test migrations** in development first
5. **Keep migrations reversible** when possible
6. **Document breaking changes** in team communications
7. **Use environment-specific DATABASE_URL** for different environments

## Environment-Specific Configurations

### Development

```env
DATABASE_URL="postgresql://postgres:dev_password@localhost:5432/afyahero_dev"
```

### Staging

```env
DATABASE_URL="postgresql://postgres:staging_password@staging-db.supabase.co:5432/afyahero_staging"
```

### Production

```env
DATABASE_URL="postgresql://postgres:prod_password@prod-db.supabase.co:5432/afyahero_prod"
```

## Multi-Tenant Architecture Notes

AfyaHero uses a multi-tenant architecture with logical sharding by `hospital_id`. When working with the database:

- Always include `hospitalId` in queries where applicable
- Use the `getTenantPrismaClient(hospitalId)` helper for tenant-scoped operations
- Never query across hospitals without proper authorization
- Indexes include `hospitalId` for performance

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [AfyaHero AGENTS.md](../AGENTS.md) - Project-specific database notes

## Support

For database-related issues:
1. Check this guide first
2. Review Prisma error messages
3. Check Supabase status page
4. Contact the database team lead
