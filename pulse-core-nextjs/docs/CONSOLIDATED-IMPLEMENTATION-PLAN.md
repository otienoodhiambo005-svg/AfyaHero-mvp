# AfyaHero Consolidated Implementation Plan

**Generated:** April 29, 2026
**Sources:** PORTAL_AUDIT_2026.md, SECURITY-REMEDIATION-PLAN.md, IMPROVEMENT-IMPLEMENTATION-PLAN.md, IMPLEMENTATION-PLAN-TYPE-SAFETY.md, DESIGN_MODERNIZATION_CHARTER.md, GDPR-SHIF-COMPLIANCE-AUDIT.md, PRE-LAUNCH-CHECKLIST.md, AI_MONITORING.md, AI_DEPLOYMENT_CHECKLIST.md, DATABASE-PERFORMANCE-MONITORING.md, CODE-REVIEW-CHECKLIST.md

---

## Completed Work (Sessions 1–11)

| Phase | Status | Details |
|-------|--------|---------|
| Phase A — Foundations | ✅ | StatusBadge, SeverityChip, PriorityDot, LoadingState, ErrorState, ResponsiveDataTable, DemoOnlyBanner, Skeleton, useDemoSession, SuperAdminSidebar responsive |
| Phase B — Color/token sweep | ✅ | All 6 portals: superadmin → admin → medical → lab → pharmacy → reception. Hardcoded colors replaced with StatusBadge |
| Phase D — A11y + perf | ✅ | VirtualizedDataTable (zero-dep IntersectionObserver). Auto-virtualizes >100 rows |
| Phase E — Aesthetic | ✅ | Skeleton shimmer, SkeletonText/Avatar/Card, KPICardSkeleton, Lucide iconography pass |
| Command Palette (⌘K) | ✅ | `CommandPalette.tsx` — fuzzy search, keyboard nav, recent items, in sidebar |
| Tenant Heatmap | ✅ | `TenantHeatmap.tsx` — status cards, county distribution, filter-to-hospitals |
| Formulary colors | ✅ | `LEVEL_STYLE` → `StatusBadge` + `LEVEL_TONE` mapping |
| AI `any` types | ✅ | Zero `any` in AI provider files |
| Cementing — enforceApiGuard | ✅ | 73+ routes, auto-deny demo on mutating methods |
| Cementing — tenant isolation | ✅ | session.hospitalId filtering in queries |

---

## Outstanding Items — Prioritized & Categorized

### 🔴 P0 — Must-do before any production deployment

#### 1. Security: Webhook signature verification
**Source:** SECURITY-REMEDIATION-PLAN.md §1.2
**Files:** `src/lib/bot/whatsapp-bot.ts`, `src/app/api/bot/whatsapp/webhook/route.ts`, `src/app/api/bot/ussd/webhook/route.ts`
**Problem:** WhatsApp signature check returns `true` unconditionally; USSD has no verification
**Recommendation:** Implement HMAC-SHA256 verification using `WHATSAPP_WEBHOOK_SECRET` / `USSD_WEBHOOK_SECRET` env vars. Use `crypto.timingSafeEqual` to prevent timing attacks.
**Effort:** 1 day

#### 2. Security: Remove hardcoded OTP
**Source:** SECURITY-REMEDIATION-PLAN.md §1.3
**File:** `src/lib/bot/bot-auth.ts:165`
**Problem:** OTP hardcoded to `123456`
**Recommendation:** Replace with `crypto.randomInt(100000, 999999)`. Add 10-min expiry, 3-attempt lockout, in-memory store (upgrade to Redis later).
**Effort:** 1 day

#### 3. Security: Unguarded admin/analytics routes
**Source:** SECURITY-REMEDIATION-PLAN.md §1.1
**Files:** `admin/bed/predictive-management`, `admin/executive/intelligence`, `admin/quality/intelligence`, `analytics/patient-flow-prediction`, `pharmacy/inventory/predict-demand`
**Problem:** These routes accept `hospitalId` from query params instead of session, enabling cross-tenant data access
**Recommendation:** Already partially addressed by `withAuthzAndTenant` wrapper. Verify all 5 routes use it. Remove `req.nextUrl.searchParams.get('hospitalId')` patterns.
**Effort:** 1 day

#### 4. AI Cost Trend component
**Source:** PORTAL_AUDIT_2026.md — Superadmin P0
**File:** New `src/components/ui/AICostTrend.tsx`
**Problem:** Superadmin has no visibility into per-provider AI spend
**Recommendation:** Build stacked bar chart showing daily cost by provider (HuggingFace, Groq, Gemini, OpenAI, Claude). Data from `/api/monitoring/metrics` or new `/api/superadmin/ai-costs` endpoint. Include budget line, trend arrow, and provider breakdown table.
**Effort:** 1 day

#### 5. E2E test coverage for auth matrix
**Source:** PORTAL_AUDIT_2026.md — Cementing definition, SECURITY-REMEDIATION-PLAN.md §3.4
**File:** `tests/portal-auth-matrix.spec.ts` (scaffold exists)
**Problem:** Only scaffolded, no authenticated session tests
**Recommendation:** Add Playwright tests for: (a) each role can access its portal, (b) each role is denied other portals, (c) demo session blocked from mutating endpoints, (d) cross-tenant data access blocked.
**Effort:** 2 days

---

### 🟠 P1 — Should-do before launch

#### 6. Type safety: Remove `any` from database.ts
**Source:** IMPLEMENTATION-PLAN-TYPE-SAFETY.md §Phase 2, SECURITY-REMEDIATION-PLAN.md §2.2
**File:** `src/lib/database.ts` (8 `any` instances)
**Recommendation:** Use Prisma generated types for query results. Add `Prisma.Result` utility types. Keep `getTenantPrismaClient` args as `Record<string, unknown>` (not `any`).
**Effort:** 1 day

#### 7. Type safety: Remove `any` from remaining 27 files
**Source:** IMPLEMENTATION-PLAN-TYPE-SAFETY.md
**Files:** `performance-optimization.ts` (7), `settings/*.ts` (15), `microservices-client.ts` (5), `speech-service.ts` (5), `compliance/*.ts` (6), others
**Recommendation:** Prioritize API routes and service files. Use Zod schemas for runtime validation. Replace `any` with `unknown` + type guards as minimum.
**Effort:** 3 days

#### 8. Route handler return contracts
**Source:** SECURITY-REMEDIATION-PLAN.md §2.1
**Problem:** Some routes return session objects instead of NextResponse
**Recommendation:** Grep for `return session` patterns in API routes. Ensure all handlers return `NextResponse.json(...)`.
**Effort:** 1 day

#### 9. Schema/route field mismatches
**Source:** SECURITY-REMEDIATION-PLAN.md §2.4
**Files:** `analytics/patient-flow-prediction`, `pharmacy/inventory/predict-demand`
**Problem:** Routes reference fields not in Prisma schema
**Recommendation:** Run `npx prisma validate`. Audit all `prisma.model.findMany` calls for non-existent fields. Add schema validation test.
**Effort:** 2 days

#### 10. Error response sanitization
**Source:** SECURITY-REMEDIATION-PLAN.md §3.1
**Problem:** Stack traces and internal details leaked in 500 responses
**Recommendation:** Create `sanitizeError()` utility. Apply in catch blocks across API routes. Log full error server-side, return generic message to client.
**Effort:** 1 day

#### 11. Daily.co removal verification
**Source:** SECURITY-REMEDIATION-PLAN.md §3.2
**File:** `src/app/api/teleconsultation/meetings/route.ts`
**Recommendation:** Grep for `daily` / `Daily.co` references. Remove any remaining fallback logic.
**Effort:** 0.5 day

#### 12. Design system documentation
**Source:** DESIGN_MODERNIZATION_CHARTER.md §Workstream 1
**Files:** `docs/design/tokens.md` (exists), `docs/design/component-standards.md` (exists), `docs/design/theme-strategy.md` (missing)
**Recommendation:** Create `theme-strategy.md` with portal accent policy, contrast rules, dark mode mapping. Update tokens.md with new semantic tokens added in Phase B.
**Effort:** 1 day

#### 13. GDPR: Automated data retention
**Source:** GDPR-SHIF-COMPLIANCE-AUDIT.md §1.5
**Problem:** Data deletion is manual; no automated retention enforcement
**Recommendation:** Add a cron job or API route that purges records past retention period. Start with AuditLog (configurable retention in settings). Add `DataRetentionJob` to monitoring dashboard.
**Effort:** 2 days

---

### 🟡 P2 — Should-do for production quality

#### 14. Phase C: Per-portal feature elevation
**Source:** PORTAL_AUDIT_2026.md §Phase C
**Scope:** 99 screens across 6 portals. Highest-leverage items:
  - **Reception:** Queue live-update (SSE), check-in wizard, billing M-Pesa STK
  - **Medical:** Consultation live transcript, handover SBAR, critical-results attestation
  - **Lab:** QC Levey-Jennings charts, barcode workflow
  - **Pharmacy:** Dispensing workflow, adherence tracking
  - **Admin:** Revenue cycle dashboard, claims state machine
  - **Superadmin:** AI-cost trend (item 4 above), system health deep-link
**Recommendation:** Tackle portal-by-portal in sprints. Each sprint delivers 2–3 screens per portal. Start with medical (highest clinical safety impact).
**Effort:** 4–6 weeks (multiple cycles)

#### 15. CI quality gates
**Source:** SECURITY-REMEDIATION-PLAN.md §3.3, PRE-LAUNCH-CHECKLIST.md
**Problem:** No CI gates prevent merging broken code
**Recommendation:** Add GitHub Actions workflow with: typecheck → lint → unit tests → E2E smoke → security audit → prisma validate. Require all pass before merge.
**Effort:** 1 day

#### 16. Database performance monitoring
**Source:** DATABASE-PERFORMANCE-MONITORING.md
**Problem:** No slow query logging or connection pool monitoring in production
**Recommendation:** Enable Prisma query logging with `SLOW_QUERY_THRESHOLD=1000`. Add connection pool metrics to `/api/monitoring/metrics`. Create Grafana dashboard (or superadmin system health page).
**Effort:** 2 days

#### 17. Settings UI improvements
**Source:** IMPROVEMENT-IMPLEMENTATION-PLAN.md §5.2
**Tasks:** Unsaved changes indicator, auto-save (30s), settings search/filter, comparison view
**Recommendation:** Lower priority — settings module is functional. Tackle after P0/P1 items.
**Effort:** 1 week

#### 18. Accessibility compliance sweep
**Source:** DESIGN_MODERNIZATION_CHARTER.md §Workstream 3, PORTAL_AUDIT_2026.md §6
**Scope:** Missing aria-labels on icon buttons, non-semantic containers, insufficient focus rings
**Recommendation:** Run automated a11y audit (axe-core). Fix critical issues. Add keyboard nav test matrix for core flows.
**Effort:** 3 days

---

### 🟢 P3 — Nice-to-have / future cycles

#### 19. Portal UX unification (Glassboard pattern)
**Source:** DESIGN_MODERNIZATION_CHARTER.md §Workstream 2
**Scope:** Standardize page skeleton across all portals (header, KPI strip, pulse row, work area, side intelligence)
**Effort:** 2 weeks

#### 20. Load testing
**Source:** IMPROVEMENT-IMPLEMENTATION-PLAN.md §10.1, PRE-LAUNCH-CHECKLIST.md
**Recommendation:** Use k6 or Artillery. Target: 500 concurrent users, <500ms P95 API response.
**Effort:** 3 days

#### 21. Team training & onboarding docs
**Source:** IMPROVEMENT-IMPLEMENTATION-PLAN.md §6.2
**Effort:** 2 days

---

## Recommended Execution Order

```
Week 1:  Items 1–3  (Security P0: webhooks, OTP, unguarded routes)
Week 2:  Items 4–5  (AI cost trend, E2E auth tests)
Week 3:  Items 6–9  (Type safety: any removal, return contracts, schema mismatches)
Week 4:  Items 10–13 (Error sanitization, Daily.co, design docs, GDPR retention)
Week 5+: Items 14–18 (Phase C features, CI gates, DB monitoring, settings UI, a11y)
Future:  Items 19–21 (Glassboard, load testing, training)
```

## Verification Commands

After each item, run:
```bash
cd pulse-core-nextjs
npm run typecheck   # Must exit 0
npm run lint        # Must exit 0
npm run test        # Playwright E2E (when applicable)
```

## Pre-Launch Gate (from PRE-LAUNCH-CHECKLIST.md)

Before any production deployment, ALL of the following must pass:
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` succeeds
- [ ] All P0 security items (1–3) resolved
- [ ] E2E auth matrix tests pass
- [ ] No hardcoded OTP or webhook bypass
- [ ] All API routes return NextResponse
- [ ] Error responses sanitized (no stack traces)
- [ ] CI quality gates active
