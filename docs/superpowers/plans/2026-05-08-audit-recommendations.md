# Audit Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the high-priority backend, frontend, and full-stack audit findings without broad refactors.

**Architecture:** Keep fixes local to the failing runtime, tenant-bound API, authentication UI, E2E fixture, and ESLint configuration surfaces. Prefer deriving tenant context from existing guard/session helpers, keeping route handlers on the default Node.js runtime, and improving accessibility with native HTML associations.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Playwright, ESLint 9 flat config, React client components.

---

### Task 1: Restore Prisma Runtime Compatibility

**Files:**
- Modify: `pulse-core-nextjs/src/lib/database.ts`
- Modify: `pulse-core-nextjs/package.json`
- Modify: `pulse-core-nextjs/package-lock.json`

- [x] **Step 1: Inspect Prisma client construction**

Run: `rg -n "engineType|new _PrismaClient|generator client" pulse-core-nextjs/src/lib/database.ts pulse-core-nextjs/prisma/schema.prisma`

- [x] **Step 2: Provide the Prisma Postgres driver adapter**

Add the official Prisma `pg` adapter and instantiate Prisma Client with it so the generated Prisma 7 client-engine runtime has the required database adapter.

- [ ] **Step 3: Verify targeted runtime**

Run: `npm run typecheck`, `npm run lint`, and the representative Playwright auth subset.

### Task 2: Enforce Tenant Source of Truth in API Routes

**Files:**
- Modify: `pulse-core-nextjs/src/app/api/admin/public-health/outbreak-detection/route.ts`
- Modify: `pulse-core-nextjs/src/app/api/reception/appointments/google-calendar/route.ts`
- Modify: `pulse-core-nextjs/src/app/api/ai/pharmacy/microservice/route.ts`

- [x] **Step 1: Derive `hospitalId` from guard/session**

Use `enforceApiGuard` or existing session helpers so tenant-scoped routes use `session.hospitalId`, not query/body tenant values.

- [x] **Step 2: Reject missing tenant context**

Return `403` when the authenticated session has no hospital binding for hospital-scoped endpoints.

- [x] **Step 3: Preserve existing payload validation**

Keep existing `patientId`, medication, drug name, and service validation behavior intact.

### Task 3: Remove Edge-Incompatible Logger Import Path

**Files:**
- Modify: `pulse-core-nextjs/src/lib/logger.ts`
- Modify: `pulse-core-nextjs/instrumentation.ts`

- [x] **Step 1: Avoid Node `crypto` in shared logger imports**

Generate request IDs with `globalThis.crypto.randomUUID()` when available and a timestamp fallback otherwise.

- [x] **Step 2: Avoid importing logger in Edge instrumentation**

Keep Sentry initialization but prevent `instrumentation.ts` from pulling the shared logger into Edge runtime compilation.

### Task 4: Improve Login Accessibility and Test Selectors

**Files:**
- Modify: `pulse-core-nextjs/src/components/auth/PortalLogin.tsx`
- Modify: `pulse-core-nextjs/src/components/auth/MedicalPortalLogin.tsx`

- [x] **Step 1: Add explicit input labels**

Add stable `id`, `name`, `autoComplete`, and `htmlFor` bindings for login and forgot-password inputs.

- [x] **Step 2: Add accessible names for icon-only buttons**

Add `aria-label` for password visibility toggles and mark icons decorative where appropriate.

- [x] **Step 3: Improve error announcement**

Use `role="alert"` and `aria-live` on login and modal error messages.

### Task 5: Stabilize Playwright Fixture and ESLint Rules

**Files:**
- Modify: `pulse-core-nextjs/tests/fixtures/auth.ts`
- Modify: `pulse-core-nextjs/eslint.config.mjs`
- Modify: `pulse-core-nextjs/src/app/api/reception/queue/route.ts`

- [x] **Step 1: Navigate before clearing page storage**

Change `ensureLoggedOut` so storage clearing runs from the application origin instead of a blank/security-restricted document.

- [x] **Step 2: Port critical rules into ESLint flat config**

Add the important strict rules from `.eslintrc.json` to `eslint.config.mjs`: `no-console`, `prefer-const`, TypeScript unsafe warnings, and core jsx-a11y checks including form labels and icon button names.

- [x] **Step 3: Keep demo queue reads non-fatal when the database is unavailable**

Return an empty seeded-data-compatible response for demo queue GETs when the database cannot be reached, while returning a service error for real sessions.

### Task 6: Verification

**Files:**
- No new source files.

- [x] **Step 1: Run targeted checks**

Run:
`npx eslint src/lib/database.ts src/lib/logger.ts src/components/auth/PortalLogin.tsx src/components/auth/MedicalPortalLogin.tsx tests/fixtures/auth.ts`

- [x] **Step 2: Run project checks**

Run:
`npm run typecheck`
`npm run lint`
`npm run test`
`npm run build`

- [x] **Step 3: Run representative Playwright subset**

Run:
`npx playwright test tests/e2e/api/auth-matrix.spec.ts tests/e2e/portal/login.spec.ts --project=chromium --reporter=line --workers=1`
