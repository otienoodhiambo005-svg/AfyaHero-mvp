# AI Operations Monitoring and Alerting

This document describes the monitoring and alerting configuration for AI operations in the AfyaHero Pulse application.

## Monitoring Metrics

### Key Performance Indicators (KPIs)

#### AI Operation Metrics
- **Success Rate**: Percentage of successful AI operations
- **Failure Rate**: Percentage of failed AI operations
- **Average Latency**: Average response time for AI operations
- **P95 Latency**: 95th percentile response time
- **P99 Latency**: 99th percentile response time

#### Provider-Specific Metrics
- **Provider Success Rate**: Success rate per AI provider (Gemini, OpenAI, Anthropic, etc.)
- **Provider Latency**: Average latency per provider
- **Provider Fallback Rate**: How often fallback providers are used

#### Task-Type Metrics
- **Lab Interpretation**: Success rate, latency, volume
- **Clinical Alerts**: Success rate, latency, volume
- **Deterioration Risk**: Success rate, latency, volume
- **Documentation Suggestions**: Success rate, latency, volume
- **Follow-up Recommendations**: Success rate, latency, volume
- **Medication Adherence**: Success rate, latency, volume
- **Resource Allocation**: Success rate, latency, volume
- **Population Analytics**: Success rate, latency, volume

### Audit Metrics
- **Operations by User**: Number of AI operations per user
- **Operations by Hospital**: Number of AI operations per hospital
- **Operations by Role**: Number of AI operations per user role
- **Sensitive Data Masking**: Number of operations with data masking

## Alerting Rules

### Critical Alerts (Immediate Action Required)

#### AI Provider Outage
- **Condition**: All AI providers for a task type are down
- **Severity**: Critical
- **Action**: Alert operations team, fallback to local models

#### High Failure Rate
- **Condition**: AI operation failure rate > 50% for 5 minutes
- **Severity**: Critical
- **Action**: Alert engineering team, investigate provider issues

#### High Latency
- **Condition**: P95 latency > 10 seconds for 5 minutes
- **Severity**: Critical
- **Action**: Alert operations team, investigate performance degradation

#### Rate Limit Exhaustion
- **Condition**: Rate limit violations > 100/minute
- **Severity**: Critical
- **Action**: Alert security team, investigate potential abuse

### Warning Alerts (Investigate Within 1 Hour)

#### Elevated Failure Rate
- **Condition**: AI operation failure rate > 20% for 15 minutes
- **Severity**: Warning
- **Action**: Monitor closely, investigate if trend continues

#### Degraded Performance
- **Condition**: Average latency > 5 seconds for 15 minutes
- **Severity**: Warning
- **Action**: Monitor closely, check provider status

#### Provider Cascade Fallback
- **Condition**: Primary provider fallback rate > 30%
- **Severity**: Warning
- **Action**: Investigate primary provider issues

### Info Alerts (Log Only)

#### Operation Volume Spike
- **Condition**: AI operation volume > 2x normal for time period
- **Severity**: Info
- **Action**: Log for capacity planning

#### New User Activity
- **Condition**: New user performing AI operations
- **Severity**: Info
- **Action**: Log for user onboarding

## Monitoring Implementation

### Application Logging

AI operations are automatically logged via `src/lib/ai-audit-logger.ts`:

```typescript
import { logAIOperation } from '@/lib/ai-audit-logger';

await logAIOperation({
  userId: 'user-id',
  hospitalId: 'hospital-id',
  operation: 'lab-interpret',
  taskType: 'diagnostic',
  provider: 'gemini',
  success: true,
  latencyMs: 1200,
});
```

### Database Audit Logs

All AI operations are logged to the `AuditLog` table in the database:

- `action`: Operation type (e.g., `ai:lab-interpret`)
- `severity`: `info` for success, `error` for failure
- `details`: Operation metadata (task type, provider, latency, etc.)

### Metrics Collection

Metrics can be collected via:
- Application logs
- Database queries on `AuditLog` table
- Custom monitoring endpoints

## Monitoring Dashboard Queries

### AI Operation Success Rate

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_operations,
  SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as successful_operations,
  ROUND(SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM AuditLog
WHERE action LIKE 'ai:%'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### AI Operation Latency by Provider

```sql
SELECT 
  details->>'provider' as provider,
  AVG((details->>'latencyMs')::int) as avg_latency_ms,
  COUNT(*) as operation_count
FROM AuditLog
WHERE action LIKE 'ai:%'
  AND severity = 'info'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY provider
ORDER BY avg_latency_ms;
```

### AI Operations by Task Type

```sql
SELECT 
  details->>'taskType' as task_type,
  COUNT(*) as operation_count,
  AVG((details->>'latencyMs')::int) as avg_latency_ms,
  SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM AuditLog
WHERE action LIKE 'ai:%'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY task_type
ORDER BY operation_count DESC;
```

### AI Operations by Hospital

```sql
SELECT 
  hospitalId,
  COUNT(*) as operation_count,
  SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM AuditLog
WHERE action LIKE 'ai:%'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hospitalId
ORDER BY operation_count DESC;
```

## Alert Configuration

### Using Application Logger

Critical events can be logged with appropriate severity:

```typescript
logger.error('[AI Operations] All providers down for task type', {
  taskType: 'diagnostic',
  availableProviders: [],
});
```

### Using Database Alerts

Set up database triggers or scheduled jobs to monitor audit logs and send alerts when thresholds are exceeded.

## Performance Monitoring

### Latency Thresholds

- **Good**: < 2 seconds
- **Acceptable**: 2-5 seconds
- **Degraded**: 5-10 seconds
- **Critical**: > 10 seconds

### Success Rate Targets

- **Target**: > 95%
- **Minimum**: > 90%
- **Critical**: < 90%

## Capacity Planning

### Scaling Considerations

- **Volume**: Monitor AI operation volume trends
- **Latency**: Ensure latency remains within acceptable ranges
- **Cost**: Track AI provider API costs
- **Rate Limits**: Adjust rate limits based on capacity

### Provider Cost Monitoring

Track API usage and costs per provider to optimize:
- Primary provider selection
- Fallback strategy
- Cost-effective provider combinations

## Incident Response

### AI Provider Outage Procedure

1. Identify affected task types
2. Check fallback provider availability
3. Alert operations team
4. Monitor fallback provider performance
5. Document incident for post-mortem

### High Error Rate Procedure

1. Identify error patterns
2. Check provider status pages
3. Review recent code changes
4. Check rate limit compliance
5. Alert engineering team if needed

## Recommended Tools

### Log Aggregation
- Consider using centralized log aggregation (e.g., ELK Stack, Splunk, CloudWatch Logs)

### Metrics & Monitoring
- Consider using Prometheus + Grafana for metrics visualization
- Set up dashboards for key AI operation metrics

### Alerting
- Configure alerting via PagerDuty, Opsgenie, or similar
- Set up on-call rotations for critical alerts

### Cost Monitoring
- Use provider dashboards to track API usage and costs
- Set up cost alerts for budget thresholds
