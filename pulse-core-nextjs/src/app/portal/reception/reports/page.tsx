'use client';

import { useState } from 'react';
import { Brain, TrendingUp, Users, DollarSign, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateRange = 'Today' | 'Week' | 'Month' | 'Custom';

interface BarData {
  day: string;
  amount: number;
  max: number;
}

interface DemographicRow {
  ageGroup: string;
  count: number;
  pct: number;
}

interface ServiceRow {
  service: string;
  count: number;
  revenue: number;
}

const BARS: BarData[] = [
  { day: 'Mon', amount: 72000, max: 120000 },
  { day: 'Tue', amount: 95000, max: 120000 },
  { day: 'Wed', amount: 61000, max: 120000 },
  { day: 'Thu', amount: 110000, max: 120000 },
  { day: 'Fri', amount: 84200, max: 120000 },
  { day: 'Sat', amount: 42000, max: 120000 },
  { day: 'Sun', amount: 28000, max: 120000 },
];

const DEMOGRAPHICS: DemographicRow[] = [
  { ageGroup: '0–12 (Paediatric)', count: 8, pct: 17 },
  { ageGroup: '13–17 (Adolescent)', count: 3, pct: 6 },
  { ageGroup: '18–35 (Young Adult)', count: 14, pct: 30 },
  { ageGroup: '36–60 (Adult)', count: 16, pct: 34 },
  { ageGroup: '61+ (Senior)', count: 6, pct: 13 },
];

const SERVICES: ServiceRow[] = [
  { service: 'OPD Consultation', count: 28, revenue: 42000 },
  { service: 'Laboratory', count: 15, revenue: 18750 },
  { service: 'Pharmacy / Drugs', count: 22, revenue: 11000 },
  { service: 'Antenatal Care', count: 5, revenue: 7500 },
  { service: 'Vaccination', count: 4, revenue: 2400 },
  { service: 'Emergency', count: 2, revenue: 19000 },
];

const RANGE_METRICS: Record<DateRange, { patients: string; revenue: string; insurance: string; wait: string }> = {
  Today: { patients: '47', revenue: 'KES 84,200', insurance: 'KES 142,000', wait: '18 min' },
  Week: { patients: '312', revenue: 'KES 492,200', insurance: 'KES 876,000', wait: '21 min' },
  Month: { patients: '1,248', revenue: 'KES 2,104,800', insurance: 'KES 3,420,000', wait: '19 min' },
  Custom: { patients: '—', revenue: '—', insurance: '—', wait: '—' },
};

export default function ReceptionReportsPage() {
  const [range, setRange] = useState<DateRange>('Today');
  const metrics = RANGE_METRICS[range];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(217,119,6,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
        <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              Operations desk analytics
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink md:text-5xl">Operations reports</h1>
            <p className="mt-2 text-sm text-slate">Patient flow, collections, claims, and operational performance analytics</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          >
            <FileText className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2 flex-wrap">
        {(['Today', 'Week', 'Month', 'Custom'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'px-4 py-2 rounded-card text-sm font-medium transition-all',
              range === r
                ? 'text-white font-semibold bg-primary'
                : 'text-slate-600 border border-content-border bg-content-bg hover:bg-content-surface',
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', value: metrics.patients, icon: <Users className="w-5 h-5" /> },
          { label: 'Revenue', value: metrics.revenue, icon: <DollarSign className="w-5 h-5" /> },
          { label: 'Insurance Claimed', value: metrics.insurance, icon: <FileText className="w-5 h-5" /> },
          { label: 'Avg Wait Time', value: metrics.wait, icon: <Clock className="w-5 h-5" /> },
        ].map((card) => (
          <div key={card.label} className="space-y-3 rounded-[1.5rem] border border-content-border bg-content-bg/90 p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">{card.label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">{card.icon}</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Bar Chart — Daily Collections This Week */}
      <div className="bg-content-bg border border-content-border rounded-card p-6 shadow-card">
        <h2 className="text-ink font-semibold mb-6">
          Daily Collections This Week
          <span className="ml-2 text-slate-500 text-sm font-normal">(KES)</span>
        </h2>
        <div className="space-y-3">
          {BARS.map((bar) => {
            const pct = Math.round((bar.amount / bar.max) * 100);
            return (
              <div key={bar.day} className="flex items-center gap-3">
                <span className="text-slate-500 text-xs w-8 flex-shrink-0">{bar.day}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-7 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center pl-3 transition-all duration-700 bg-primary"
                    style={{ width: `${pct}%` }}
                  >
                    <span className="text-white text-xs font-semibold whitespace-nowrap">
                      {bar.amount >= 1000 ? `${(bar.amount / 1000).toFixed(0)}K` : bar.amount}
                    </span>
                  </div>
                </div>
                <span className="text-slate-500 text-xs w-16 text-right flex-shrink-0">
                  {(bar.amount / 1000).toFixed(0)}K
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1 mt-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-slate-500 text-xs">Best day: Thursday (KES 110,000)</span>
        </div>
      </div>

      {/* Demographics + Top Services (side by side on larger screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Demographics Table */}
        <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
          <div className="px-6 py-4 border-b border-content-border bg-content-surface/80">
            <h2 className="text-ink font-semibold">Patient Demographics</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Age Group', 'Count', '%'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMOGRAPHICS.map((row) => (
                <tr key={row.ageGroup} className="border-b border-content-border/50 hover:bg-content-surface">
                  <td className="px-4 py-3 text-ink">{row.ageGroup}</td>
                  <td className="px-4 py-3 text-slate-500">{row.count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 max-w-[80px]">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="text-slate-500 text-xs">{row.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Services Table */}
        <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
          <div className="px-6 py-4 border-b border-content-border bg-content-surface/80">
            <h2 className="text-ink font-semibold">Top Services</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Service', 'Count', 'Revenue'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SERVICES.map((row) => (
                <tr key={row.service} className="border-b border-content-border/50 hover:bg-content-surface">
                  <td className="px-4 py-3 text-ink">{row.service}</td>
                  <td className="px-4 py-3 text-slate-500">{row.count}</td>
                  <td className="px-4 py-3 font-medium text-primary">
                    KES {row.revenue.toLocaleString('en-KE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Forecast */}
      <div className="rounded-card p-4 border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">AI Revenue Forecast</p>
            <p className="text-sm text-slate-600 mt-1">
              Next week projected revenue: <strong className="text-ink">KES 520,000</strong> based on seasonal
              patterns and current patient flow. Insurance claim settlement expected to add KES 95,000 within
              7 days if submitted by end of today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
