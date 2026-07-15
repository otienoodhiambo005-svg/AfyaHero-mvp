'use client';

import { BrainCircuit, FlaskConical, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestVolume {
  test: string;
  volume: number;
  pct: number;
  avgTat: string;
  positivity: string;
}

interface TatBar {
  category: string;
  actual: number;
  target: number;
}

interface Surveillance {
  condition: string;
  count: number;
  pct: number;
  trend: 'up' | 'down' | 'stable';
}

const dateRange: string = '1 Jan 2025 – 15 Jan 2025';

const testVolumes: TestVolume[] = [
  { test: 'CBC / FBC',                 volume: 98,  pct: 28.7, avgTat: '38 min',  positivity: '34%' },
  { test: 'Malaria RDT + Smear',        volume: 72,  pct: 21.1, avgTat: '18 min',  positivity: '48%' },
  { test: 'Urinalysis',                 volume: 54,  pct: 15.8, avgTat: '22 min',  positivity: '31%' },
  { test: 'Blood Chemistry (LFT/RFT)',  volume: 42,  pct: 12.3, avgTat: '55 min',  positivity: '22%' },
  { test: 'HbA1c',                      volume: 28,  pct: 8.2,  avgTat: '25 min',  positivity: '67%' },
  { test: 'Sputum AFB',                 volume: 18,  pct: 5.3,  avgTat: '24h',     positivity: '11%' },
  { test: 'Blood Culture',              volume: 14,  pct: 4.1,  avgTat: '48–72h',  positivity: '14%' },
  { test: 'Pregnancy Test β-hCG',       volume: 16,  pct: 4.7,  avgTat: '15 min',  positivity: '44%' },
];

const tatBars: TatBar[] = [
  { category: 'CBC',           actual: 38,   target: 60 },
  { category: 'Chemistry',     actual: 55,   target: 60 },
  { category: 'Microbiology',  actual: 2880, target: 1440 },
  { category: 'Malaria RDT',   actual: 18,   target: 30 },
  { category: 'Urinalysis',    actual: 22,   target: 30 },
];

const surveillance: Surveillance[] = [
  { condition: 'Malaria (P. falciparum)', count: 116, pct: 34, trend: 'up' },
  { condition: 'Urinary Tract Infection', count: 95,  pct: 28, trend: 'stable' },
  { condition: 'Anaemia',                 count: 82,  pct: 24, trend: 'stable' },
  { condition: 'Type 2 Diabetes',         count: 67,  pct: 20, trend: 'up' },
  { condition: 'Typhoid Fever',           count: 34,  pct: 10, trend: 'down' },
];

const trendColor = (t: Surveillance['trend']): string => {
  switch (t) {
    case 'up':     return 'text-rose-700';
    case 'down':   return 'text-emerald-700';
    case 'stable': return 'text-slate-600';
  }
};

const trendIcon = (t: Surveillance['trend']): string => {
  switch (t) { case 'up': return '↑'; case 'down': return '↓'; case 'stable': return '→'; }
};

export default function LabReportsPage(): React.ReactElement {
  const maxVolume = Math.max(...testVolumes.map((t) => t.volume));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Laboratory Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dateRange}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-content-bg border border-content-border shadow-card">
          <span className="text-xs text-slate-500">Date Range</span>
          <select aria-label="Select reports date range" className="bg-transparent text-slate-700 text-sm focus:outline-none">
            <option>This Month</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Custom</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tests Performed', value: '342',  sub: 'This period',       color: 'text-violet-700', icon: <FlaskConical className="w-5 h-5" /> },
          { label: 'Avg TAT',         value: '42 min', sub: 'All test types',   color: 'text-violet-700', icon: <Clock className="w-5 h-5" /> },
          { label: 'Critical Results', value: '12',   sub: 'Notified within 1h', color: 'text-rose-700',    icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Rejection Rate',  value: '2.1%', sub: 'Below 5% target',   color: 'text-emerald-700', icon: <TrendingUp className="w-5 h-5" /> },
        ].map((k) => (
          <div key={k.label} className="rounded-card bg-content-bg border border-content-border p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">{k.label}</span>
              <span className={k.color}>{k.icon}</span>
            </div>
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Test Volume Table */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-content-border">
          <h2 className="text-sm font-semibold text-ink">Test Volume by Type</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Test Name', 'Volume', '% of Total', 'Avg TAT', 'Positivity Rate'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testVolumes.map((t, i) => (
                <tr key={i} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{t.test}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-violet-500"
                          style={{ width: `${(t.volume / maxVolume) * 100}%` }}
                        />
                      </div>
                      <span className="text-ink font-medium">{t.volume}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.pct}%</td>
                  <td className="px-4 py-3 text-slate-600">{t.avgTat}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-sm font-medium',
                      parseFloat(t.positivity) > 40 ? 'text-rose-700' :
                      parseFloat(t.positivity) > 25 ? 'text-amber-700' : 'text-emerald-700'
                    )}>
                      {t.positivity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TAT Performance */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-700" /> TAT Performance vs Target
        </h2>
        <div className="space-y-4">
          {tatBars.map((bar, i) => {
            const isOver = bar.actual > bar.target;
            const displayMax = Math.max(bar.actual, bar.target);
            const actualPct = (bar.actual / displayMax) * 100;
            const targetPct = (bar.target / displayMax) * 100;
            const displayActual = bar.actual >= 60 ? `${(bar.actual / 60).toFixed(0)}h` : `${bar.actual}m`;
            const displayTarget = bar.target >= 60 ? `${(bar.target / 60).toFixed(0)}h` : `${bar.target}m`;
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-600">{bar.category}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={isOver ? 'text-rose-700 font-medium' : 'text-emerald-700 font-medium'}>
                      Actual: {displayActual}
                    </span>
                    <span className="text-slate-500">Target: {displayTarget}</span>
                  </div>
                </div>
                <div className="relative h-5 rounded-full bg-slate-200">
                  {/* Target line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400/60 z-10"
                    style={{ left: `${targetPct}%` }}
                  />
                  {/* Actual bar */}
                  <div
                    className={cn('h-5 rounded-full transition-all', isOver ? 'bg-red-500' : 'bg-violet-500')}
                    style={{ width: `${Math.min(actualPct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-500 mt-2">Microbiology excluded from standard TAT (culture-dependent)</p>
        </div>
      </div>

      {/* Disease Surveillance */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-700" /> Disease Surveillance — Top Positive Findings
        </h2>
        <div className="space-y-3">
          {surveillance.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-5 shrink-0 text-right">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-ink">{s.condition}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', trendColor(s.trend))}>{trendIcon(s.trend)} {s.trend}</span>
                    <span className="text-sm font-bold text-ink">{s.pct}%</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-violet-500"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{s.count} positive results</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Trend */}
      <div className="flex gap-3 rounded-card border border-portal-primary/25 bg-portal-primary-light/30 p-4">
        <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-portal-primary" />
        <div>
          <p className="mb-1 text-sm font-semibold text-portal-primary">AI Trend Analysis</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Malaria positivity rate increased <span className="text-ink font-medium">12%</span> vs last month — consistent with seasonal patterns (long rains). UTI positivity remains elevated suggesting possible water quality issue in catchment area. Recommend notifying Public Health Officer.
          </p>
        </div>
      </div>
    </div>
  );
}
