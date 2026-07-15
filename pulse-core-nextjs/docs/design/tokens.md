# AfyaHero Design Tokens

## Purpose

Define a single semantic token system for clinical UX consistency across all portals.

## Token Principles

- Use semantic intent names, not literal color names.
- Prefer shared tokens over page-local styles.
- Keep role accents isolated to `portal-*` tokens.
- Maintain readable contrast for all text and status states.

## Color Tokens

### Content + Surfaces

- `content-canvas`: app background
- `content-surface`: section background
- `content-bg`: card/input background
- `content-border`: default border
- `mist`: subtle dividers/secondary visual strokes

### Typography

- `ink`: primary text (highest emphasis)
- `charcoal`: secondary text
- `slate`: tertiary/supporting text

### Portal Accents

- `portal-primary`: active accents and key interactions
- `portal-primary-hover`: hover/active state for accent actions
- `portal-primary-light`: soft accent backgrounds
- `portal-admin`, `portal-medical`, `portal-lab`, `portal-pharmacy`, `portal-reception`: role accents for nav/identity

### Clinical + AI States

- `severity-high`, `severity-high-bg`
- `severity-medium`, `severity-medium-bg`
- `ai-confirmed-text`, `ai-confirmed-bg`
- `ai-badge-text`, `ai-badge-bg`

## Spacing Tokens (Usage Scale)

- `2`: ultra-tight icon spacing
- `3-4`: dense control spacing (forms/tables)
- `5-6`: section internals
- `8+`: block separation between major dashboard regions

Use a consistent progression; avoid arbitrary one-off spacing values unless required by layout constraints.

## Radius Tokens

- `radius-sm`: chips, compact badges
- `radius-md`: inputs/buttons
- `radius-card` / `rounded-2xl`: cards and panel shells
- `rounded-full`: pills and circular controls

## Elevation Tokens

- `shadow-card`: default card elevation
- Minimal custom shadows only for emphasis moments (primary CTAs, live-state beacons)

## Motion Tokens (Guidance)

- Default transitions: 150-220ms, ease-out
- Micro-interactions only where they improve clarity
- Respect reduced-motion settings for non-essential animation

## Typography Tokens (Intent)

- Headline: `text-ink`, semibold, tight tracking
- Section labels: uppercase + `text-slate`
- Body copy: `text-charcoal`
- Meta text: `text-slate`

## Usage Rules

Do:
- Use `bg-content-*`, `border-content-border`, and semantic text classes.
- Map status badges to `severity-*` and `ai-*` tokens.
- Keep interaction focus rings tied to `portal-primary`.

Do not:
- Add hardcoded hex values for UI colors.
- Use literal utility palettes (`text-slate-700`, `bg-blue-100`) for production portal surfaces/states.
- Introduce duplicate local token names when a global token exists.

## Example Patterns

- Primary button: `bg-portal-primary hover:bg-portal-primary-hover text-white`
- Secondary button: `bg-content-surface border-content-border text-charcoal`
- Card shell: `bg-content-bg border-content-border shadow-card`
- Warning badge: `bg-severity-medium-bg text-severity-medium`
- AI-confirmed badge: `bg-ai-confirmed-bg text-ai-confirmed-text`

## Enforcement

- All portal pages and shared components must use semantic tokens.
- PR review should reject new hardcoded UI color literals except documented exceptions.

