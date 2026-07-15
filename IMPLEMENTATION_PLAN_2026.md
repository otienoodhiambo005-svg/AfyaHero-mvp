# AfyaHero Implementation Plan 2026
## Post-Audit Recommended Changes

**Date:** April 22, 2026  
**Based on:** AUDIT_REPORT_2026.md  
**Priority:** P0 (Critical) → P3 (Low)

---

## Quick Reference: Issues by Priority

| Priority | Count | Effort | Timeline |
|----------|-------|--------|----------|
| P0 - Critical | 1 | 1 day | Immediate |
| P1 - High | 3 | 3 days | Week 1 |
| P2 - Medium | 6 | 5 days | Week 2 |
| P3 - Low | 8 | 3 days | Week 3-4 |

---

## Phase 1: Critical Fixes (P0)

### P0-01: Eliminate Console.log Violations
**Impact:** ESLint errors block production builds  
**Files:** 21 files with 49 instances

```bash
# Quick grep to find all occurrences
grep -r "console\.log\|console\.error\|console\.warn" --include="*.ts" --include="*.tsx" src/ | grep -v "logger.ts"
```

**Files to modify:**
- `src/lib/security-audit.ts` (7 matches)
- `src/hooks/useTeleconsult.ts` (6 matches)
- `src/lib/speech-service.ts` (6 matches)
- `src/app/api/afyalink/callback/route.ts` (3 matches)
- `src/app/auth/register-facility/page.tsx` (3 matches)
- `src/hooks/useAfyaAIChat.ts` (3 matches)
- Plus 15 more files...

**Implementation:**
```typescript
// BEFORE (security-audit.ts:45)
console.log('Security audit started:', { userId, action });

// AFTER
import logger from '@/lib/logger';
logger.info('Security audit started', { userId, action });
```

**Verification:**
```bash
npm run lint
# Should show 0 console-related errors
```

---

## Phase 2: High Priority Fixes (P1)

### P1-01: Fix TypeScript Type Cast in Layout
**File:** `src/app/layout.tsx:99`

```typescript
// BEFORE
{children as ReactNode}

// AFTER
{children}
```

**Reason:** Type already inferred from props type `Readonly<{ children: React.ReactNode }>`

---

### P1-02: Add Error Boundaries to Portal Routes
**Files to create:**
- `src/app/portal/medical/error.tsx`
- `src/app/portal/admin/error.tsx`
- `src/app/portal/reception/error.tsx`
- `src/app/portal/lab/error.tsx`
- `src/app/portal/pharmacy/error.tsx`

**Implementation template:**
```typescript
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Portal error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-ink mb-2">Something went wrong</h2>
        <p className="text-slate mb-6">An error occurred in the portal. Please try again.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-emerald text-white rounded-card hover:bg-emerald/90"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-content-border rounded-card hover:bg-content-surface"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

### P1-03: Add Image Priority for LCP Elements
**Files to review:**
- `src/app/page.tsx` - Hero images
- `src/app/layout.tsx` - Preloaded images
- Portal dashboard headers

**Implementation:**
```typescript
// Add priority to above-the-fold images
<Image
  src="/afyahero-icon.jpeg"
  alt="AfyaHero"
  width={56}
  height={56}
  priority  // Add this
  className="rounded-2xl"
/>
```

---

## Phase 3: Medium Priority Improvements (P2)

### P2-01: Standardize API Error Responses
**Create:** `src/lib/api-response.ts`

```typescript
export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, string[]>;
  requestId: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export function createErrorResponse(
  message: string,
  code: string,
  status: number,
  details?: Record<string, string[]>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      requestId: crypto.randomUUID(),
    },
    { status }
  );
}
```

**Apply to:** All API routes in `src/app/api/`

---

### P2-02: Add Unsaved Changes Warning to Forms
**Files:**
- PatientRegistrationForm
- PrescriptionBuilder
- SOAPEditor

**Implementation:**
```typescript
'use client';

import { useEffect } from 'react';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';

export function useUnsavedChangesWarning(isDirty: boolean) {
  useBeforeUnload(isDirty);
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
```

---

### P2-03: Fix useEffect Dependencies
**Files with incomplete deps:**
- `src/components/portal/PortalShell.tsx`
- `src/hooks/useTeleconsult.ts`
- `src/hooks/useAfyaAIChat.ts`

**Example fix:**
```typescript
// BEFORE
useEffect(() => {
  fetchData();
}, []); // Missing dependencies

// AFTER
useEffect(() => {
  fetchData();
}, [fetchData, userId, hospitalId]); // Complete dependencies
```

---

### P2-04: Add ARIA Labels to Icon-Only Buttons
**Files to update:**
- PortalShell.tsx (LogOut button)
- Any button with only an icon

```typescript
// BEFORE
<button onClick={handleLogout}>
  <LogOut className="w-4 h-4" />
</button>

// AFTER
<button 
  onClick={handleLogout}
  aria-label="Log out of portal"
>
  <LogOut className="w-4 h-4" aria-hidden="true" />
</button>
```

---

### P2-05: Add Loading Skeletons
**Components needing skeletons:**
- DataTable.tsx
- PatientDetailPanel.tsx
- Dashboard KPI cards

**Implementation:**
```typescript
// components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "animate-pulse bg-content-border rounded", 
        className
      )} 
    />
  );
}

// Usage in component
{isLoading ? (
  <div className="space-y-3">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-3/4" />
  </div>
) : (
  <ActualContent />
)}
```

---

### P2-06: Standardize Touch Targets (Mobile)
**Minimum size: 44x44px**

**Files to review:**
- Navigation items in PortalShell
- Table action buttons
- Form submit buttons on mobile

```css
/* Add to globals.css */
@media (max-width: 768px) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}
```

---

## Phase 4: Low Priority Polish (P3)

### P3-01: Remove Commented Code
**Files with commented code:**
- Various component files
- Test files

**Action:** Search and remove or document why kept

### P3-02: Extract Magic Numbers
**Examples:**
```typescript
// BEFORE
const MAX_AGE = 8 * 60 * 60;

// AFTER
const SESSION_MAX_AGE_HOURS = 8;
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_HOURS * 60 * 60;
```

### P3-03: Unify Quote Style
**Current:** Mixed single and double quotes
**Standard:** Single quotes for strings

### P3-04: Add Exit Animation to Toasts
**File:** `src/lib/toast.tsx`

Add Framer Motion exit animations for smoother UX.

### P3-05: Improve Offline Indicator Visibility
**File:** `src/components/network-status-banner.tsx`

Make the offline indicator more prominent with animation.

### P3-06: Add Request ID Propagation
**File:** `src/lib/logger.ts`

Ensure all API requests include requestId in logs for tracing.

---

## Testing Strategy

### Unit Tests
```bash
# Add for new utilities
npm run test -- src/lib/api-response.test.ts
npm run test -- src/hooks/useUnsavedChangesWarning.test.ts
```

### E2E Tests
```bash
# Run existing CTA workflow tests
npm run test:ctas

# Add new tests for error boundaries
npm run test -- tests/error-boundaries.spec.ts
```

### Lint Verification
```bash
npm run lint
npm run typecheck
```

---

## Rollout Plan

### Week 1: Critical & High
- Day 1-2: Fix console.log violations
- Day 3-4: Fix type issues and add error boundaries
- Day 5: Image priority and initial testing

### Week 2: Medium Priority
- Day 1-2: API response standardization
- Day 3-4: Form improvements and useEffect fixes
- Day 5: Skeleton loading states

### Week 3: Low Priority & Polish
- Day 1-2: Code cleanup (comments, quotes)
- Day 3-4: Animation and visual polish
- Day 5: Final testing

### Week 4: Validation
- Full regression testing
- Performance audit
- Accessibility audit
- Production deployment

---

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| ESLint errors | 49 console | 0 | `npm run lint` |
| TypeScript strict | 47 any | < 20 | `grep -r "any" --include="*.ts" src/ \| wc -l` |
| Test coverage | ~60% | > 75% | `npm run test:coverage` |
| Lighthouse | TBD | > 90 | Chrome DevTools |
| Accessibility | TBD | WCAG 2.1 AA | axe-core |

---

## Dependencies

No new dependencies required. All improvements use existing:
- logger.ts (already exists)
- Next.js error.tsx pattern (native)
- Tailwind classes (already available)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Low | Medium | Comprehensive testing |
| Performance regression | Low | High | Lighthouse CI |
| Accessibility regression | Low | Medium | axe-core testing |
| Merge conflicts | Medium | Low | Small, focused PRs |

---

## Appendix: File Change Summary

### Phase 1 (P0)
- `src/lib/security-audit.ts` - Replace 7 console calls
- `src/hooks/useTeleconsult.ts` - Replace 6 console calls
- `src/lib/speech-service.ts` - Replace 6 console calls
- Plus 18 more files

### Phase 2 (P1)
- `src/app/layout.tsx` - Remove type cast
- `src/app/portal/*/error.tsx` - Create 5 files
- Multiple image components - Add priority

### Phase 3 (P2)
- `src/lib/api-response.ts` - Create new
- `src/hooks/useUnsavedChangesWarning.ts` - Create new
- `src/components/ui/Skeleton.tsx` - Create new
- 15+ component files - Add skeletons
- 10+ hook files - Fix dependencies

### Phase 4 (P3)
- 20+ files - Code cleanup
- `src/lib/toast.tsx` - Add animations

---

*Plan created: April 22, 2026*
*Review cycle: Weekly during implementation*
