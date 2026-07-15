'use client';

import { useState } from 'react';
import { TrendingUp, Users, DollarSign, ShieldAlert, Download, BarChart3, Brain } from 'lucide-react';

const ACCENT = '#3282B8';

type Range = 'Today' | 'Week' | 'Month' | 'Quarter';

const KPI_DATA: Record<Range, { occupancy: string; revenue: string; claims: string; incidents: string }> = {
  Today:   { occupancy: '86%', revenue: 'KES 1.42M', claims: '23', incidents: '1' },
  Week:    { occupancy: '83%', revenue: 'KES 9.74M', claims: '141', incidents: '3' },
  Month:   { occupancy: '81%', revenue: 'KES 38.2M', claims: '587', incidents: '11' },
  Quarter: { occupancy: '79%', revenue: 'KES 114M',  claims: '1842', incidents: '34' },
};

const DEPT_PERFORMANCE = [
  { dept: 'Outpatient', visits: 892, revenue: 'KES 1.34M', satisfaction: 92 },
  { dept: 'Laboratory',  visits: 534, revenue: 'KES 0.80M', satisfaction: 89 },
  { dept: 'Pharmacy',    visits: 710, revenue: 'KES 0.36M', satisfaction: 95 },
  { dept: 'Maternity',   visits: 78,  revenue: 'KES 0.93M', satisfaction: 97 },
  { dept: 'ICU',         visits: 24,  revenue: 'KES 2.88M', satisfaction: 85 },
];

const MONTHLY_BARS = [
  { month: 'Jan', value: 82 }, { month: 'Feb', value: 78 },
  { month: 'Mar', value: 85 }, { month: 'Apr', value: 80 },
  { month: 'May', value: 88 }, { month: 'Jun', value: 83 },
];
const MAX_BAR = 100;

export default function AdminReportsPage() {
  const [range, setRange] = useState<Range>('Month');
  const kpi = KPI_DATA[range];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Executive Reports</h1>
        <div className="flex gap-2">
          {(['Today', 'Week', 'Month', 'Quarter'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={range === r
                ? { background: ACCENT, color: '#fff', borderColor: ACCENT }
                : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}
            >
              {r}
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-content-border bg-content-bg text-slate-600 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Facility Occupancy', value: kpi.occupancy, icon: <BarChart3 className="w-4 h-4" />, color: '#3282B8' },
          { label: 'Revenue',            value: kpi.revenue,   icon: <DollarSign className="w-4 h-4" />, color: '#16a34a' },
          { label: 'Insurance Claims',   value: kpi.claims,    icon: <Users className="w-4 h-4" />,      color: '#d97706' },
          { label: 'Critical Incidents', value: kpi.incidents, icon: <ShieldAlert className="w-4 h-4" />, color: '#dc2626' },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <span style={{ color: k.color }}>{k.icon}</span>
              <p className="text-xs uppercase tracking-wide">{k.label}</p>
            </div>
            <p className="text-2xl font-bold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Occupancy trend bar chart */}
      <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-ink">Occupancy Trend (6-Month)</h2>
        </div>
        <div className="flex items-end gap-3 h-32">
          {MONTHLY_BARS.map((b) => (
            <div key={b.month} className="flex flex-col items-center gap-1 flex-1">
              <p className="text-xs font-semibold text-slate-700">{b.value}%</p>
              <div className="w-full rounded-t-md" style={{ height: `${(b.value / MAX_BAR) * 100}px`, background: ACCENT, opacity: 0.85 }} />
              <p className="text-xs text-slate-500">{b.month}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Department Performance */}
      <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-ink">Department Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-content-border">
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Monthly Visits</th>
                <th className="py-2 pr-4">Revenue</th>
                <th className="py-2">Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {DEPT_PERFORMANCE.map((d) => (
                <tr key={d.dept} className="border-b border-content-border/50">
                  <td className="py-2 pr-4 font-medium text-ink">{d.dept}</td>
                  <td className="py-2 pr-4 text-slate-600">{d.visits.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-slate-600">{d.revenue}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.satisfaction}%`, background: d.satisfaction >= 90 ? '#16a34a' : '#d97706' }} />
                      </div>
                      <span className="text-xs text-slate-700">{d.satisfaction}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-card border border-blue-100 bg-blue-50 p-4 shadow-card flex gap-3">
        <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">AI Executive Insight</p>
          <p className="text-sm text-blue-800 mt-0.5">
            ICU is operating at 100% capacity — consider activating overflow protocols. Pharmacy satisfaction leads at 95%.
            Revenue trajectory is 8% above last quarter at this point. Maternity ward shows highest bed-day revenue (KES 11,923/day).
          </p>
        </div>
      </div>
    </div>
  );
}