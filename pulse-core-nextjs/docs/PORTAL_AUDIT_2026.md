# AfyaHero Portal & Screen Audit

Generated for the Hospital OS uplift cycle. Inventories every portal screen with
prioritized enhancement, upgrade, bug-fix, aesthetic, and feature-cementing
recommendations. Use this as the working backlog.

## Portal Inventory

| Portal      | Screens | Role            |
| ----------- | ------- | --------------- |
| Reception   | 13      | `reception`     |
| Medical     | 32      | `medical`       |
| Lab         | 10      | `lab`           |
| Pharmacy    | 11      | `pharmacy`      |
| Admin       | 19      | `admin`         |
| Superadmin  | 14      | `super_admin`   |
| **Total**   | **99**  | —               |

## Cross-Cutting Findings (apply everywhere)

These should land before per-portal polish, because they raise the floor of
every screen.

### 1. Hardcoded Tailwind colors (P0)

- **Symptom**: thousands of `bg-red-600`, `text-amber-700`, etc., across
  portal pages drift from the design tokens.
- **Action**: introduce shared status/severity components and replace inline
  colors:
  - `<StatusBadge status="critical" />`
  - `<SeverityChip level="high" />`
  - `<PriorityDot priority="urgent" />`
- **Side effect**: consistent dark mode + theming readiness.

### 2. Inconsistent page header pattern (P1)

- **Symptom**: each page hand-rolls a header. Spacing, breadcrumbs, and
  action buttons drift.
- **Action**: enforce `<PageLayout title subtitle actions breadcrumbs>` on
  every screen. Add `<PageHeaderSkeleton>` for loading states.

### 3. Empty/loading/error states are ad-hoc (P1)

- **Symptom**: many screens render a bare "No data" string or a raw `<div>`
  during loading.
- **Action**: standardize on `<EmptyState>`, `<LoadingState>`, `<ErrorState>`
  components. Already have `EmptyState` — extend.

### 4. Demo-mode UX (P1)

- **Symptom**: demo sessions can browse screens that mutate, hitting 403s
  silently.
- **Action**: add a `useDemoSession()` hook + `<DemoOnlyBanner>` that disables
  CTA buttons in demo mode and surfaces a "switch to live account" call-out.

### 5. Mobile responsiveness (P1)

- **Symptom**: superadmin layout uses `ml-64` with no collapse; many tables
  overflow on narrow viewports.
- **Action**:
  - Make every sidebar collapsible (`PortalShell` already handles this for
    hospital portals — port to `SuperAdminSidebar`).
  - Replace dense tables with `<ResponsiveDataTable>` (cards on `<md`).

### 6. Accessibility (P1)

- **Symptom**: missing `aria-label` on icon-only buttons; non-semantic
  containers used for navigation; insufficient focus rings.
- **Action**: a11y sweep using the `accessibility-compliance` skill.

### 7. Performance (P2)

- **Symptom**: many "use client" pages do heavy filtering client-side; some
  re-render entire tables on every keystroke.
- **Action**: virtualization via `@tanstack/react-virtual` on lists >100 rows;
  `useDeferredValue` for search inputs.

## Reception Portal

`@/src/app/portal/reception/`

| Screen               | Path                          | Top P0/P1 Items |
| -------------------- | ----------------------------- | --------------- |
| Dashboard            | `page.tsx`                    | Replace inline KPI tiles with `<KPICard>` grid; add today's queue snapshot. |
| Queue                | `queue/page.tsx`              | Live-update via SSE; mark at-risk waits in red; add bulk-triage CTA. |
| Check-in             | `checkin/page.tsx`            | Two-step wizard (verify ID → assign queue); SHIF eligibility lookup inline. |
| Patients             | `patients/page.tsx`           | Server-side search; recent patients chips; merge-duplicate flow. |
| Appointments         | `appointments/page.tsx`       | Timeline view; conflict detection; drag-to-reschedule. |
| Beds                 | `beds/page.tsx`               | Floor-plan visualization; bed-status legend. |
| Billing              | `billing/page.tsx`            | Itemized invoice editor; payment status pills; M-Pesa STK trigger. |
| Orders               | `orders/page.tsx`             | Order routing badges; ACK timing SLA chips. |
| Finance              | `finance/page.tsx`            | Daily collection summary; reconciliation export. |
| ID Check             | `id-check/page.tsx`           | Webcam + barcode scanner hybrid; confidence score. |
| Reports              | `reports/page.tsx`            | Date range presets; CSV/PDF export; saved views. |
| DAWA                 | `dawa/page.tsx`               | Conversation history; reception-specific intents. |
| Settings             | `settings/page.tsx`           | Rolled into PortalShell preferences. |

## Medical Portal

`@/src/app/portal/medical/`

Highest-leverage portal — clinical safety + AI features.

| Screen                       | Path                              | Top Items |
| ---------------------------- | --------------------------------- | --------- |
| Doctor Dashboard             | `page.tsx`                        | Hero KPIs + queue + tasks already strong; add critical results banner. |
| Doctor Detailed Dashboard    | `dashboard/page.tsx`              | Merge with `page.tsx` — currently duplicate intents. |
| Patients                     | `patients/page.tsx`               | Server search; longitudinal record drawer. |
| Patient Queue                | `queue/page.tsx`                  | Visual triage acuity badges; pull-from-queue gesture. |
| Consultation                 | `consultation/page.tsx`           | Live transcript pane; SOAP autosave; AI suggestions sidebar. |
| Diagnosis                    | `diagnosis/page.tsx`              | Differential ranking by confidence; ICD-10 picker. |
| Prescriptions                | `prescriptions/page.tsx`          | Drug interaction check inline; formulary substitution. |
| Lab                          | `lab/page.tsx`                    | Trend graphs for repeat tests; abnormal flag column. |
| Results                      | `results/page.tsx`                | Critical-result attestation flow. |
| Orders                       | `orders/page.tsx`                 | Bundled order sets; SLA progress bars. |
| Observations                 | `observations/page.tsx`           | Vitals trend chart; abnormal alerts. |
| Vitals                       | `vitals/page.tsx`                 | Quick-entry pad for nurses; auto-derive BMI. |
| Inventory (ward consumables) | `inventory/page.tsx`              | Par-level alerts; quick reorder. |
| Medications (MAR)            | `medications/page.tsx`            | Time-grid MAR view; missed-dose alerts. |
| Beds                         | `beds/page.tsx`                   | Allocation drag-drop; expected discharge timer. |
| Handover                     | `handover/page.tsx` + `[id]`      | SBAR template; ack tracking; voice-note attachments. |
| Shift Notes                  | `shiftnotes/page.tsx`             | Threaded notes; cross-shift continuity. |
| Tele-consultation            | `teleconsultation/page.tsx`       | Already integrated with Google Meet/Vertex AI; add waitroom mgmt. |
| Referrals                    | `referrals/page.tsx`              | Referral pipeline kanban; outbound tracking. |
| Quality                      | `quality/page.tsx`                | Incident reporter; root-cause categorization. |
| Reports                      | `reports/page.tsx`                | Doctor productivity; turn-around times. |
| Billing                      | `billing/page.tsx`                | Doctor-side cost transparency for patient counseling. |
| Finance                      | `finance/page.tsx`                | Personal earnings (where applicable). |
| Formulary                    | `formulary/page.tsx`              | Local formulary tags; substitutability hints. |
| Staff                        | `staff/page.tsx`                  | Reduce to "my team" view; promote to admin for full mgmt. |
| Nurse — Tasks                | `nurse/tasks/page.tsx`            | Task SLA timers; auto-escalate. |
| Nurse — Vitals               | `nurse/vitals/page.tsx`           | Same as `vitals` but with patient picker. |
| Nurse — Wards                | `nurse/wards/page.tsx`            | Ward roster; round-completion checklist. |
| Check-in (clinical)          | `checkin/page.tsx`                | Dedup with reception version or remove. |
| Settings                     | `settings/page.tsx`               | Unify with PortalShell preferences. |
| DAWA                         | `dawa/page.tsx`                   | Clinical-domain DAWA persona. |

### Medical-portal P0 bug-fix candidates

- Several pages call AI providers with `any` types (forbidden by AGENTS rule).
- `formulary/page.tsx` has 45 hardcoded color matches — high drift.
- `medications/page.tsx` MAR grid likely has timezone bugs near midnight.

## Lab Portal

`@/src/app/portal/lab/`

| Screen      | Path                  | Top Items |
| ----------- | --------------------- | --------- |
| Dashboard   | `page.tsx`            | Pending sample KPIs; STAT count; bench utilization. |
| Queue       | `queue/page.tsx`      | Sample workflow lanes (pending → processing → verified). |
| Orders      | `orders/page.tsx`     | Barcode label printing; chain-of-custody trail. |
| Results     | `results/page.tsx`    | Verifier dual-control; abnormal/critical flags. |
| Patients    | `patients/page.tsx`   | Patient context drawer; prior result trends. |
| Inventory   | `inventory/page.tsx`  | Reagent expiry alerts; lot tracking. |
| Quality     | `quality/page.tsx`    | QC chart (Levey-Jennings); rule violations. |
| Reports     | `reports/page.tsx`    | TAT analysis; scientist productivity. |
| DAWA        | `dawa/page.tsx`       | Lab-specific persona. |
| Settings    | `settings/page.tsx`   | Reference range editor. |

## Pharmacy Portal

`@/src/app/portal/pharmacy/`

| Screen      | Path                  | Top Items |
| ----------- | --------------------- | --------- |
| Dashboard   | `page.tsx`            | Dispensing throughput; low-stock alerts; expiry watch. |
| Queue       | `queue/page.tsx`      | Triaged prescription queue; insurance-pending lane. |
| Orders      | `orders/page.tsx`     | Substitution decisions logged; pricing override audit. |
| Formulary   | `formulary/page.tsx`  | Local list management; ATC classification. |
| Inventory   | `inventory/page.tsx`  | Multi-location stock; batch/expiry; reorder workflow. |
| Patients    | `patients/page.tsx`   | Adherence overview; refill-due flags. |
| Results     | `results/page.tsx`    | Counseling notes attached to dispense. |
| Quality     | `quality/page.tsx`    | Near-miss & dispensing-error reports. |
| Reports     | `reports/page.tsx`    | Cost-per-dispense; high-cost drug analysis. |
| DAWA        | `dawa/page.tsx`       | Pharmacy-specific persona. |
| Settings    | `settings/page.tsx`   | Insurance config, label printer. |

## Admin Portal (Hospital)

`@/src/app/portal/admin/`

| Screen          | Path                          | Top Items |
| --------------- | ----------------------------- | --------- |
| Dashboard       | `page.tsx`                    | Cross-department KPIs already wired via `/api/admin/dashboard`. Add executive intelligence panels. |
| Patients        | `patients/page.tsx`           | Cross-portal patient registry view. |
| Queue           | `queue/page.tsx`              | Real-time queue overview; SLA breaches. |
| Orders          | `orders/page.tsx`             | Hospital-wide order routing dashboard. |
| Beds            | `beds/page.tsx`               | Capacity heatmap; predictive admission. |
| Staff           | `staff/page.tsx`              | Onboarding pipeline; approval workflow; rota. |
| Facilities      | `facilities/page.tsx`         | Multi-facility for groups; license tracking. |
| Billing         | `billing/page.tsx`            | Revenue cycle dashboard. |
| Claims (SHIF)   | `claims/page.tsx`             | Claim submission state machine; rejection reasons. |
| Finance         | `finance/page.tsx`            | P&L, AR aging, M-Pesa reconciliation. |
| Referrals       | `referrals/page.tsx`          | Outbound network mgmt. |
| Quality         | `quality/page.tsx`            | Hospital-wide incident dashboard. |
| Reports         | `reports/page.tsx`            | Reportable indicators (KEPH, MoH). |
| Monitoring      | `monitoring/page.tsx`         | Service-health from monitoring API. |
| Health Feeds    | `health-feeds/page.tsx`       | Curated feed sources mgmt. |
| Escalations     | `escalations/page.tsx`        | Inter-department escalation tracker. |
| Bot Analytics   | `bot-analytics/page.tsx`      | Patient-bot performance; falloff funnel. |
| DAWA            | `dawa/page.tsx`               | Admin persona. |
| Settings        | `settings/page.tsx`           | Hospital identity, working hours, taxes, branding. |

## Superadmin Portal

`@/src/app/portal/superadmin/`

Platform layer — must look distinctly different from hospital portals.

| Screen              | Path                                | Top Items |
| ------------------- | ----------------------------------- | --------- |
| Dashboard           | `page.tsx`                          | Global KPIs already strong; add tenant heatmap, AI-cost trend. |
| Demo Management     | `demo/page.tsx`                     | Done in current cycle — DB-backed, revocable. |
| Hospitals           | `hospitals/page.tsx`                | Tenant onboarding pipeline, governance flags. |
| Facilities          | `facilities/page.tsx`               | Same data as hospitals; consider merge. |
| Facility Register   | `facilities/register/page.tsx`      | Wizard with verification checks. |
| Users               | `users/page.tsx`                    | Cross-tenant user search; impersonation w/ audit. |
| Audit Logs          | `audit/page.tsx`                    | Saved queries; export; high-risk highlighting. |
| Errors              | `errors/page.tsx`                   | Error grouping; assignee workflow. |
| Public Health       | `public-health/page.tsx`            | Aggregate disease surveillance (anonymized). |
| Compliance          | `compliance/page.tsx`               | KDPA/HIPAA/ISO27001 control posture. |
| Capacity Planner    | `capacity-planner/page.tsx`         | Scaling forecasts; SLO budget burn. |
| Payments            | `payments/page.tsx`                 | Platform billing; subscription tiers. |
| System Health       | `system/page.tsx`                   | Service mesh status; AI-provider health. |
| Settings            | `settings/page.tsx`                 | Feature flags; AI provider config. |

### Superadmin-specific P0 items

- Sidebar is fixed `w-64` with no mobile collapse — port `PortalShell`
  responsive behavior.
- No global search across tenants — add `⌘K` command palette.
- Demo Management page (just shipped) needs visual refinement to match
  superadmin gravitas (less "dashboard-y", more "command center").

## Phased Implementation Plan

### Phase A — Foundations (1–2 cycles)

- Build shared components: `StatusBadge`, `SeverityChip`, `PriorityDot`,
  `LoadingState`, `ErrorState`, `ResponsiveDataTable`, `DemoOnlyBanner`.
- Add `useDemoSession()` hook.
- Port `PortalShell` responsive behavior to `SuperAdminSidebar`.

### Phase B — Color & token sweep (1 cycle)

- Replace hardcoded color utilities with token-driven components, portal by
  portal in this order: superadmin → admin → medical → lab → pharmacy →
  reception (highest visibility first).

### Phase C — Per-portal feature elevation (multiple cycles)

- Reception: queue + check-in wizard + billing.
- Medical: consultation suite + handover + critical-results.
- Lab: QC charts + barcode workflow.
- Pharmacy: dispensing + adherence.
- Admin: revenue cycle + claims + monitoring.
- Superadmin: command palette + tenant heatmap + AI-cost trend.

### Phase D — A11y + perf pass (1 cycle)

- Run a11y audit; remediate findings.
- Add virtualization to all >100-row tables.

### Phase E — Aesthetic elevation (1 cycle)

- Motion polish: micro-interactions, skeletons, transitions.
- Iconography pass: consistent line weight via Lucide.
- Empty-state illustrations.

## Definition of "Cemented"

A feature is considered cemented when it has:

- Tenant-isolated data path via `getTenantPrismaClient(hospitalId)` (where
  applicable).
- API route under `enforceApiGuard` with explicit `denyDemo` posture.
- Server-driven loading/empty/error states.
- E2E coverage for at least one happy path and one auth-failure path.
- Visible in the demo showcase mode (read-only).
