# AfyaHero Load Testing

This directory contains load testing scripts for AfyaHero Hospital OS using k6.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

Or download from: https://k6.io/

## Load Test Scripts

### 1. API Load Test (`api-load-test.js`)

Tests critical API endpoints:
- Patient management
- Appointments
- Lab requests
- Prescriptions
- Clinical vitals
- Bot analytics

**Run:**
```bash
k6 run loadtests/api-load-test.js
```

**With custom base URL:**
```bash
BASE_URL=https://production.afyahero.com k6 run loadtests/api-load-test.js
```

### 2. Bot Webhook Load Test (`bot-webhook-load-test.js`)

Tests bot webhook endpoints:
- WhatsApp webhook
- USSD webhook
- Bot analytics API

**Run:**
```bash
k6 run loadtests/bot-webhook-load-test.js
```

## Load Test Scenarios

### API Load Test Stages
- Ramp up to 10 users over 2 minutes
- Ramp up to 50 users over 5 minutes
- Stay at 100 users for 10 minutes
- Ramp down to 50 users over 5 minutes
- Ramp down to 0 users over 2 minutes

### Bot Webhook Load Test Stages
- Ramp up to 10 requests/sec over 1 minute
- Ramp up to 50 requests/sec over 3 minutes
- Stay at 100 requests/sec for 5 minutes
- Ramp down to 50 requests/sec over 3 minutes
- Ramp down to 0 requests/sec over 1 minute

## Performance Thresholds

### API Endpoints
- 95th percentile response time: < 500ms
- Error rate: < 1%
- Custom error rate: < 1%

### Bot Webhooks
- 95th percentile response time: < 200ms
- Error rate: < 5%
- Webhook success rate: > 95%

## Environment Variables

- `BASE_URL`: Base URL for the application (default: http://localhost:3003)
- `K6_OUT`: Output format (default: stdout, can use json, influxdb, etc.)

## Output and Reporting

### Console Output
Default output shows real-time metrics:
- Requests per second
- Response times (min, avg, max, p95)
- Error rates
- Custom metrics

### JSON Output
```bash
k6 run loadtests/api-load-test.js --out json=results.json
```

### InfluxDB + Grafana
```bash
k6 run loadtests/api-load-test.js --out influxdb=http://localhost:8086/k6
```

## Interpreting Results

### Key Metrics
- **http_req_duration**: Request duration
- **http_req_failed**: Failed requests
- **errors**: Custom error rate
- **webhook_success_rate**: Webhook success rate

### Pass/Fail Criteria
Test passes if:
- 95th percentile response time is below threshold
- Error rate is below threshold
- Custom error rate is below threshold

## Running Load Tests in CI/CD

Add to GitHub Actions:
```yaml
- name: Run load tests
  run: |
    npm run load:test
```

## Troubleshooting

### Connection Refused
Ensure the application is running on the specified BASE_URL.

### Authentication Errors
Update test user credentials in the load test script.

### High Error Rates
- Check application logs for errors
- Verify database connection
- Check rate limiting settings

## Performance Optimization Tips

1. **Database Queries**: Ensure queries are optimized with proper indexes
2. **Caching**: Implement Redis caching for frequently accessed data
3. **Connection Pooling**: Configure appropriate database connection pool size
4. **API Rate Limiting**: Adjust rate limits based on load test results
5. **Horizontal Scaling**: Consider adding more application instances if needed

## Next Steps

1. Run load tests in staging environment
2. Analyze results and identify bottlenecks
3. Implement optimizations based on findings
4. Re-run load tests to validate improvements
5. Establish baseline performance metrics
6. Set up continuous performance monitoring
