# AFYAHERO.HOSPITAL.OS
An AI native operating system integrating AI into hospital workflows..



# Load Testing with k6

This directory contains load testing scripts for the AfyaHero API endpoints using k6.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6

# Or download from https://k6.io/
```

## Running Load Tests

### Basic API Load Test

Test all Phase 3 API endpoints with concurrent users:

```bash
# Run against local development server
k6 run api-load-test.js

# Run against staging environment
BASE_URL=https://staging.afyahero.com k6 run api-load-test.js

# Run with custom options
k6 run --vus 50 --duration 10m api-load-test.js
```

### Load Test Configuration

The default configuration targets:
- **Concurrent users:** Up to 50
- **Duration:** 9 minutes (2m ramp-up, 5m sustained, 2m ramp-down)
- **Thresholds:**
  - P95 response time < 2s
  - Error rate < 5%

### Customizing the Test

Edit `api-load-test.js` to modify:
- Target endpoints
- Number of concurrent users
- Test duration
- Thresholds
- Request patterns

## Interpreting Results

k6 will output:
- **HTTP req duration:** Response time statistics
- **HTTP reqs/s:** Requests per second
- **Errors:** Failed requests
- **Thresholds:** Whether performance targets were met

### Example Output

```
✓ status is 200
✓ response time < 2s
✓ has data

checks.........................: 100.0% ✓ 1234 / 1234
data_received..................: 2.4 MB 27 kB/s
data_sent......................: 450 kB 5.0 kB/s
http_req_duration..............: avg=850ms min=120ms med=780ms max=2.1s p(90)=1.2s p(95)=1.5s
http_req_failed................: 0.00% ✓ 0 / 1234
```

## Production Load Testing

For production load testing:

1. **Use a staging environment first** to avoid impacting production
2. **Coordinate with the team** to avoid conflicts
3. **Monitor infrastructure** during tests
4. **Review database performance** and connection pooling
5. **Check rate limiting** doesn't block legitimate traffic

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run load tests
  run: |
    k6 run --out json=load-test-results.json load-tests/api-load-test.js
```

## Troubleshooting

### High Error Rates
- Check if the dev server is running
- Verify authentication tokens are valid
- Check rate limiting configuration
- Review server logs for errors

### Slow Response Times
- Check database query performance
- Verify Redis caching is working
- Review AI provider response times
- Check network latency

### Connection Refused
- Ensure the dev server is running on port 3003
- Check firewall settings
- Verify BASE_URL is correct

