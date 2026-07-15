'use client';

import {
  Bell,
  CalendarDays,
  CircleUserRound,
  Gauge,
  HeartPulse,
  Home,
  Search,
  Settings,
  ShieldPlus,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

const heroImage =
  'https://images.unsplash.com/photo-1612277795421-9bc7706a4a41?auto=format&fit=crop&w=1100&q=80';

const quickStats = [
  { icon: <ShieldPlus className="h-5 w-5" />, value: 'O+', label: 'Group' },
  { icon: <Gauge className="h-5 w-5" />, value: '184 cm', label: 'Stature' },
  { icon: <HeartPulse className="h-5 w-5" />, value: '86 kg', label: 'Mass' },
];

const meterCards = [
  { title: 'Cardio Strain', value: '34', unit: 'index', tone: 'low' },
  { title: 'Respiratory Load', value: '0.72', unit: 'ratio', tone: 'moderate' },
  { title: 'Inflammation Axis', value: '121', unit: 'score', tone: 'stable' },
];

const markerRows = [
  { marker: 'Cardio Strain', family: 'hemodynamic', current: '34 index', band: 'stable' },
  { marker: 'Respiratory Load', family: 'pulmonary', current: '0.72 ratio', band: 'watch' },
  { marker: 'Inflammation Axis', family: 'immune', current: '121 score', band: 'stable' },
  { marker: 'Metabolic Drift', family: 'metabolic', current: '1.9 mmol/L', band: 'alert' },
];

const quickActions = [
  { icon: Home, label: 'Open overview' },
  { icon: HeartPulse, label: 'Open patient vitals' },
  { icon: Sparkles, label: 'Open smart insights' },
  { icon: CalendarDays, label: 'Open schedule' },
  { icon: Settings, label: 'Open settings' },
];

function toneClass(tone: string): string {
  if (tone === 'alert') return 'bg-rose-100 text-rose-700';
  if (tone === 'watch') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

export default function DoctorDashboardV2(): React.ReactElement {
  return (
    <div className="bg-content-canvas">
      <div className="mx-auto flex max-w-[1480px] gap-4 rounded-3xl border border-content-border bg-content-surface p-4 text-charcoal shadow-card">
        <aside className="flex w-[72px] flex-col items-center rounded-2xl bg-content-bg py-5 shadow-[inset_0_0_0_1px_rgba(50,130,184,0.14)]">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-content-bg text-portal-primary shadow-sm">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-3">
            {quickActions.map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-card text-slate transition-colors motion-safe:duration-200 hover:bg-content-surface hover:text-portal-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </aside>

        <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[42%_58%]">
          <section className="relative overflow-hidden rounded-3xl bg-content-canvas p-2">
            <div
              className="h-full min-h-[680px] rounded-2xl bg-cover bg-center"
              style={{ backgroundImage: `url(${heroImage})` }}
            />
            <div className="pointer-events-none absolute inset-2 rounded-2xl bg-gradient-to-tr from-content-canvas/40 via-transparent to-content-canvas/10" />
          </section>

          <section className="space-y-5 rounded-3xl bg-content-canvas p-5 shadow-[inset_0_0_0_1px_rgba(50,130,184,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="relative block w-full max-w-md">
                <span className="sr-only">Search profile, report, or marker</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
                <input
                  type="text"
                  placeholder="Locate profile, report, or marker"
                  aria-label="Locate profile, report, or marker"
                  className="h-11 w-full rounded-full border border-content-border bg-content-surface pl-11 pr-4 text-sm text-charcoal outline-none transition-colors motion-safe:duration-200 focus:border-portal-primary/40 focus:ring-2 focus:ring-portal-primary/20"
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Open calendar"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-content-surface text-slate transition-colors motion-safe:duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Open notifications"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-content-surface text-slate transition-colors motion-safe:duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <div className="ml-2 flex items-center gap-2 rounded-full bg-content-surface px-3 py-1.5">
                  <CircleUserRound className="h-8 w-8 text-slate" />
                  <div>
                    <p className="text-sm font-semibold text-ink">Care Specialist</p>
                    <p className="text-[11px] text-slate">Central Unit</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_auto]">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl xl:text-[3.25rem]">
                Clinical
                <br />
                Command Center
              </h1>
              <div className="flex gap-6 pt-2">
                {quickStats.map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center text-charcoal">
                      {item.icon}
                    </div>
                    <p className="text-3xl font-semibold text-ink">{item.value}</p>
                    <p className="text-[11px] text-slate">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {meterCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-content-border bg-content-bg p-4 shadow-card"
                >
                  <p className="text-xs text-slate">{card.title}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <p className="text-4xl font-semibold text-ink">{card.value}</p>
                    <span className="text-xs text-slate">{card.unit}</span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-content-border">
                    <div
                      aria-label={`${card.title} trend`}
                      className={`h-2 rounded-full ${
                        card.tone === 'moderate' ? 'w-2/3 bg-severity-medium' : card.tone === 'low' ? 'w-1/3 bg-ai-confirmed-text' : 'w-1/2 bg-portal-primary'
                      }`}
                    />
                  </div>
                </article>
              ))}
            </div>

            <section className="rounded-2xl border border-content-border bg-content-bg p-4 shadow-card">
              <div className="mb-3 grid grid-cols-[1.3fr_1fr_1fr_auto] text-[11px] uppercase tracking-wide text-slate">
                <span>Marker</span>
                <span>Cluster</span>
                <span>Current</span>
                <span className="text-right">State</span>
              </div>
              <div className="space-y-2">
                {markerRows.map((row) => (
                  <div
                    key={row.marker}
                    className="grid grid-cols-[1.3fr_1fr_1fr_auto] items-center rounded-2xl bg-content-surface px-3 py-2"
                  >
                    <span className="text-sm font-medium text-ink">{row.marker}</span>
                    <span className="text-xs text-slate">{row.family}</span>
                    <span className="text-sm text-charcoal">{row.current}</span>
                    <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${toneClass(row.band)}`}>
                      {row.band}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}
