# AfyaHero Security Remediation Plan

**Audit Date:** April 19, 2026  
**Overall Rating:** 4.3/10 (Not Production Ready)  
**Security Rating:** 3/10  
**Target Rating:** 9/10 (Production Ready)

## Executive Summary

This plan addresses critical security vulnerabilities, reliability issues, and build/test failures identified in the system audit. The remediation is organized into three phases:

- **Phase 1 (Immediate - 0-7 days):** P0 security fixes and build blockers
- **Phase 2 (Short-term - 1-2 weeks):** P1 reliability and type safety fixes
- **Phase 3 (Medium-term - 2-4 weeks):** P2 improvements and CI hardening

## Phase 1: Critical Security Fixes (0-7 days)

### 1.1 Authentication and Tenant Guarding (P0)

**Issue:** Unguarded admin/analytics/pharmacy routes expose tenant data via query parameters

**Affected Files:**
- `src/app/api/admin/bed/predictive-management/route.ts:41`
- `src/app/api/admin/executive/intelligence/route.ts:38`
- `src/app/api/admin/quality/intelligence/route.ts:28`
- `src/app/api/analytics/patient-flow-prediction/route.ts:18`
- `src/app/api/pharmacy/inventory/predict-demand/route.ts:19`

**Remediation Steps:**

1. **Create authentication middleware wrapper**
```typescript
// src/lib/middleware/withAuthzAndTenant.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export async function withAuthzAndTenant(
  handler: (req: NextRequest, context: { hospitalId: string; userId: string; role: string }) => Promise<NextResponse>,
  requiredRoles: string[] = ['admin']
) {
  return async (req: NextRequest) => {
    // 1. Validate session
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate role
    if (!requiredRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Resolve tenant from session (NOT from query params)
    const hospitalId = session.user.hospitalId;
    if (!hospitalId) {
      return NextResponse.json({ error: 'No hospital context' }, { status: 400 });
    }

    // 4. Call handler with resolved context
    return handler(req, {
      hospitalId,
      userId: session.user.id,
      role: session.user.role,
    });
  };
}
```

2. **Apply wrapper to affected routes**
```typescript
// src/app/api/admin/bed/predictive-management/route.ts
import { withAuthzAndTenant } from '@/lib/middleware/withAuthzAndTenant';

export const GET = withAuthzAndTenant(async (req, { hospitalId }) => {
  // Use hospitalId from context, not from query
  const predictions = await prisma.bedPrediction.findMany({
    where: { hospitalId },
  });
  return NextResponse.json(predictions);
}, ['admin']);
```

3. **Remove query-based tenant selection**
- Search for `req.nextUrl.searchParams.get('hospitalId')` patterns
- Replace with context-based hospitalId from middleware

**Acceptance Criteria:**
- All admin routes require authentication
- Tenant resolution never uses query parameters
- Role-based access control enforced
- Tests verify unauthorized access is blocked

**Timeline:** 2 days

---

### 1.2 Webhook Security Hardening (P0)

**Issue:** WhatsApp signature check bypassed (`return true`), USSD has no verification

**Affected Files:**
- `src/lib/bot/whatsapp-bot.ts:337`
- `src/app/api/bot/whatsapp/webhook/route.ts:20`
- `src/app/api/bot/ussd/webhook/route.ts:10`

**Remediation Steps:**

1. **Implement real WhatsApp signature verification**
```typescript
// src/lib/bot/whatsapp-bot.ts
import crypto from 'crypto';

export function verifyWhatsAppSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    console.warn('WhatsApp webhook secret not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // WhatsApp signature format: sha256=<signature>
  const receivedSignature = signature.replace('sha256=', '');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  );
}
```

2. **Update WhatsApp webhook route**
```typescript
// src/app/api/bot/whatsapp/webhook/route.ts
import { verifyWhatsAppSignature } from '@/lib/bot/whatsapp-bot';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-africas-talking-signature');
  const body = await req.text();

  if (!verifyWhatsAppSignature(body, signature, process.env.WHATSAPP_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook
}
```

3. **Add USSD signature verification**
```typescript
// src/lib/bot/ussd-service.ts
export function verifyUSSDSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Africa's Talking uses HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}
```

4. **Add environment variables**
```env
# .env.example
WHATSAPP_WEBHOOK_SECRET=your-webhook-secret-here
USSD_WEBHOOK_SECRET=your-ussd-secret-here
```

**Acceptance Criteria:**
- Webhook signatures verified using HMAC-SHA256
- Invalid signatures rejected with 401
- Secrets loaded from environment variables
- Tests for signature verification added

**Timeline:** 1 day

---

### 1.3 Remove Hardcoded OTP (P0)

**Issue:** OTP hardcoded to `123456` in bot authentication

**Affected File:**
- `src/lib/bot/bot-auth.ts:165`

**Remediation Steps:**

1. **Implement proper OTP generation**
```typescript
// src/lib/bot/bot-auth.ts
import crypto from 'crypto';

function generateOTP(): string {
  // Generate 6-digit numeric OTP
  return crypto.randomInt(100000, 999999).toString();
}

async function sendOTP(phone: string, otp: string): Promise<void> {
  // Send via Africa's Talking SMS
  await africasTalkingClient.sendSms({
    to: phone,
    message: `Your AfyaHero verification code is: ${otp}. Valid for 10 minutes.`,
  });
}
```

2. **Store OTP securely with expiration**
```typescript
interface OTPStore {
  phone: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
}

const otpStore = new Map<string, OTPStore>();

async function createOTP(phone: string): Promise<string> {
  const otp = generateOTP();
  otpStore.set(phone, {
    phone,
    otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    attempts: 0,
  });
  
  await sendOTP(phone, otp);
  return otp;
}
```

3. **Validate OTP with rate limiting**
```typescript
async function verifyOTP(phone: string, providedOTP: string): Promise<boolean> {
  const record = otpStore.get(phone);
  
  if (!record) {
    return false;
  }

  if (record.expiresAt < new Date()) {
    otpStore.delete(phone);
    return false;
  }

  if (record.attempts >= 3) {
    otpStore.delete(phone);
    return false;
  }

  record.attempts++;

  if (record.otp === providedOTP) {
    otpStore.delete(phone);
    return true;
  }

  return false;
}
```

**Acceptance Criteria:**
- OTP generated randomly (6 digits)
- OTP expires after 10 minutes
- Max 3 attempts allowed
- OTP sent via SMS
- No hardcoded values

**Timeline:** 1 day

---

### 1.4 Fix Build Blockers (P0)

**Issue:** Missing UI components and invalid icon imports prevent build

**Affected Files:**
- `src/app/portal/admin/bot-analytics/page.tsx:4`
- `src/app/portal/admin/monitoring/page.tsx:6`

**Remediation Steps:**

1. **Create missing UI components**
```bash
# Create shadcn/ui components
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tabs
```

2. **Fix invalid icon import**
```typescript
// src/app/portal/admin/monitoring/page.tsx
// Change from:
import { Memory } from 'lucide-react';
// To:
import { Cpu, HardDrive } from 'lucide-react';
```

3. **Update monitoring dashboard to use valid icons**
```typescript
// Replace Memory with Cpu for CPU metrics
// Add HardDrive for disk metrics
```

**Acceptance Criteria:**
- Build completes successfully
- All UI components exist
- All icon imports valid
- No TypeScript errors

**Timeline:** 0.5 day

---

## Phase 2: Reliability and Type Safety (1-2 weeks)

### 2.1 Fix Route Handler Return Contracts (P1)

**Issue:** Routes return session objects instead of NextResponse

**Affected Files:**
- `src/app/api/clinical/alerts/route.ts:36` (and similar patterns)

**Remediation Steps:**

1. **Audit all route handlers**
```bash
# Search for patterns
grep -r "return session" src/app/api
grep -r "return {" src/app/api | grep -v "NextResponse"
```

2. **Fix return types**
```typescript
// Before (incorrect):
export async function GET(req: NextRequest) {
  const session = await getSession();
  return session; // ❌ Wrong
}

// After (correct):
export async function GET(req: NextRequest) {
  const session = await getSession();
  return NextResponse.json({ session }); // ✅ Correct
}
```

3. **Add type guard middleware**
```typescript
// src/lib/middleware/typeGuard.ts
export function ensureNextResponse(value: any): asserts value is NextResponse {
  if (!(value instanceof NextResponse)) {
    throw new Error('Route handler must return NextResponse');
  }
}
```

**Acceptance Criteria:**
- All routes return NextResponse
- Type guards enforce contract
- No runtime type errors

**Timeline:** 2 days

---

### 2.2 Remove `any` from Prisma Loader (P1)

**Issue:** Prisma loader uses `any`, hiding schema bugs

**Affected File:**
- `src/lib/database.ts:16`

**Remediation Steps:**

1. **Define proper Prisma types**
```typescript
// src/lib/database.ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Remove any type
export const prisma = new PrismaClient();
```

2. **Regenerate Prisma client in CI**
```yaml
# .github/workflows/ci.yml
- name: Generate Prisma Client
  run: |
    cd pulse-core-nextjs
    npx prisma generate
```

3. **Enable strict TypeScript mode**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

**Acceptance Criteria:**
- No `any` in database layer
- Prisma client regenerated in CI
- TypeScript strict mode enabled
- Schema mismatches caught at compile time

**Timeline:** 1 day

---

### 2.3 Split Test Architecture (P1)

**Issue:** Jest picks up Playwright tests, causing confusion

**Affected Files:**
- `jest.config.js:21`
- `package.json:25`

**Remediation Steps:**

1. **Update Jest config to exclude Playwright**
```javascript
// jest.config.js
module.exports = {
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '!**/tests/**/*.spec.ts', // Exclude Playwright
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/', // Exclude Playwright test directory
  ],
};
```

2. **Create separate test scripts**
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__",
    "test:integration": "jest --testPathPattern=__tests__/integration",
    "test:e2e": "playwright test"
  }
}
```

3. **Organize test files**
```
src/app/api/bot/whatsapp/webhook/__tests__/webhook.test.ts (Jest)
tests/bot-integration.spec.ts (Playwright)
```

**Acceptance Criteria:**
- Jest runs only unit/integration tests
- Playwright runs only E2E tests
- No test overlap
- Clear separation of concerns

**Timeline:** 1 day

---

### 2.4 Reconcile Schema/Route Field Mismatches (P1)

**Issue:** Routes reference fields not in schema

**Affected Files:**
- `src/app/api/analytics/patient-flow-prediction/route.ts:50`
- `src/app/api/pharmacy/inventory/predict-demand/route.ts:38`
- `prisma/schema.prisma:204, 349`

**Remediation Steps:**

1. **Audit schema vs route usage**
```bash
# Find all Prisma model usages
grep -r "prisma\." src/app/api | grep -E "\.(find|create|update)" > prisma-usage.txt

# Compare with schema
npx prisma schema validate
```

2. **Fix field mismatches**
```typescript
// Before (incorrect):
const predictions = await prisma.patientFlowPrediction.findMany({
  where: { predictedVolume: { gt: 100 } } // Field doesn't exist
});

// After (correct):
const predictions = await prisma.patientFlowPrediction.findMany({
  where: { volume: { gt: 100 } } // Use actual schema field
});
```

3. **Add schema validation tests**
```typescript
// tests/schema-validation.test.ts
import { prisma } from '@/lib/database';

describe('Schema Validation', () => {
  it('should match expected fields', async () => {
    const sample = await prisma.patientFlowPrediction.findFirst();
    expect(sample).toHaveProperty('volume');
    expect(sample).not.toHaveProperty('predictedVolume');
  });
});
```

**Acceptance Criteria:**
- All route queries match schema
- No runtime schema errors
- Schema validation tests added
- Prisma schema validate passes

**Timeline:** 2 days

---

## Phase 3: Improvements and CI Hardening (2-4 weeks)

### 3.1 Sanitize API Error Responses (P2)

**Issue:** Error details leaked in API responses

**Affected File:**
- `src/app/api/admin/executive/intelligence/route.ts:243`

**Remediation Steps:**

1. **Create error response middleware**
```typescript
// src/lib/middleware/errorHandler.ts
export function sanitizeError(error: unknown): { error: string } {
  if (error instanceof Error) {
    // Log full error for debugging
    console.error('API Error:', error);
    
    // Return generic message to client
    return { error: 'An error occurred' };
  }
  
  return { error: 'Unknown error' };
}
```

2. **Apply to all API routes**
```typescript
// src/app/api/admin/executive/intelligence/route.ts
import { sanitizeError } from '@/lib/middleware/errorHandler';

export async function GET(req: NextRequest) {
  try {
    // Route logic
  } catch (error) {
    return NextResponse.json(sanitizeError(error), { status: 500 });
  }
}
```

**Acceptance Criteria:**
- No stack traces in API responses
- No internal details exposed
- Full errors logged server-side
- Generic error messages to clients

**Timeline:** 1 day

---

### 3.2 Remove Daily.co Fallback (P2)

**Issue:** Daily.co fallback still present despite being removed per AGENTS

**Affected File:**
- `src/app/api/teleconsultation/meetings/route.ts:19`

**Remediation Steps:**

1. **Remove Daily.co code**
```typescript
// src/app/api/teleconsultation/meetings/route.ts
// Remove Daily.co imports and fallback logic
// Keep only Google Meet implementation
```

2. **Update documentation**
```typescript
// src/lib/teleconsultation/meeting-service.ts
/**
 * Teleconsultation meeting service
 * 
 * Uses Google Meet API for meeting creation.
 * Daily.co has been removed from the system.
 */
```

**Acceptance Criteria:**
- No Daily.co references
- Google Meet only implementation
- Documentation updated
- AGENTS.md accurate

**Timeline:** 0.5 day

---

### 3.3 Add CI Quality Gates (P0/P1)

**Issue:** No CI gates to prevent merging broken code

**Remediation Steps:**

1. **Update CI workflow with quality gates**
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Type check
        run: |
          cd pulse-core-nextjs
          npm run typecheck
      
      - name: Lint
        run: |
          cd pulse-core-nextjs
          npm run lint
      
      - name: Unit tests
        run: |
          cd pulse-core-nextjs
          npm test
      
      - name: E2E smoke tests
        run: |
          cd pulse-core-nextjs
          npm run test:e2e -- --grep "@smoke"
      
      - name: Security audit
        run: |
          cd pulse-core-nextjs
          npm audit --audit-level=moderate
      
      - name: Prisma validate
        run: |
          cd pulse-core-nextjs
          npx prisma schema validate
      
      - name: Prisma generate
        run: |
          cd pulse-core-nextjs
          npx prisma generate
```

2. **Add branch protection rules**
```yaml
# .github/branch-protection-rules.yml
- Require status checks to pass before merging:
  - typecheck
  - lint
  - unit-tests
  - e2e-smoke-tests
  - security-audit
  - prisma-validate
- Require pull request before merging
- Require approval from code owner
```

**Acceptance Criteria:**
- All quality checks run in CI
- Failed checks block merges
- Branch protection enabled
- No broken code reaches main

**Timeline:** 1 day

---

### 3.4 Add Security and Tenancy Tests (P1)

**Remediation Steps:**

1. **Create authentication test suite**
```typescript
// tests/security/auth.test.ts
describe('Authentication', () => {
  it('should reject unauthenticated requests to admin routes', async () => {
    const response = await fetch('/api/admin/bed/predictive-management');
    expect(response.status).toBe(401);
  });

  it('should reject requests without valid role', async () => {
    const response = await authenticatedFetch('/api/admin/bed/predictive-management', {
      role: 'reception' // Not admin
    });
    expect(response.status).toBe(403);
  });
});
```

2. **Create tenancy test suite**
```typescript
// tests/security/tenancy.test.ts
describe('Tenancy', () => {
  it('should not expose data from other hospitals', async () => {
    const response = await authenticatedFetch('/api/patients?hospitalId=other-hospital');
    expect(response.status).toBe(403);
  });

  it('should derive tenant from session not query', async () => {
    const response = await authenticatedFetch('/api/patients?hospitalId=malicious');
    expect(response.data).not.toContain('malicious');
  });
});
```

**Acceptance Criteria:**
- All admin routes have auth tests
- All routes have tenancy tests
- Tests run in CI
- Coverage > 80%

**Timeline:** 3 days

---

## Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Critical Security | 7 days | Day 0 | Day 7 |
| Phase 2: Reliability | 7 days | Day 7 | Day 14 |
| Phase 3: CI Hardening | 14 days | Day 14 | Day 28 |

**Total Timeline:** 28 days (4 weeks)

## Success Criteria

### Phase 1 Success
- ✅ All admin routes protected by authentication
- ✅ Webhook signatures verified
- ✅ OTP properly generated and validated
- ✅ Build completes successfully
- ✅ npm run typecheck passes
- ✅ npm run lint passes

### Phase 2 Success
- ✅ All routes return NextResponse
- ✅ No `any` in database layer
- ✅ Tests properly separated
- ✅ Schema matches route usage
- ✅ npm test passes

### Phase 3 Success
- ✅ Error responses sanitized
- ✅ Daily.co removed
- ✅ CI quality gates active
- ✅ Security tests added
- ✅ npm run test:e2e passes
- ✅ npm audit passes

### Overall Success
- ✅ Overall rating > 8/10
- ✅ Security rating > 8/10
- ✅ Production ready
- ✅ All automated checks pass

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking changes | Medium | High | Test in staging first, rollback plan ready |
| Database migration failure | Low | Critical | Backup before migration, test on copy |
| Webhook downtime | Low | High | Deploy during low traffic, monitor closely |
| Type safety regressions | Medium | Medium | Strict TypeScript, CI gates |

## Rollback Plan

If critical issues arise during deployment:

1. **Immediate rollback:** Revert to previous commit
2. **Database rollback:** Use Prisma migration rollback
3. **Feature flags:** Disable new features via environment variables
4. **Monitoring:** Monitor error rates and user reports

## Next Steps

1. Review this plan with security team
2. Get approval for Phase 1 changes
3. Begin Phase 1 implementation
4. Daily standups to track progress
5. Weekly reviews to adjust plan as needed

---

**Document Owner:** Development Team  
**Last Updated:** April 19, 2026  
**Next Review:** April 26, 2026
