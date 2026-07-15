'use client';

import { BrainCircuit, TrendingUp, Package, AlertTriangle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrugConsumption {
  drug: string;
  qty: number;
}

interface ABCItem {
  drug: string;
  annualUsage: number;
  value: number;
  category: 'A' | 'B' | 'C';
  pctSpend: number;
}

interface StockOutIncident {
  drug: string;
  daysOut: number;
  estimatedLostRevenue: number;
}

const dateRange: string = '1 Jan 2025 – 15 Jan 2025';

const topDrugs: DrugConsumption[] = [
  { drug: 'Artemether/Lumefantrine 80/480mg', qty: 628 },
  { drug: 'Amoxicillin 500mg Capsules',       qty: 544 },
  { drug: 'Paracetamol 500mg',                qty: 490 },
  { drug: 'ORS Sachets',                      qty: 380 },
  { drug: 'Metformin 500mg',                  qty: 352 },
  { drug: 'Ibuprofen 400mg',                  qty: 298 },
  { drug: 'Folic Acid 5mg',                   qty: 224 },
  { drug: 'Ferrous Sulphate 200mg',           qty: 208 },
  { drug: 'Ciprofloxacin 500mg',              qty: 186 },
  { drug: 'Amlodipine 5mg',                   qty: 162 },
];

const abcItems: ABCItem[] = [
  { drug: 'Insulin Actrapid 100IU/mL',     annualUsage: 240,   value: 672000, category: 'A', pctSpend: 22.4 },
  { drug: 'Coartem (Artemether/Lum.)',     annualUsage: 15000, value: 562500, category: 'A', pctSpend: 18.8 },
  { drug: 'Augmentin 625mg Tabs',          annualUsage: 2800,  value: 336000, category: 'A', pctSpend: 11.2 },
  { drug: 'Azithromycin 500mg',            annualUsage: 1400,  value: 124600, category: 'A', pctSpend: 4.2 },
  { drug: 'Norvasc (Amlodipine) 5mg',      annualUsage: 3000,  value: 108000, category: 'B', pctSpend: 3.6 },
  { drug: 'Glucophage (Metformin) 500mg',  annualUsage: 8400,  value: 107520, category: 'B', pctSpend: 3.6 },
  { drug: 'Atorvastatin 40mg',             annualUsage: 2400,  value: 72960,  category: 'B', pctSpend: 2.4 },
  { drug: 'Amoxicillin 500mg',             annualUsage: 13200, value: 66000,  category: 'B', pctSpend: 2.2 },
  { drug: 'Paracetamol 500mg',             annualUsage: 11800, value: 35400,  category: 'C', pctSpend: 1.2 },
  { drug: 'ORS Sachets',                   annualUsage: 9200,  value: 27600,  category: 'C', pctSpend: 0.9 },
];

const stockOutIncidents: StockOutIncident[] = [
  { drug: 'Oral Rehydration Salts (ORS)', daysOut: 4,  estimatedLostRevenue: 4800 },
  { drug: 'Ciprofloxacin 500mg',          daysOut: 6,  estimatedLostRevenue: 16200 },
  { drug: 'Metformin 500mg',              daysOut: 2,  estimatedLostRevenue: 3840 },
];

const abcColors: Record<ABCItem['category'], string> = {
  A: 'bg-red-100 text-red-600 border border-red-200',
  B: 'bg-amber-100 text-amber-600 border border-amber-200',
  C: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
};

const maxQty = topDrugs[0].qty;

export default function PharmacyReportsPage(): React.ReactElement {
  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
        <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary-light/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              Pharmacy intelligence
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">Pharmacy reports</h1>
            <p className="mt-2 text-sm text-slate-500">{dateRange} · consumption, revenue, ABC classification, and stock-out impact</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-content-border bg-content-bg px-3 py-2 shadow-sm">
            <span className="text-xs text-slate-500">Period</span>
            <select className="bg-transparent text-sm text-ink focus:outline-none">
              <option>This Month</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Custom Range</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Prescriptions',   value: '543',        sub: 'Received & processed',  color: 'text-cyan-400',    icon: <Package className="w-5 h-5" /> },
          { label: 'Drugs Dispensed', value: '1,847',      sub: 'Items dispensed',        color: 'text-cyan-400',    icon: <TrendingUp className="w-5 h-5" /> },
          { label: 'Revenue',         value: 'KES 156K',   sub: 'Gross dispensing revenue', color: 'text-emerald-400', icon: <DollarSign className="w-5 h-5" /> },
          { label: 'Generic Rate',    value: '67%',        sub: 'Generic substitution',   color: 'text-emerald-400', icon: <TrendingUp className="w-5 h-5" /> },
        ].map((k) => (
          <div key={k.label} className="rounded-[1.5rem] border border-content-border bg-content-bg p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">{k.label}</span>
              <span className={k.color}>{k.icon}</span>
            </div>
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Top 10 Drugs by Consumption */}
      <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-500" /> Top 10 Drugs by Consumption
        </h2>
        <div className="space-y-3">
          {topDrugs.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-5 shrink-0 text-right">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-ink">{d.drug}</span>
                  <span className="text-sm font-bold text-cyan-600">{d.qty}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${(d.qty / maxQty) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ABC Analysis */}
      <div className="overflow-hidden rounded-card border border-content-border bg-content-bg shadow-card">
        <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
          <h2 className="text-sm font-semibold text-ink">ABC Analysis — Drug Expenditure</h2>
          <p className="text-xs text-slate-500 mt-1">A = high value (80% spend) · B = medium value · C = low value</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Drug', 'Annual Usage', 'Value (KES)', 'Category', '% of Spend'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {abcItems.map((item, i) => (
                <tr key={i} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 font-medium text-ink max-w-[200px] truncate">{item.drug}</td>
                  <td className="px-4 py-3 text-slate-500">{item.annualUsage.toLocaleString()}</td>
                  <td className="px-4 py-3 text-ink">{item.value.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold', abcColors[item.category])}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-slate-100">
                        <div
                          className={cn('h-2 rounded-full', {
                            'bg-red-500': item.category === 'A',
                            'bg-amber-500': item.category === 'B',
                            'bg-emerald-500': item.category === 'C',
                          })}
                          style={{ width: `${Math.min(item.pctSpend * 3, 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-500 text-xs">{item.pctSpend}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock-Out Incidents */}
      <div className="overflow-hidden rounded-card border border-content-border bg-content-bg shadow-card">
        <div className="px-5 py-4 border-b border-content-border bg-content-surface/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Stock-Out Incidents This Month
          </h2>
          <span className="text-xs text-red-600 font-medium">Est. Revenue Impact: KES {stockOutIncidents.reduce((a, b) => a + b.estimatedLostRevenue, 0).toLocaleString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Drug', 'Days Out of Stock', 'Est. Lost Revenue (KES)'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stockOutIncidents.map((s, i) => (
                <tr key={i} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{s.drug}</td>
                  <td className="px-4 py-3">
                    <span className="text-red-600 font-bold">{s.daysOut} days</span>
                  </td>
                  <td className="px-4 py-3 text-amber-600 font-medium">{s.estimatedLostRevenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Demand Forecast */}
      <div className="rounded-card border border-cyan-200 bg-cyan-50 p-4 flex gap-3">
        <BrainCircuit className="w-5 h-5 text-cyan-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-cyan-600 mb-1">AI Demand Forecast</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Based on 90-day trend, stock <span className="text-ink font-medium">Metformin 500mg</span> for 45 days vs current 12-day supply.{' '}
            Order recommended: <span className="text-cyan-600 font-medium">200 packs</span> (KES 64,000).{' '}
            Coartem demand projected to increase 18% over next 30 days — consistent with rainy season malaria pattern. Order 300 additional packs.
          </p>
        </div>
      </div>
    </div>
  );
}
