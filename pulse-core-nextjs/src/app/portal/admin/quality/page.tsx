'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Brain, FileDown, CheckSquare, Square, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import QualityIntelligenceDashboard from '@/components/admin/QualityIntelligenceDashboard';

interface QualityMetric {
  label: string;
  value: string;
  benchmark: string;
  good: boolean;
}

interface MonthlyRow {
  month: string;
  opd: number;
  admissions: number;
  discharges: number;
  deaths: number;
  maternalMortality: number;
}

interface ComplianceItem {
  id: number;
  label: string;
  dueDate: string;
  checked: boolean;
}

const METRICS: QualityMetric[] = [
  { label: 'Hospital-Acquired Infections', value: '2.1%', benchmark: '<2% benchmark', good: false },
  { label: '30-day Readmission Rate', value: '4.8%', benchmark: '<5% benchmark', good: true },
  { label: 'Average Length of Stay', value: '3.2 days', benchmark: '3.5 days target', good: true },
  { label: 'Patient Satisfaction', value: '4.2 / 5', benchmark: '4.0 target', good: true },
];


export default function QualityPage() {
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuality = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/quality', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load quality data (${res.status})`);
      const data = await res.json();
      setCompliance(Array.isArray(data.compliance) ? data.compliance : []);
      setMonthly(Array.isArray(data.monthly) ? data.monthly : []);
    } catch (err) {
      logger.error('Failed to load quality data', { error: err });
      setError(err instanceof Error ? err.message : 'Could not load quality data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQuality(); }, [loadQuality]);

  function toggleItem(id: number) {
    setCompliance((items) =>
      items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  const completedCount = compliance.filter((c) => c.checked).length;
  const totalCount = compliance.length;
  const completionPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Quality &amp; Compliance</h1>
          <p className="text-slate-500 text-sm mt-0.5">Indicators, metrics and regulatory compliance tracking</p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-card font-semibold text-sm text-slate-700 border border-content-border bg-content-bg hover:bg-slate-100 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export HMIS Report
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-card font-semibold text-sm text-white bg-primary hover:opacity-90 transition-opacity"
          >
            <FileDown className="w-4 h-4" />
            Export to DHIS2
          </button>
        </div>
      </div>

      {/* AI-Powered Quality Intelligence - Desktop/Tablet Optimized */}
      <QualityIntelligenceDashboard />

      {/* Quality Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              'bg-content-bg border rounded-card p-4 space-y-2 shadow-card',
              metric.good ? 'border-success/20' : 'border-danger/20',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-xs font-medium leading-tight pr-2">{metric.label}</span>
              {metric.good ? (
                <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-danger flex-shrink-0" />
              )}
            </div>
            <p className={cn('text-2xl font-bold', metric.good ? 'text-success' : 'text-danger')}>
              {metric.value}
            </p>
            <p className="text-slate-500 text-xs">{metric.benchmark}</p>
          </div>
        ))}
      </div>

      {/* AI Alert */}
      <div className="rounded-card p-4 border border-danger/20 bg-danger/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">AI Quality Alert</p>
            <p className="text-sm text-slate-700 mt-1">
              Hospital-acquired infection rate in Surgical ward is elevated at{' '}
              <strong className="text-ink">3.8%</strong> vs 2% benchmark. Recommend urgent infection
              control audit and review of post-op antibiotic protocols. ICU HAI rate stable at 1.9%.
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Metrics Table */}
      <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-content-border">
          <h2 className="text-ink font-semibold">Monthly Quality Metrics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Month', 'OPD Volume', 'Admissions', 'Discharges', 'Deaths', 'Maternal Mortality'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthly.map((row, idx) => (
                <tr
                  key={row.month}
                  className={cn(
                    'border-b border-content-border/50 hover:bg-content-surface transition-colors',
                    idx === monthly.length - 1 && 'bg-content-surface',
                  )}
                >
                  <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">
                    {row.month}
                    {idx === monthly.length - 1 && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary"
                      >
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.opd.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{row.admissions}</td>
                  <td className="px-4 py-3 text-slate-600">{row.discharges}</td>
                  <td className={cn('px-4 py-3 font-medium', row.deaths > 3 ? 'text-danger' : 'text-slate-600')}>
                    {row.deaths}
                  </td>
                  <td className={cn('px-4 py-3 font-medium', row.maternalMortality > 0 ? 'text-danger' : 'text-success')}>
                    {row.maternalMortality > 0 ? row.maternalMortality : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-content-border flex items-center justify-between">
          <h2 className="text-ink font-semibold">Compliance Checklist</h2>
          <div className="flex items-center gap-3">
            <span className="text-slate-600 text-sm">{completedCount}/{totalCount} completed</span>
            <div className="w-24 bg-slate-200 rounded-full h-2">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  completionPct >= 80 ? 'bg-info' : completionPct >= 50 ? 'bg-primary' : 'bg-danger',
                )}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span
              className={cn(
                'text-xs font-bold',
                completionPct >= 80 ? 'text-info' : completionPct >= 50 ? 'text-primary' : 'text-danger',
              )}
            >
              {completionPct}%
            </span>
          </div>
        </div>
        <div className="divide-y divide-content-border/50">
          {compliance.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              className="px-6 py-4 flex items-start gap-3 hover:bg-content-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
              onClick={() => toggleItem(item.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(item.id); } }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {item.checked ? (
                  <CheckSquare className="w-5 h-5 text-success" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={cn('text-sm', item.checked ? 'text-slate-500 line-through' : 'text-ink')}>
                  {item.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Due: {item.dueDate}</p>
              </div>
              {!item.checked && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/5 text-warning flex-shrink-0">
                  Pending
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI DHIS2 Readiness */}
      <div className="rounded-card p-4 border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">AI DHIS2 Readiness Check</p>
            <p className="text-sm text-slate-700 mt-1">
              {completedCount >= 6
                ? `${completedCount} of ${totalCount} compliance items complete — data is ready for DHIS2 export. Click "Export to DHIS2" to submit this month's indicators to the County Health Office.`
                : `${totalCount - completedCount} compliance item${totalCount - completedCount !== 1 ? 's' : ''} still pending. Complete all items before exporting to DHIS2 for accurate reporting.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
