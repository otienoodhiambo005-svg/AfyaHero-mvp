# AfyaHero Troubleshooting Guide

This guide helps diagnose and resolve common issues with the AfyaHero platform.

## Table of Contents

- [Frontend Issues](#frontend-issues)
- [Gateway Issues](#gateway-issues)
- [Database Issues](#database-issues)
- [AI Provider Issues](#ai-provider-issues)
- [Authentication Issues](#authentication-issues)
- [Performance Issues](#performance-issues)
- [Offline Mode Issues](#offline-mode-issues)

---

## Frontend Issues

### Application Won't Start

**Symptoms:**
- Error when running `npm run dev`
- Port already in use
- Build errors

**Solutions:**

1. **Check port availability:**
```bash
# Check if port 3003 is in use
netstat -ano | findstr :3003  # Windows
lsof -i :3003  # macOS/Linux

# Kill process if needed
taskkill /PID <pid> /F  # Windows
kill -9 <pid>  # macOS/Linux
```

2. **Clear Next.js cache:**
```bash
rm -rf .next
npm run dev
```

3. **Reinstall dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Failures

**Symptoms:**
- TypeScript errors
- ESLint errors blocking build
- Module not found errors

**Solutions:**

1. **Run type check:**
```bash
npm run typecheck
```

2. **Run linter:**
```bash
npm run lint
```

3. **Check imports:**
```bash
# Verify all imports use absolute paths
grep -r "from '../" src/
```

### White Screen on Load

**Symptoms:**
- Blank page loads
- No error in console
- Infinite loading

**Solutions:**

1. **Check browser console for errors**
2. **Verify environment variables are set**
3. **Check network tab for failed requests**
4. **Clear browser cache**
5. **Try incognito mode**

---

## Gateway Issues

### Gateway Won't Start

**Symptoms:**
- Error when running `uvicorn main:app`
- Port 8000 in use
- Python import errors

**Solutions:**

1. **Check Python version:**
```bash
python --version  # Should be 3.11+
```

2. **Install dependencies:**
```bash
cd gateway
poetry install
```

3. **Check port availability:**
```bash
netstat -ano | findstr :8000
```

### Database Connection Errors

**Symptoms:**
- `connection refused` errors
- `timeout` errors
- Authentication failures

**Solutions:**

1. **Verify DATABASE_URL:**
```bash
echo $DATABASE_URL
```

2. **Test database connection:**
```bash
psql $DATABASE_URL -c "SELECT 1"
```

3. **Check firewall rules:**
```bash
# Ensure database port is accessible
telnet db-host 5432
```

### Rate Limiting Errors

**Symptoms:**
- `429 Too Many Requests` errors
- Requests blocked unexpectedly
- Rate limit headers not respected

**Solutions:**

1. **Check Redis connection:**
```bash
# Test Redis connection
redis-cli -h $UPSTASH_REDIS_HOST ping
```

2. **Verify rate limit configuration:**
```bash
# Check gateway/app/core/auth/middleware.py
# Ensure RATE_LIMIT_AUTH and RATE_LIMIT_API are set correctly
```

3. **Clear rate limit cache:**
```bash
redis-cli FLUSHDB  # Use with caution in production
```

---

## Database Issues

### Slow Queries

**Symptoms:**
- API responses slow
- Database CPU high
- Timeouts

**Solutions:**

1. **Enable query logging:**
```bash
# In Prisma schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  logQueries = true
}
```

2. **Add indexes:**
```prisma
// Example: Add index to frequently queried field
@@index([hospital_id, status])
```

3. **Use connection pooling:**
```bash
# In DATABASE_URL
DATABASE_URL=postgresql://user:pass@host:port/db?pool_size=20
```

### Connection Pool Exhaustion

**Symptoms:**
- `connection pool exhausted` errors
- Requests timing out
- High database connection count

**Solutions:**

1. **Increase pool size:**
```bash
DATABASE_URL=postgresql://user:pass@host:port/db?pool_size=50
```

2. **Check for connection leaks:**
```bash
# Review code for unclosed connections
# Ensure all database sessions are properly closed
```

3. **Use connection timeout:**
```bash
DATABASE_URL=postgresql://user:pass@host:port/db?connect_timeout=10
```

### Migration Failures

**Symptoms:**
- `prisma migrate deploy` fails
- Schema drift errors
- Migration conflicts

**Solutions:**

1. **Resolve migration conflicts:**
```bash
npx prisma migrate resolve
```

2. **Reset database (development only):**
```bash
npx prisma migrate reset
```

3. **Create new migration:**
```bash
npx prisma migrate dev --name fix_schema
```

---

## AI Provider Issues

### All AI Providers Failing

**Symptoms:**
- All AI requests return errors
- Cascade not working
- No AI responses

**Solutions:**

1. **Check API keys:**
```bash
# Verify all AI provider keys are set
echo $OPENROUTER_API_KEY
echo $GROQ_API_KEY
echo $HF_API_KEY
```

2. **Test provider independently:**
```bash
# Test OpenRouter
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models
```

3. **Check cascade configuration:**
```bash
# Verify src/lib/ai-providers.ts
# Ensure getCascadeForType() returns correct order
```

### Specific Provider Failing

**Symptoms:**
- One provider consistently fails
- Cascade not falling back
- Slow responses from one provider

**Solutions:**

1. **Check provider status page**
2. **Verify API key is valid**
3. **Check rate limits on provider side**
4. **Remove problematic provider from cascade temporarily**

### AI Responses Too Slow

**Symptoms:**
- API responses > 10 seconds
- Timeouts
- Poor user experience

**Solutions:**

1. **Adjust timeout settings:**
```typescript
// In src/lib/ai-providers.ts
const PROVIDER_TIMEOUT_MS = 12_000; // Increase if needed
```

2. **Use faster models:**
```typescript
// Use lighter models for non-critical tasks
const DEFAULTS = {
  HF_LIGHT: 'meta-llama/Llama-3.1-8B-Instruct',
  GROQ_LIGHT: 'llama-3.1-8b-instant',
};
```

3. **Implement caching:**
```typescript
// Cache common AI responses
// Use Redis for distributed caching
```

---

## Authentication Issues

### Login Failures

**Symptoms:**
- Invalid credentials error
- Login loop
- Session not persisting

**Solutions:**

1. **Verify user exists and is active:**
```sql
SELECT id, email, status FROM profiles WHERE email = 'user@example.com';
```

2. **Check SESSION_SECRET:**
```bash
echo $SESSION_SECRET
# Must be at least 32 characters
```

3. **Clear browser cookies:**
```javascript
// In browser console
document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"));
```

### JWT Token Issues

**Symptoms:**
- `invalid_token` errors
- Token expired immediately
- Token not accepted

**Solutions:**

1. **Check token expiration:**
```bash
# Decode JWT to check exp claim
echo $TOKEN | jq .
```

2. **Verify SECRET_KEY:**
```bash
echo $SECRET_KEY
# Must match between frontend and gateway
```

3. **Check clock sync:**
```bash
# Ensure server time is accurate
timedatectl status  # Linux
```

### Permission Errors

**Symptoms:**
- `forbidden` errors
- Access denied to resources
- Role-based access not working

**Solutions:**

1. **Verify user role:**
```sql
SELECT id, role FROM profiles WHERE id = 'user-id';
```

2. **Check RBAC configuration:**
```python
# In gateway/app/core/rbac/permissions.py
# Verify role has required permissions
```

3. **Review audit logs:**
```sql
SELECT * FROM audit_logs WHERE user_id = 'user-id' ORDER BY created_at DESC LIMIT 10;
```

---

## Performance Issues

### Slow Page Loads

**Symptoms:**
- Page load > 5 seconds
- Large bundle size
- Slow initial render

**Solutions:**

1. **Analyze bundle size:**
```bash
npm run build
# Check .next/analyze/ for bundle analysis
```

2. **Enable compression:**
```javascript
// In next.config.js
module.exports = {
  compress: true,
}
```

3. **Optimize images:**
```javascript
// Use next/image component
import Image from 'next/image';
```

### High Memory Usage

**Symptoms:**
- Node.js process using > 1GB RAM
- Out of memory errors
- Frequent garbage collection

**Solutions:**

1. **Increase Node.js memory limit:**
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

2. **Check for memory leaks:**
```bash
# Use Chrome DevTools Memory profiler
# Look for detached DOM nodes
```

3. **Optimize data fetching:**
```typescript
// Use pagination instead of loading all data
// Implement infinite scroll
// Cache API responses
```

### Database CPU High

**Symptoms:**
- Database CPU > 80%
- Slow queries
- Connection timeouts

**Solutions:**

1. **Identify slow queries:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

2. **Add missing indexes:**
```sql
-- Add index to slow query columns
CREATE INDEX idx_patient_hospital_status ON patients(hospital_id, status);
```

3. **Use read replicas:**
- Route read queries to replicas
- Keep writes on primary

---

## Offline Mode Issues

### Queued Data Not Syncing

**Symptoms:**
- Queue count not decreasing
- Data stuck in localStorage
- Sync not triggering

**Solutions:**

1. **Check network status:**
```javascript
// In browser console
navigator.onLine
```

2. **Manually trigger sync:**
```javascript
// Clear queue and retry
localStorage.removeItem('patient_registration_queue');
location.reload();
```

3. **Check sync logic:**
```typescript
// Verify syncQueuedRegistrations() is called
// Check for errors in sync function
```

### Offline Indicator Not Showing

**Symptoms:**
- No offline indicator visible
- Network status not updating
- UI doesn't reflect offline state

**Solutions:**

1. **Check event listeners:**
```typescript
// Verify online/offline events are registered
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);
```

2. **Test with DevTools:**
```javascript
// In Chrome DevTools Network tab
// Toggle "Offline" checkbox
// Verify indicator appears
```

### Data Loss After Sync

**Symptoms:**
- Data missing after sync
- Duplicate records
- Data corruption

**Solutions:**

1. **Check sync logic for idempotency:**
```typescript
// Ensure sync uses unique IDs
// Prevent duplicate submissions
```

2. **Review server logs:**
```bash
# Check for sync errors
journalctl -u afyahero-gateway -f | grep sync
```

3. **Implement data validation:**
```typescript
// Validate data before sync
// Rollback on error
```

---

## Getting Help

### Log Collection

When reporting issues, include:

1. **Application logs:**
```bash
# Frontend logs
cat logs/frontend.log

# Gateway logs
journalctl -u afyahero-gateway -n 100
```

2. **Environment information:**
```bash
node --version
npm --version
python --version
```

3. **Error messages:**
- Full error stack traces
- Browser console errors
- Network tab failures

### Support Channels

- **Documentation:** https://docs.afyahero.com
- **Status Page:** https://status.afyahero.com
- **Support Email:** support@afyahero.com
- **Emergency:** +254-XXX-XXXXXXX

### Escalation Procedure

1. **Level 1:** Check documentation and troubleshooting guide
2. **Level 2:** Contact support with logs
3. **Level 3:** Escalate to engineering team for critical issues
4. **Level 4:** Executive escalation for production outages > 1 hour

---

## Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `AUTH_001` | Invalid token | Re-authenticate |
| `AUTH_002` | Token expired | Refresh token |
| `AUTH_003` | User inactive | Contact admin |
| `DB_001` | Connection failed | Check DATABASE_URL |
| `DB_002` | Query timeout | Optimize query |
| `AI_001` | Provider timeout | Check cascade |
| `AI_002` | All providers failed | Verify API keys |
| `RATE_001` | Rate limit exceeded | Wait and retry |
| `OFFLINE_001` | Sync failed | Check network |
| `OFFLINE_002` | Queue full | Clear queue manually |
