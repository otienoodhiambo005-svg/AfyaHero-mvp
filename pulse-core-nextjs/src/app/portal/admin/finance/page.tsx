'use client';

import { useState } from 'react';
import { Brain, ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Month = 'January 2025' | 'February 2025' | 'March 2025';

interface ARRow {
  insurer: string;
  lt30: number;
  d3160: number;
  d6190: number;
  gt90: number;
}

interface BudgetRow {
  department: string;
  budget: number;
  actual: number;
}

const AR_DATA: ARRow[] = [
  { insurer: 'SHIF', lt30: 280000, d3160: 145000, d6190: 62000, gt90: 34000 },
  { insurer: 'Jubilee Insurance', lt30: 95000, d3160: 48000, d6190: 22000, gt90: 8000 },
  { insurer: 'AAR Healthcare', lt30: 72000, d3160: 31000, d6190: 12000, gt90: 5000 },
  { insurer: 'Britam', lt30: 41000, d3160: 18000, d6190: 9000, gt90: 0 },
  { insurer: 'CIC Insurance', lt30: 28000, d3160: 11000, d6190: 4000, gt90: 0 },
];

const BUDGET: BudgetRow[] = [
  { department: 'OPD / Outpatient', budget: 800000, actual: 724000 },
  { department: 'Inpatient / Wards', budget: 600000, actual: 582000 },
  { department: 'Laboratory', budget: 350000, actual: 412000 },
  { department: 'Pharmacy', budget: 450000, actual: 398000 },
  { department: 'Radiology', budget: 200000, actual: 187000 },
  { department: 'Emergency', budget: 100000, actual: 118000 },
];

const REVENUE_BREAKDOWN = [
  { label: 'OPD Consultations', pct: 35, colorClass: 'bg-primary' },
  { label: 'Pharmacy', pct: 28, colorClass: 'bg-success' },
  { label: 'Laboratory', pct: 22, colorClass: 'bg-info' },
  { label: 'Ward Charges', pct: 10, colorClass: 'bg-warning' },
  { label: 'Other', pct: 5, colorClass: 'bg-slate' },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `KES ${(n / 1000).toFixed(0)}K`;
  return `KES ${n}`;
}

export default function FinancePage() {
  const [month, setMonth] = useState<Month>('January 2025');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Financial Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">P&amp;L, AR aging and budget performance</p>
        </div>
        <div className="relative">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value as Month)}
            className="appearance-none bg-content-bg border border-content-border rounded-card px-4 py-2 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option>January 2025</option>
            <option>February 2025</option>
            <option>March 2025</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: 'KES 2.1M', sub: '+4.2% vs last month', up: true, valueClass: 'text-primary' },
          { label: 'Total Expenses', value: 'KES 1.6M', sub: '-1.8% vs last month', up: false, valueClass: 'text-danger' },
          { label: 'Net Income', value: 'KES 500K', sub: 'Margin: 23.8%', up: true, valueClass: 'text-success' },
        ].map((card) => (
          <div key={card.label} className="bg-content-bg border border-content-border rounded-card p-5 space-y-2 shadow-card">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{card.label}</p>
            <p className={cn('text-3xl font-bold', card.valueClass)}>{card.value}</p>
            <div className={cn('flex items-center gap-1 text-xs font-medium', card.up ? 'text-success' : 'text-danger')}>
              {card.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-content-bg border border-content-border rounded-card p-6 shadow-card">
        <h2 className="text-ink font-semibold mb-5">Revenue Breakdown</h2>
        <div className="space-y-3">
          {REVENUE_BREAKDOWN.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={cn('w-3 h-3 rounded-full flex-shrink-0', item.colorClass)} />
              <span className="text-slate-600 text-sm w-44 flex-shrink-0">{item.label}</span>
              <div className="flex-1 bg-slate-200 rounded-full h-5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full flex items-center pl-2 transition-all duration-700', item.colorClass)}
                  style={{ width: `${item.pct}%` }}
                >
                  <span className="text-ink text-xs font-semibold">{item.pct}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AR Aging Table */}
      <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-content-border">
          <h2 className="text-ink font-semibold">AR Aging by Insurer</h2>
          <p className="text-slate-500 text-xs mt-0.5">Outstanding insurance receivables breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Insurance Company', '<30 days', '31–60 days', '61–90 days', '>90 days', 'Total'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AR_DATA.map((row) => {
                const total = row.lt30 + row.d3160 + row.d6190 + row.gt90;
                return (
                  <tr key={row.insurer} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{row.insurer}</td>
                    <td className="px-4 py-3 text-success">{fmt(row.lt30)}</td>
                    <td className="px-4 py-3 text-warning">{fmt(row.d3160)}</td>
                    <td className="px-4 py-3 text-warning">{fmt(row.d6190)}</td>
                    <td className={cn('px-4 py-3 font-medium', row.gt90 > 0 ? 'text-danger' : 'text-slate-500')}>
                      {row.gt90 > 0 ? fmt(row.gt90) : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-primary">{fmt(total)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-content-border bg-content-surface">
                <td className="px-4 py-3 text-ink font-bold">TOTAL</td>
                {[
                  AR_DATA.reduce((s, r) => s + r.lt30, 0),
                  AR_DATA.reduce((s, r) => s + r.d3160, 0),
                  AR_DATA.reduce((s, r) => s + r.d6190, 0),
                  AR_DATA.reduce((s, r) => s + r.gt90, 0),
                ].map((val, i) => (
                  <td key={i} className="px-4 py-3 font-bold text-ink">{fmt(val)}</td>
                ))}
                <td className="px-4 py-3 font-bold text-primary">
                  {fmt(AR_DATA.reduce((s, r) => s + r.lt30 + r.d3160 + r.d6190 + r.gt90, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-content-border">
          <h2 className="text-ink font-semibold">Budget vs Actual — {month}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Department', 'Budget', 'Actual', 'Variance', '%'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUDGET.map((row) => {
                const variance = row.actual - row.budget;
                const pct = Math.round((row.actual / row.budget) * 100);
                return (
                  <tr key={row.department} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{row.department}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(row.budget)}</td>
                    <td className="px-4 py-3 text-ink">{fmt(row.actual)}</td>
                    <td className={cn('px-4 py-3 font-medium', variance >= 0 ? 'text-success' : 'text-danger')}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)}
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-semibold w-8', pct >= 100 ? 'text-success' : pct >= 90 ? 'text-warning' : 'text-danger')}>
                          {pct}%
                        </span>
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div
                            className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : pct >= 90 ? 'bg-warning' : 'bg-danger')}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Cashflow Forecast */}
      <div className="rounded-card p-4 border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">AI Cashflow Forecast</p>
            <p className="text-sm text-slate-700 mt-1">
              Based on current AR aging, projected cash receipts next 30 days:{' '}
              <strong className="text-white">KES 840,000</strong>. SHIF claims of KES 280,000 expected to
              settle within 14 days. Recommend escalating 3 claims aged &gt;90 days to insurance liaison.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
