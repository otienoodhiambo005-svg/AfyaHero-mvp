# Database Performance Monitoring

This document outlines the database performance monitoring setup for AfyaHero Hospital OS using PostgreSQL on Google Cloud SQL.

## Overview

AfyaHero uses PostgreSQL as its primary database, hosted on Google Cloud SQL. This document describes the monitoring setup, key metrics, and alerting configuration.

## Monitoring Tools

### 1. Google Cloud SQL Monitoring

Google Cloud SQL provides built-in monitoring for:
- CPU utilization
- Memory usage
- Disk usage
- Database connections
- Query performance
- Replication lag

### 2. Prisma Query Logging

Prisma ORM can be configured to log slow queries for analysis:

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Enable query logging in environment:
```env
LOG_QUERIES=true
SLOW_QUERY_THRESHOLD=1000
```

### 3. Custom Monitoring Service

A custom monitoring service can be implemented to track:
- Query execution time
- Connection pool usage
- Slow query detection
- Deadlock detection

## Key Performance Metrics

### Database Metrics

| Metric | Target | Alert Threshold | Description |
|--------|--------|-----------------|-------------|
| CPU Utilization | < 70% | > 85% | Database server CPU usage |
| Memory Utilization | < 80% | > 90% | Database server memory usage |
| Disk Usage | < 70% | > 85% | Storage space utilization |
| Connection Usage | < 80% | > 90% | Active database connections |
| Query Latency (p95) | < 200ms | > 500ms | 95th percentile query response time |
| Slow Queries | < 1% | > 5% | Percentage of queries > 1s |
| Deadlocks | 0 | > 0/hour | Database deadlocks per hour |

### Query Performance

| Query Type | Target | Description |
|------------|--------|-------------|
| Patient lookup | < 50ms | Single patient retrieval |
| Appointment queries | < 100ms | Appointment list and filtering |
| Lab results queries | < 150ms | Lab result retrieval |
| Prescription queries | < 100ms | Prescription lookup |
| Complex joins | < 300ms | Multi-table queries |

## Monitoring Implementation

### Prisma Query Logging

Create a custom logger for Prisma:

```typescript
// src/lib/database/prisma-logger.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  const duration = e.duration;
  if (duration > 1000) {
    console.warn(`Slow query detected: ${duration}ms`);
    console.warn(`Query: ${e.query}`);
  }
});
```

### Connection Pool Monitoring

Monitor connection pool usage:

```typescript
// src/lib/database/connection-monitor.ts
import { prisma } from '@/lib/database';

export async function getConnectionPoolStats() {
  const stats = await prisma.$queryRaw`
    SELECT 
      count(*) as total_connections,
      count(*) FILTER (WHERE state = 'active') as active_connections,
      count(*) FILTER (WHERE state = 'idle') as idle_connections
    FROM pg_stat_activity
    WHERE datname = current_database()
  `;
  
  return stats;
}
```

### Slow Query Detection

Create a slow query detector:

```typescript
// src/lib/database/slow-query-detector.ts
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

const SLOW_QUERY_THRESHOLD = 1000; // 1 second

export async function detectSlowQueries() {
  const slowQueries = await prisma.$queryRaw`
    SELECT 
      query,
      calls,
      total_time,
      mean_time,
      max_time
    FROM pg_stat_statements
    WHERE mean_time > $1
    ORDER BY mean_time DESC
    LIMIT 10
  `, [SLOW_QUERY_THRESHOLD]);

  if (slowQueries.length > 0) {
    logger.warn('Slow queries detected:', { slowQueries });
  }

  return slowQueries;
}
```

## Alerting Setup

### Google Cloud Monitoring Alerts

Create alert policies in Google Cloud Monitoring:

1. **CPU Usage Alert**
   - Condition: CPU utilization > 85% for 5 minutes
   - Notification: Email + PagerDuty

2. **Memory Usage Alert**
   - Condition: Memory utilization > 90% for 5 minutes
   - Notification: Email + PagerDuty

3. **Disk Usage Alert**
   - Condition: Disk usage > 85%
   - Notification: Email

4. **Connection Pool Alert**
   - Condition: Connection usage > 90%
   - Notification: Email

5. **Slow Query Alert**
   - Condition: Slow queries > 5% for 10 minutes
   - Notification: Email

### Application-Level Alerts

Implement application-level alerting:

```typescript
// src/lib/monitoring/alerts.ts
import { logger } from '@/lib/logger';

export async function checkDatabaseHealth() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    logger.info('Database health check passed');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    // Trigger alert
    await sendAlert('database_unhealthy', error.message);
    return false;
  }
}

async function sendAlert(type: string, message: string) {
  // Send to monitoring service (e.g., Sentry, PagerDuty, Slack)
  // Implementation depends on your monitoring setup
}
```

## Performance Optimization

### Index Optimization

Ensure all frequently queried columns have indexes:

```sql
-- Example indexes
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_lab_requests_status ON lab_requests(status);
```

### Query Optimization

Use Prisma's query optimization features:

```typescript
// Select only needed fields
const patient = await prisma.patient.findUnique({
  where: { id },
  select: { id: true, name: true, phone: true },
});

// Use include for efficient joins
const appointment = await prisma.appointment.findUnique({
  where: { id },
  include: {
    patient: { select: { name: true, phone: true } },
  },
});
```

### Connection Pool Configuration

Configure connection pool in Prisma:

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  pool_timeout: 10,
  connection_limit: 20,
});
```

## Monitoring Dashboard

### Google Cloud Console

Access database metrics in Google Cloud Console:
1. Navigate to Cloud SQL
2. Select your instance
3. View metrics in the Monitoring tab

### Custom Dashboard

The AfyaHero admin portal includes a monitoring dashboard at `/portal/admin/monitoring` that displays:
- System health metrics
- Database performance indicators
- Resource usage charts
- Active alerts

## Troubleshooting

### High CPU Usage

1. Check for long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start as duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC
   LIMIT 10;
   ```

2. Check for missing indexes:
   ```sql
   SELECT schemaname, tablename, attname, idx_scan, idx_tup_read
   FROM pg_stat_user_indexes
   ORDER BY idx_scan DESC
   LIMIT 20;
   ```

### High Memory Usage

1. Check cache size:
   ```sql
   SELECT name, setting, unit, short_desc
   FROM pg_settings
   WHERE name LIKE '%cache%';
   ```

2. Check for memory leaks in connections:
   ```sql
   SELECT count(*), state
   FROM pg_stat_activity
   GROUP BY state;
   ```

### Slow Queries

1. Enable query logging:
   ```sql
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   ```

2. Analyze slow queries:
   ```sql
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 20;
   ```

## Best Practices

1. **Regular Monitoring**: Review metrics daily
2. **Proactive Alerting**: Set up alerts before issues occur
3. **Performance Testing**: Run load tests regularly
4. **Index Maintenance**: Review and optimize indexes quarterly
5. **Query Optimization**: Profile slow queries and optimize them
6. **Capacity Planning**: Monitor growth trends and plan accordingly
7. **Backup Monitoring**: Ensure backups are running successfully
8. **Replication Monitoring**: Monitor replication lag if using replicas

## Next Steps

1. Set up Google Cloud Monitoring alerts
2. Implement custom monitoring service
3. Create performance dashboards
4. Set up automated performance reports
5. Integrate with incident management system
6. Establish performance baselines
7. Create runbooks for common issues
