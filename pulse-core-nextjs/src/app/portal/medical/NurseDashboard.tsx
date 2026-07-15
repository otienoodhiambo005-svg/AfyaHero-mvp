'use client';

import Link from 'next/link';
import {
  HeartPulse, Syringe, Activity, Clipboard, Bell,
  AlertTriangle, CheckCircle, ArrowLeftRight, Users, BedDouble, Package, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientTask {
  id: string;
  patient: string;
  ward: string;
  bed: string;
  task: string;
  due: string;
  priority: 'urgent' | 'routine' | 'done';
}

interface VitalAlert {
  patient: string;
  ward: string;
  vital: string;
  value: string;
  severity: 'critical' | 'warning';
  time: string;
}

interface MedDue {
  patient: string;
  bed: string;
  drug: string;
  dose: string;
  route: string;
  due: string;
  status: 'due' | 'overdue' | 'given';
}

const tasks: PatientTask[] = [
  { id: '1', patient: 'Hassan Ali', ward: 'ICU', bed: 'ICU-3', task: 'Post-cardiac event vitals q1h', due: '09:00', priority: 'urgent' },
  { id: '2', patient: 'Fatuma Wanjiru', ward: 'Maternity', bed: 'A-12', task: 'Blood transfusion monitoring — unit 2', due: '09:15', priority: 'urgent' },
  { id: '3', patient: 'Peter Kamau', ward: 'Medical', bed: 'B-4', task: 'Sputum collection & isolation check', due: '09:30', priority: 'routine' },
  { id: '4', patient: 'Wanjiru Njeri', ward: 'Medical', bed: 'B-8', task: 'Fasting blood glucose reading', due: '09:45', priority: 'routine' },
  { id: '5', patient: 'Joseph Odhiambo', ward: 'Paeds', bed: 'P-2', task: 'IV artesunate — 2nd dose', due: '10:00', priority: 'urgent' },
  { id: '6', patient: 'Grace Abuya', ward: 'Maternity', bed: 'A-7', task: 'Post-ANC discharge education', due: '10:30', priority: 'done' },
];

const alerts: VitalAlert[] = [
  { patient: 'Hassan Ali', ward: 'ICU', vital: 'SpO₂', value: '88%', severity: 'critical', time: '08:47' },
  { patient: 'Fatuma Wanjiru', ward: 'Maternity', vital: 'HR', value: '118 bpm', severity: 'warning', time: '08:55' },
  { patient: 'Wanjiru Njeri', ward: 'Medical', vital: 'BP', value: '168/104 mmHg', severity: 'warning', time: '09:02' },
];

const meds: MedDue[] = [
  { patient: 'Hassan Ali', bed: 'ICU-3', drug: 'Furosemide', dose: '40 mg', route: 'IV', due: '09:00', status: 'overdue' },
  { patient: 'Joseph Odhiambo', bed: 'P-2', drug: 'Artesunate', dose: '60 mg', route: 'IV', due: '10:00', status: 'due' },
  { patient: 'Fatuma Wanjiru', bed: 'A-12', drug: 'Ferrous sulphate', dose: '200 mg', route: 'PO', due: '08:00', status: 'given' },
  { patient: 'Wanjiru Njeri', bed: 'B-8', drug: 'Amlodipine', dose: '5 mg', route: 'PO', due: '08:00', status: 'given' },
  { patient: 'Peter Kamau', bed: 'B-4', drug: 'Rifampicin', dose: '600 mg', route: 'PO', due: '10:30', status: 'due' },
];

const priorityStyles = {
  urgent: 'bg-severity-high-bg border-severity-high/30 text-severity-high',
  routine: 'bg-severity-medium-bg border-severity-medium/30 text-severity-medium',
  done: 'bg-content-surface border-content-border text-slate',
};

const medStatusStyles = {
  overdue: 'bg-severity-high-bg text-severity-high border border-severity-high/30',
  due: 'bg-severity-medium-bg text-severity-medium border border-severity-medium/30',
  given: 'bg-ai-confirmed-bg text-ai-confirmed-text border border-portal-primary/25',
};

const shellCard =
  'rounded-2xl border border-content-border bg-content-surface shadow-card';

export default function NurseDashboard(): React.ReactElement {
  const today = new Intl.DateTimeFormat('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  return (
    <div className="bg-content-canvas">
      <div className="mx-auto max-w-[1450px] rounded-3xl border border-content-border bg-content-surface p-4 text-charcoal shadow-card md:p-5">
        <div className="space-y-5 rounded-3xl bg-content-canvas p-4 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.1)] md:p-5">
          <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/25 bg-[radial-gradient(circle_at_top_right,rgba(217,119,6,0.18),transparent_32%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-portal-primary/10 blur-3xl" />
            <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-portal-primary/30 bg-portal-primary-light/35 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
                  <span className="h-2 w-2 rounded-full bg-portal-primary motion-safe:animate-pulse" />
                  Morning shift live
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">Good morning, Nurse Jane</h1>
                <p suppressHydrationWarning className="mt-2 text-sm text-slate">{today} · 07:00 – 15:00 handover window</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
                {[
                  { label: 'Alerts', value: alerts.length, icon: <AlertTriangle className="h-4 w-4" /> },
                  { label: 'Vitals due', value: '4', icon: <HeartPulse className="h-4 w-4" /> },
                  { label: 'Meds due', value: meds.filter((med) => med.status !== 'given').length, icon: <Syringe className="h-4 w-4" /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-sm">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-portal-primary/10 text-portal-primary">
                      {item.icon}
                    </div>
                    <p className="text-2xl font-semibold text-ink">{item.value}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vital Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2 rounded-[1.5rem] border border-severity-high/30 bg-severity-high-bg p-4 shadow-card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                  <p className="text-sm font-semibold text-danger">{alerts.length} vital alerts need action</p>
                </div>
                <span className="rounded-full border border-danger/20 bg-content-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-danger">Escalate within 10 min</span>
              </div>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm',
                    a.severity === 'critical' ? 'border-danger/20 bg-danger/5' : 'border-warning/20 bg-warning/5',
                  )}
                >
                  <span className={cn('font-medium', a.severity === 'critical' ? 'text-danger' : 'text-warning')}>
                    {a.patient} · {a.ward}
                  </span>
                  <span className={cn('font-semibold', a.severity === 'critical' ? 'text-danger' : 'text-warning')}>
                    {a.vital}: {a.value}
                  </span>
                  <span className="shrink-0 text-xs text-slate">{a.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Assigned Patients', value: '12', sub: 'Across 3 wards', icon: <Users className="h-5 w-5" /> },
              { label: 'Vitals Due', value: '4', sub: 'Next 30 min', icon: <HeartPulse className="h-5 w-5" /> },
              { label: 'Meds to Administer', value: '3', sub: '1 overdue', icon: <Syringe className="h-5 w-5" /> },
              { label: 'Handover', value: '15:00', sub: 'Evening shift', icon: <ArrowLeftRight className="h-5 w-5" /> },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={cn(shellCard, 'p-4 transition-colors motion-safe:duration-200 hover:bg-content-bg')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate">{kpi.label}</span>
                  <span className="text-portal-primary">{kpi.icon}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-ink">{kpi.value}</p>
                <p className="text-xs text-slate">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Ward Quick-Access — Beds & Consumables */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Bed Status */}
            <Link
              href="/portal/medical/beds"
              className={cn(shellCard, 'group flex items-start gap-4 p-4 transition-all hover:border-portal-primary/35 hover:bg-content-bg')}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-portal-primary/20 bg-portal-primary-light/35">
                <BedDouble className="h-5 w-5 text-portal-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Bed Status</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {[{ ward: 'Medical', occ: '14/20' }, { ward: 'ICU', occ: '4/6' }, { ward: 'Maternity', occ: '8/10' }, { ward: 'Paeds', occ: '6/12' }].map(({ ward, occ }) => (
                    <span key={ward} className="text-xs text-slate">
                      {ward} <span className="font-semibold text-charcoal">{occ}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs font-medium text-rose-600">ICU — 1 pending urgent admission</p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-mist transition-colors group-hover:text-portal-primary" />
            </Link>

            {/* Ward Consumables */}
            <Link
              href="/portal/medical/inventory"
              className={cn(shellCard, 'group flex items-start gap-4 p-4 transition-all hover:border-portal-primary/35 hover:bg-content-bg')}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-portal-primary/20 bg-portal-primary-light/35">
                <Package className="h-5 w-5 text-portal-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Ward Consumables</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-xs text-slate">In Stock <span className="font-semibold text-ai-confirmed-text">8</span></span>
                  <span className="text-xs text-slate">Low <span className="font-semibold text-severity-medium">2</span></span>
                  <span className="text-xs text-slate">Critical <span className="font-semibold text-severity-high">2</span></span>
                </div>
                <p className="mt-1.5 text-xs font-medium text-rose-600">Gloves (sterile) &amp; N95 Masks — critically low</p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-mist transition-colors group-hover:text-portal-primary" />
            </Link>
          </div>

          {/* Task List & MAR side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
            {/* Nursing Task List */}
            <div className={cn(shellCard, 'overflow-hidden')}>
              <div className="flex items-center justify-between border-b border-content-border bg-content-bg px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Clipboard className="h-4 w-4 text-portal-primary" /> Task List
                </h2>
                <span className="text-xs text-slate">{tasks.filter((t) => t.priority !== 'done').length} pending</span>
              </div>
              <ul className="divide-y divide-content-border">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-content-surface">
                    <span className={cn('mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase', priorityStyles[t.priority])}>
                      {t.priority === 'done' ? <CheckCircle className="h-3.5 w-3.5" /> : t.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium', t.priority === 'done' ? 'text-slate line-through' : 'text-ink')}>{t.patient}</p>
                      <p className="text-xs text-slate">{t.ward} · {t.bed} · {t.task}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-slate">{t.due}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Medication Administration Record */}
            <div className={cn(shellCard, 'overflow-hidden')}>
              <div className="flex items-center justify-between border-b border-content-border bg-content-bg px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Syringe className="h-4 w-4 text-portal-primary" /> Medication Administration
                </h2>
                <span className="rounded-full border border-severity-high/30 bg-severity-high-bg px-2 py-0.5 text-xs text-severity-high">
                  {meds.filter((m) => m.status === 'overdue').length} overdue
                </span>
              </div>
              <ul className="divide-y divide-content-border">
                {meds.map((m, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-content-surface">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {m.patient} <span className="font-normal text-slate">· {m.bed}</span>
                      </p>
                      <p className="text-xs text-slate">{m.drug} {m.dose} {m.route}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-slate">{m.due}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', medStatusStyles[m.status])}>
                        {m.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Notifications */}
          <div className={cn(shellCard, 'overflow-hidden')}>
            <div className="flex items-center justify-between border-b border-content-border bg-content-bg px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Bell className="h-4 w-4 text-portal-primary" /> Shift Notifications
              </h2>
            </div>
            <ul className="divide-y divide-content-border">
              {[
                { text: 'Care team order: New IV line for Hassan Ali — ICU-3', time: '08:50', icon: <Activity className="h-4 w-4 text-portal-primary" /> },
                { text: 'Lab result available: Fatuma Wanjiru Hb 5.2 — transfusion requested', time: '08:30', icon: <AlertTriangle className="h-4 w-4 text-warning" /> },
                { text: 'Pharmacy update: Artesunate 60 mg prepared for Joseph Odhiambo Ward P-2', time: '08:15', icon: <CheckCircle className="h-4 w-4 text-success" /> },
                { text: 'Shift note from overnight team: Peter Kamau remained afebrile overnight', time: '07:05', icon: <ArrowLeftRight className="h-4 w-4 text-info" /> },
              ].map((n, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-content-surface">
                  <span className="mt-0.5 shrink-0">{n.icon}</span>
                  <p className="flex-1 text-sm text-charcoal">{n.text}</p>
                  <span className="shrink-0 text-xs text-slate">{n.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
