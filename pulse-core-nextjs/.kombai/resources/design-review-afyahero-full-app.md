# Design Review Results: AfyaHero — Full Application

**Review Date**: 2026-03-25  
**Routes Reviewed**: `/` · `/dashboard` · `/dashboard/consultations` · `/dashboard/patients/[patientId]` · `/dashboard/pharmacy` · `/dashboard/settings/*` · `/dashboard/teleconsult` · `/dashboard/wards`  
**Focus Areas**: All — Visual Design · UX/Usability · Responsive/Mobile · Accessibility · Micro-interactions/Motion · Consistency · Performance

---

## Summary

AfyaHero has a sophisticated design language and strong feature breadth, but suffers from **critical build-breaking configuration issues**, a major **dark/light theme split between pages** that creates a jarring user experience, and numerous **accessibility gaps**. The teleconsult page is entirely decoupled from the rest of the design system (using raw inline styles), and the mobile sidebar is non-functional. Addressing the critical and high issues first will significantly improve cohesion and production-readiness.

---

## Issues

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | **Missing PostCSS config** — `@tailwind` directives fail to compile with error `Module parse failed: Unexpected character '@'`. The app renders a blank error screen in production/dev. | 🔴 Critical | Performance | `pulse-core-nextjs/` root — `postcss.config.js` missing entirely |
| 2 | **Dark/Light theme split** — Dashboard and Pharmacy pages use a dark green palette (`bg-ink`, `bg-forest`, `text-white`) while Consultations, Patients, Wards, and Settings use a white/light palette (`bg-white`, `bg-content-bg`, `text-ink`). Users experience a jarring visual switch between routes. | 🔴 Critical | Consistency | `src/app/dashboard/page.tsx:89` vs `src/app/dashboard/consultations/page.tsx:129` |
| 3 | **Mobile hamburger is non-functional** — The Header renders a hamburger icon `<Menu>` with `aria-label="Open menu"` but there is no `onClick` handler connected to any sidebar state. Tapping it on mobile has zero effect. | 🔴 Critical | Responsive/Mobile | `src/components/shared/Header.tsx:13` |
| 4 | **Sidebar has no mobile overlay** — The sidebar is `fixed w-64` with no responsive breakpoint or mobile toggle. On viewports narrower than 1024px, the sidebar permanently overlaps content with no way to dismiss it. | 🔴 Critical | Responsive/Mobile | `src/components/shared/Sidebar.tsx:108` |
| 5 | **`require('react').useEffect` non-standard call** — The Pharmacy page uses `require('react').useEffect(...)` instead of a proper ESM import. This prevents static analysis, breaks tree-shaking, and is syntactically unexpected in a TypeScript module. | 🔴 Critical | Performance | `src/app/dashboard/pharmacy/page.tsx:52` |
| 6 | **`font-outfit` undefined** — The Settings layout and Profile page reference `font-outfit` Tailwind class, but `Outfit` is never imported in `layout.tsx` and is absent from `tailwind.config.ts`. Text falls back silently to the body font. | 🟠 High | Consistency | `src/app/dashboard/settings/layout.tsx:26`, `src/app/dashboard/settings/profile/page.tsx:39` |
| 7 | **Custom `slate` token conflicts with Tailwind built-in** — `tailwind.config.ts` defines `slate: "#4A6357"` (a forest green), but Settings pages use `slate-50`, `slate-200`, `slate-400`, `slate-700`, `slate-900` (Tailwind's built-in blue-gray palette). These are different hues and will silently produce inconsistent colors. | 🟠 High | Consistency | `pulse-core-nextjs/tailwind.config.ts:29` · `src/app/dashboard/settings/profile/page.tsx:60-166` |
| 8 | **Teleconsult page uses 100% inline styles** — Every component in `TeleconsultPage` and `SessionCard` uses raw `style={{ ... }}` objects instead of Tailwind utility classes. This page is completely isolated from the design system (tokens, spacing scale, font variables, border-radius conventions, color palette). | 🟠 High | Consistency | `src/app/dashboard/teleconsult/page.tsx:158-403` |
| 9 | **Extremely large border-radii on Dashboard** — KPI cards use `rounded-[32px]` and the chart/operations panels use `rounded-[40px]`. These values (128px and 160px effective corner radii) are far outside any established clinical/SaaS design convention, making the UI look toy-like rather than professional. | 🟠 High | Visual Design | `src/app/dashboard/page.tsx:97,117,177` |
| 10 | **`window.location.href` for logout navigation** — Sidebar logout uses `window.location.href = '/auth/login'` which causes a full hard navigation/page reload instead of using Next.js `router.push()` or `redirect()`, losing all React state and bypassing the router. | 🟠 High | Performance | `src/components/shared/Sidebar.tsx:99` |
| 11 | **No auth context — Supabase `getSession()` called independently in 4+ components** — `DashboardPage`, `KPIHeroStrip`, `Sidebar`, and `PharmacyPage` each independently call `supabase.auth.getSession()` on mount with no shared context. This causes redundant auth network requests and inconsistent session state. | 🟠 High | Performance | `src/app/dashboard/page.tsx:37` · `src/components/portal/KPIHeroStrip.tsx:23` · `src/components/shared/Sidebar.tsx:53` |
| 12 | **Sidebar `<nav>` has no ARIA landmark label** — The sidebar navigation lacks `aria-label` or `aria-labelledby`, making it indistinguishable from other `<nav>` regions for screen reader users. | 🟠 High | Accessibility | `src/components/shared/Sidebar.tsx:116` |
| 13 | **Status badges rely on color alone** — Consultations list uses colored dots (emerald/blue-400/red-400) to distinguish Active/Scheduled/Cancelled statuses with no additional text differentiation visible at the dot level. Users with color vision deficiencies cannot distinguish statuses from the dot alone. | 🟠 High | Accessibility | `src/app/dashboard/consultations/page.tsx:202-208` |
| 14 | **Teleconsult `SessionCard` is a `<div>` with `onClick`** — Active sessions trigger `onJoin()` on div click but the element has no `role="button"`, no `tabIndex`, and no `onKeyDown` handler. This is completely inaccessible via keyboard navigation. | 🟠 High | Accessibility | `src/app/dashboard/teleconsult/page.tsx:174-176` |
| 15 | **Search input fields missing `aria-label`** — The global search in `Header`, the search in `PharmacyPage` inventory, and the search in `TeleconsultPage` all render `<input>` elements without `aria-label` or `<label>` associations. Screen readers will announce them as unlabeled. | 🟠 High | Accessibility | `src/components/shared/Header.tsx:19` · `src/app/dashboard/pharmacy/page.tsx:281` · `src/app/dashboard/teleconsult/page.tsx:352` |
| 16 | **No `prefers-reduced-motion` handling** — KPI cards use `hover:scale-[1.02]` and brand icon uses `group-hover:scale-110 duration-500` with no `@media (prefers-reduced-motion: reduce)` guard. Users who opt out of motion will still see scale animations. | 🟡 Medium | Accessibility | `src/app/dashboard/page.tsx:97` · `src/components/shared/Sidebar.tsx:110` |
| 17 | **Page title typography inconsistency** — Dashboard uses `text-4xl font-semibold font-serif` (Cormorant Garamond, 36px) while Consultations and Wards use `text-2xl font-bold font-serif` (24px). There is no consistent H1 scale across the app. | 🟡 Medium | Visual Design | `src/app/dashboard/page.tsx:91` vs `src/app/dashboard/consultations/page.tsx:133` vs `src/app/dashboard/wards/page.tsx:90` |
| 18 | **Dashboard loading state blocks all layout** — `if (loading) return <div>...</div>` renders a full-page centered spinner, hiding the sidebar, header, and KPI strip. This causes layout shift (CLS) when content loads and is a poor UX pattern — skeleton screens or partial loading would be far better. | 🟡 Medium | UX/Usability | `src/app/dashboard/page.tsx:80-86` |
| 19 | **KPIHeroStrip shows `0` for all values when unauthenticated** — If `getSession()` returns no session (logged-out user, expired token, cold start), the strip silently shows `0` for all metrics with no loading indicator or "—" fallback. This presents misleading data. | 🟡 Medium | UX/Usability | `src/components/portal/KPIHeroStrip.tsx:23-27` |
| 20 | **`animate-scan` class undefined** — The pharmacy barcode scanner overlay uses `animate-scan` but this keyframe is never defined in `globals.css` or `tailwind.config.ts`. The scanning line animation silently fails to play. | 🟡 Medium | Micro-interactions | `src/app/dashboard/pharmacy/page.tsx:134` |
| 21 | **Notification dropdown `z-index` may conflict with sidebar** — The `NotificationPanel` dropdown has `z-50`, but the `Sidebar` AI assistant overlay uses `z-[100]`. When the AI overlay is open, the notification dropdown renders beneath it even when triggered from the header, which sits above the sidebar in DOM order. | 🟡 Medium | Visual Design | `src/components/portal/NotificationPanel.tsx:87` · `src/components/shared/Sidebar.tsx:167` |
| 22 | **Button shape inconsistency across pages** — Consultations/Wards use `rounded-full` CTA buttons, Dashboard KPI badges use `rounded-xl`, Settings uses `rounded-full`, Pharmacy uses `rounded-2xl`. There is no single button shape convention. | 🟡 Medium | Consistency | `src/app/dashboard/consultations/page.tsx:139` · `src/app/dashboard/wards/page.tsx:96` · `src/app/dashboard/pharmacy/page.tsx:186` |
| 23 | **Dashboard subtitle has duplicate/conflicting tracking** — The subtitle element sets both `tracking-wide` and `tracking-[0.1em]` in the same class string. The inline value overrides Tailwind's preset, making the `tracking-wide` class redundant and confusing to future maintainers. | 🟡 Medium | Visual Design | `src/app/dashboard/page.tsx:92` |
| 24 | **Settings layout sidebar has no mobile breakpoint** — The settings inner sidebar nav (`w-[260px]`) has no `md:` prefix and no responsive collapse. On mobile, it forces a two-column layout that overflows the viewport. | 🟡 Medium | Responsive/Mobile | `src/app/dashboard/settings/layout.tsx:32` |
| 25 | **Filter pills in Consultations lack `aria-pressed` state** — The status filter buttons toggle state visually but do not communicate their selected state to assistive technologies via `aria-pressed` or `aria-selected`. | 🟡 Medium | Accessibility | `src/app/dashboard/consultations/page.tsx:177-191` |
| 26 | **`KPIHeroStrip` may update state after unmount** — The 30s `setInterval` inside `KPIHeroStrip` calls `fetchKPI()` which calls `setData()`. If the component unmounts (route change) before the interval fires, React will warn about state updates on unmounted components. The cleanup only clears the interval, not the in-flight fetch. | 🟡 Medium | Performance | `src/components/portal/KPIHeroStrip.tsx:44-46` |
| 27 | **Cormorant Garamond as primary heading font** — While elegant, Cormorant Garamond at the weights used (300–400) can render with low perceived contrast and thin strokes on low-DPI displays, making clinical data harder to read quickly under time pressure. Consider reserving it for decorative/brand moments only. | ⚪ Low | Visual Design | `src/app/layout.tsx:5-10` · `src/app/dashboard/page.tsx:91` |
| 28 | **Cart grid alignment: 2 KPI cards use `bg-forest/50`** — The Pharmacy overview KPI cards alternate between `bg-forest/30` backgrounds but the dashboard KPI cards at `src/app/dashboard/page.tsx:28` alternate between `bg-emerald/10` and `bg-forest/50`. These backgrounds produce inconsistent icon contrast: `bg-forest/50` with a mist-colored icon may fail WCAG 3:1 non-text contrast. | ⚪ Low | Accessibility | `src/app/dashboard/page.tsx:28-30` |
| 29 | **No favicon** — Browser console logs a 404 for `/favicon.ico`. While minor, it is unprofessional in production and generates an unnecessary failed network request. | ⚪ Low | Performance | `pulse-core-nextjs/public/` — `favicon.ico` missing |
| 30 | **`any[]` typed `chartData` state** — Dashboard uses `const [chartData, setChartData] = useState<any[]>([])`. TypeScript is being ignored here. A typed `DailyAdmission` interface would improve maintainability and editor support. | ⚪ Low | Performance | `src/app/dashboard/page.tsx:32` |

---

## Criticality Legend

- 🔴 **Critical**: Breaks functionality, causes build failures, or renders the app unusable
- 🟠 **High**: Significantly impacts user experience, accessibility standards, or design quality
- 🟡 **Medium**: Noticeable issue that degrades quality or causes maintenance friction
- ⚪ **Low**: Nice-to-have improvement or minor polish item

---

## Next Steps

### Immediate (Unblock the app)
1. **Create `postcss.config.js`** (Issue #1) — add `tailwindcss` and `autoprefixer` plugins. This unblocks the entire app.
2. **Fix `require('react').useEffect`** (Issue #5) — replace with proper `import { useEffect } from 'react'` in Pharmacy page.

### Sprint 1 — Consistency & Core UX
3. **Standardise to light theme** (Issue #2) — migrate Dashboard and Pharmacy to use `bg-content-bg`, `bg-content-surface`, and `bg-white` card backgrounds. Remove `bg-ink` / `bg-forest` from main content areas. Keep dark theme only for the sidebar.
4. **Wire mobile sidebar toggle** (Issues #3 & #4) — lift `isSidebarOpen` state to `DashboardLayout`, pass setter to `Header`'s hamburger button, and render the sidebar as a fixed overlay with backdrop on `md:` and below.
5. **Remove `font-outfit`** (Issue #6) — replace with `font-sans` (DM Sans) which is already imported.
6. **Fix `slate-*` token collision** (Issue #7) — rename Settings-page Tailwind usages to custom tokens (`text-charcoal`, `border-content-border`, `bg-content-surface`) or rename the custom `slate` token to `forest-slate` in `tailwind.config.ts`.

### Sprint 2 — Accessibility & Teleconsult
7. **Refactor Teleconsult** (Issue #8) — replace all inline styles with Tailwind utility classes using the existing design tokens.
8. **Add ARIA labels** (Issues #12, #13, #15, #25) — `nav` landmark label, search input labels, filter button `aria-pressed`, status dot text alternatives.
9. **Fix keyboard navigation on Teleconsult cards** (Issue #14) — add `role="button"`, `tabIndex={0}`, and `onKeyDown` handler.
10. **Add `prefers-reduced-motion`** (Issue #16) — wrap hover animations in a `motion-safe:` Tailwind prefix or CSS media query in `globals.css`.

### Sprint 3 — Performance & Polish
11. **Create shared auth context** (Issue #11) — introduce a Supabase auth provider at the dashboard layout level to share session state.
12. **Replace logout `window.location.href`** (Issue #10) — use `useRouter().push('/auth/login')` after `signOut()`.
13. **Define `animate-scan` keyframe** (Issue #20) — add to `globals.css` @layer utilities.
14. **Add skeleton loading** (Issue #18) — replace the full-page spinner with skeleton placeholder cards matching the KPI grid layout.
15. **Reduce card border-radius** (Issue #9) — use `rounded-2xl` (16px) for KPI cards and `rounded-3xl` (24px) for chart panels at most.
