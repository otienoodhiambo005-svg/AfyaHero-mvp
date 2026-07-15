# AfyaHero Design Modernization Charter

## Objective

Upgrade AfyaHero into a cohesive, high-clarity clinical platform by standardizing design tokens, component behavior, and portal UX patterns while preserving role-specific workflows.

## Why this now

- UI consistency has improved but remains uneven across portals.
- Several dashboards still differ in hierarchy, spacing rhythm, and interaction behavior.
- Existing design guidance is rich but fragmented across multiple doc locations.
- Clinical workflows require faster scanability and lower cognitive load at peak operation times.

## Scope

In scope:
- `pulse-core-nextjs` portal experiences (medical, reception, lab, pharmacy, admin).
- Shared UI components and portal shell patterns.
- Accessibility baseline (WCAG 2.2 AA target for core workflows).
- Responsive behavior and mobile navigation standards.

Out of scope (for this charter phase):
- Full product rebrand or logo/identity overhaul.
- New feature expansion unrelated to UX/system consistency.

## Success criteria

- One source of truth for design system guidance.
- 100% of portal pages use semantic theme tokens (no hardcoded color literals for UI surfaces/text/state).
- Shared “Glassboard” operational pattern applied to priority dashboards.
- No critical accessibility issues across top clinical and front-desk workflows.
- Better perceived speed and clarity on high-density data screens.

## Guiding principles

- Clinical clarity first: reduce noise, surface urgency, support quick decisions.
- Semantic styling over literal styling: intent-based tokens only.
- Consistency at system level, flexibility at role level.
- Accessibility and performance are default quality gates.
- Reuse shared components before introducing local variants.

## Current state summary

- Theme token migration is already underway in portal pages and shared components.
- Reception and admin now include a Glassboard-style “Operational Pulse + Decision Lane” pattern.
- A full-app design audit exists and should be used as redesign backlog input:
  - `pulse-core-nextjs/.kombai/resources/design-review-afyahero-full-app.md`
- Design guidance duplication exists across agent doc trees and can cause drift.

## Workstreams

### 1) Design System Foundation

Deliverables:
- `docs/design/tokens.md` (color, spacing, radius, elevation, motion, z-index, typography).
- `docs/design/component-standards.md` (anatomy, states, variants, usage boundaries).
- `docs/design/theme-strategy.md` (theme mapping, contrast rules, portal accent policy).

Definition of done:
- Token naming and usage examples are complete and approved.
- Component variants mapped to existing shared components.
- PR checklist references these docs.

### 2) Portal UX Unification

Deliverables:
- Standardized page skeleton for all portals (header, KPI strip, pulse row, work area, side intelligence).
- Glassboard pattern applied to medical, lab, pharmacy, and any remaining reception/admin variants.
- Unified table and form interaction patterns (search, filter chips, status badges, action clusters).

Definition of done:
- Priority portals match the same structural rhythm.
- Status semantics are consistent (`severity-*`, `ai-*`, `portal-*` classes).

### 3) Accessibility Compliance

Deliverables:
- `docs/design/accessibility-baseline.md` with route-by-route WCAG checks.
- Keyboard and screen-reader test matrix for core flows (check-in, triage, lab queue, dispensing, admin actions).
- Focus, contrast, and aria regressions blocked in review.

Definition of done:
- Core route audits pass with no critical issues.
- Accessibility checks are part of QA handoff.

### 4) Performance + Rendering Quality

Deliverables:
- Frontend guidance for hydration-safe rendering, resource hints, and long-list rendering optimizations.
- Standard profile for dashboard list performance (large queue tables).

Definition of done:
- No known hydration flicker in portal shells.
- Measurable improvement in list-heavy route responsiveness.

### 5) Governance + Delivery

Deliverables:
- `docs/design/redesign-rollout-plan.md` with sequencing and ownership.
- Design RFC template for major UI changes.
- Visual review checklist (clarity, consistency, a11y, performance).

Definition of done:
- All new UI work references a documented pattern.
- Design decisions are traceable to charter outcomes.

## Phased rollout

### Phase 1: Stabilize (1-2 sprints)

- Consolidate design docs into a single source of truth.
- Finish token cleanup on all portal root pages and critical shared components.
- Standardize status badges and action button semantics.
- Apply Glassboard quick-scan section to remaining high-priority dashboards.

### Phase 2: Systemize (2-4 sprints)

- Publish token + component standards and enforce in PR review.
- Normalize table, card, and form composition patterns.
- Complete accessibility baseline and critical fixes.
- Add performance improvements for long queues and heavy dashboards.

### Phase 3: Elevate (ongoing)

- Refine visual hierarchy, motion, and micro-interactions for confidence and clarity.
- Expand design quality gates to all new features.
- Track UX quality metrics and regression trends quarterly.

## Prioritized action backlog (Top 10)

1. Convert the existing design audit into tracked engineering/design work items.
2. Remove doc duplication and define one canonical design-doc path.
3. Publish a platform token spec and reference implementation examples.
4. Publish shared component standards with state/accessibility contracts.
5. Complete semantic token migration on all portal screens.
6. Standardize mobile behavior for side navigation and dense tables.
7. Implement route-based WCAG 2.2 AA checks for core operational flows.
8. Normalize typography scale and semantic text usage (`ink`, `charcoal`, `slate`).
9. Apply rendering/performance patterns for list-heavy dashboard content.
10. Create redesign rollout governance (RACI, review gates, acceptance criteria).

## Ownership model (proposed)

- Product Design Lead: visual language, IA, interaction standards.
- Frontend Lead: componentization, token enforcement, shared UI migration.
- QA + Accessibility Lead: WCAG matrix execution and signoff.
- Portal Owners: domain-specific adoption and regression prevention.

## Quality gates

Every redesign PR should pass:
- Semantic token compliance check (no hardcoded UI colors).
- Accessibility check for keyboard navigation, focus order, and labels.
- Responsive sanity check for narrow and wide breakpoints.
- Visual hierarchy check (readability + action discoverability).
- Regression check against portal baseline patterns.

## Immediate next execution targets

- Extend Glassboard pattern to remaining dashboards that do not yet expose operational pulse.
- Create `docs/design/tokens.md` and `docs/design/component-standards.md`.
- Add a lightweight “Design Review Checklist” to pull request templates.

