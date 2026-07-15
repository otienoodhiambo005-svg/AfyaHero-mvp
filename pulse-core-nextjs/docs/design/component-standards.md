# AfyaHero Component Standards

## Purpose

Standardize component behavior, structure, and visual hierarchy for consistent, accessible, and high-speed clinical workflows.

## Global Composition Rules

- Build from shared primitives first (`KPICard`, portal shell blocks, shared table/input patterns).
- Prefer composition over boolean-prop branching.
- Keep component APIs intent-driven and minimal.
- Ensure every interactive element has keyboard and screen-reader support.

## Layout Blueprint (Portal Pages)

Recommended structure:
1. Header row (context, shift/state indicator)
2. KPI row (quick metrics)
3. Operational Pulse row (risk + decision lane)
4. Primary work area (table/forms/queues)
5. Side intelligence/actions
6. Supporting content (news/education/support)

## Component Contracts

### Cards

Required:
- Clear title and concise support text
- Consistent padding and border treatment
- Optional icon/accent tied to semantic tokens

Avoid:
- Mixed card styles on same page
- Overloaded card copy with low-value detail

### KPI Cards

Required:
- Metric label, value, and contextual trend
- Semantic trend direction
- Scanable typography and consistent icon placement

### Tables (Operational Queues)

Required:
- Search/filter affordances above table
- Sticky/clear headers for dense data
- Status and priority rendered as semantic badges
- Action cluster with accessible labels/tooltips

Accessibility:
- Keyboard reachable action buttons
- Explicit `aria-label` for row actions
- Sufficient text contrast for all states

### Forms + Inputs

Required:
- Visible labels or robust accessible labels
- Consistent error/help text patterns
- Focus ring using `portal-primary` semantics

### Status Badges

Map only to semantic classes:
- High urgency: `severity-high-*`
- Medium urgency: `severity-medium-*`
- Confirmed AI states: `ai-confirmed-*`
- Neutral/default operational states: content tokens

## Interaction Standards

- Primary CTA: one dominant action per section
- Secondary actions: visually subordinate, still discoverable
- Avoid ambiguous icon-only controls without labels or tooltips
- Use progressive disclosure for non-critical detail

## Accessibility Baseline

Every component must satisfy:
- Keyboard operability
- Visible focus state
- Label/role/name correctness
- No color-only communication for critical states
- Readable text contrast in both normal and emphasized states

## Performance Baseline

- Avoid unnecessary re-renders in dense tables/cards.
- Keep derived display data memoized where useful.
- Prefer shared patterns for long lists and loading states.

## Anti-Patterns

- Hardcoded color literals inside component markup
- Local visual style forks for equivalent components
- Massive “do-everything” components with conditionally hidden behavior
- Inconsistent button hierarchies across portals

## Review Checklist (PR)

- Component uses semantic tokens only
- API is simple and composable
- Keyboard and ARIA behavior validated
- Mobile and desktop layout checked
- Status and urgency semantics match platform definitions
- No duplicate pattern created when shared component exists

## Migration Priority

1. Shared table shells and action cells
2. KPI and pulse cards
3. Inputs/search/filter controls
4. Side insight/action panels
5. Remaining role-specific variants

