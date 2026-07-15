'use client';

import { useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from './StatusBadge';

interface AICostEntry {
  date: string;
  huggingface: number;
  groq: number;
  gemini: number;
  openai: number;
  claude: number;
}

interface AICostTrendProps {
  data: AICostEntry[];
  budget?: number;
  className?: string;
}

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  huggingface: { label: 'HuggingFace', color: 'bg-violet-500' },
  groq: { label: 'Groq', color: 'bg-emerald-500' },
  gemini: { label: 'Gemini', color: 'bg-blue-500' },
  openai: { label: 'OpenAI', color: 'bg-amber-500' },
  claude: { label: 'Claude', color: 'bg-rose-500' },
};

const PROVIDERS = Object.keys(PROVIDER_META) as Array<keyof typeof PROVIDER_META>;

export function AICostTrend({ data, budget, className }: AICostTrendProps) {
  const totals = useMemo(() => {
    const byProvider: Record<string, number> = {};
    let grandTotal = 0;
    for (const entry of data) {
      for (const p of PROVIDERS) {
        const cost = entry[p] ?? 0;
        byProvider[p] = (byProvider[p] ?? 0) + cost;
        grandTotal += cost;
      }
    }
    return { byProvider, grandTotal, days: data.length };
  }, [data]);

  const dailyAvg = totals.days > 0 ? totals.grandTotal / totals.days : 0;
  const budgetPct = budget ? (totals.grandTotal / budget) * 100 : null;

  const lastDay = data[data.length - 1];
  const prevDay = data[data.length - 2];
  const lastDayTotal = lastDay ? PROVIDERS.reduce((s, p) => s + (lastDay[p] ?? 0), 0) : 0;
  const prevDayTotal = prevDay ? PROVIDERS.reduce((s, p) => s + (prevDay[p] ?? 0), 0) : 0;
  const deltaPct = prevDayTotal > 0 ? ((lastDayTotal - prevDayTotal) / prevDayTotal) * 100 : 0;

  const TrendIcon = deltaPct > 2 ? TrendingUp : deltaPct < -2 ? TrendingDown : Minus;
  const trendTone = deltaPct > 10 ? 'danger' : deltaPct > 0 ? 'warning' : 'success';

  return (
    <div className={cn('rounded-card border border-content-border bg-content-bg shadow-card', className)}>
      <div className="px-5 py-4 border-b border-content-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-portal-primary" />
          <h3 className="text-base font-semibold text-ink">AI Cost Trend</h3>
        </div>
        <span className="text-xs text-slate">{totals.days}-day window</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="text-center">
          <p className="text-xs text-slate">Total spend</p>
          <p className="text-xl font-bold text-ink">${totals.grandTotal.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate">Daily avg</p>
          <p className="text-xl font-bold text-ink">${dailyAvg.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate">vs yesterday</p>
          <div className="flex items-center justify-center gap-1">
            <TrendIcon className="h-4 w-4" />
            <StatusBadge tone={trendTone} size="sm">
              {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
            </StatusBadge>
          </div>
        </div>
      </div>

      {/* Budget bar */}
      {budget != null && budget > 0 && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-xs text-slate mb-1">
            <span>Budget utilization</span>
            <span className="font-mono">{budgetPct?.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-content-border overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                (budgetPct ?? 0) > 90 ? 'bg-red-500' : (budgetPct ?? 0) > 70 ? 'bg-amber-500' : 'bg-portal-primary',
              )}
              style={{ width: `${Math.min(100, budgetPct ?? 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate mt-1">
            ${totals.grandTotal.toFixed(2)} of ${budget.toFixed(2)} budget
          </p>
        </div>
      )}

      {/* Provider breakdown */}
      <div className="px-4 pb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate mb-2">By Provider</h4>
        <div className="space-y-2">
          {PROVIDERS.map((p) => {
            const cost = totals.byProvider[p] ?? 0;
            const pct = totals.grandTotal > 0 ? (cost / totals.grandTotal) * 100 : 0;
            const meta = PROVIDER_META[p];
            return (
              <div key={p} className="flex items-center gap-3">
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', meta.color)} />
                <span className="text-sm text-charcoal w-24 truncate">{meta.label}</span>
                <div className="flex-1 h-2 bg-content-border rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', meta.color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate tabular-nums w-16 text-right">${cost.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sparkline (simple bar chart) */}
      {data.length > 1 && (
        <div className="px-4 pb-4 border-t border-content-border pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate mb-2">Daily spend</h4>
          <div className="flex items-end gap-1 h-16">
            {data.map((entry, i) => {
              const dayTotal = PROVIDERS.reduce((s, p) => s + (entry[p] ?? 0), 0);
              const maxDay = Math.max(1, ...data.map((d) => PROVIDERS.reduce((s, p) => s + (d[p] ?? 0), 0)));
              const h = Math.round((dayTotal / maxDay) * 100);
              return (
                <div
                  key={i}
                  className="flex-1 min-w-0 rounded-sm bg-portal-primary/60 transition-all"
                  style={{ height: `${h}%` }}
                  title={`${entry.date}: $${dayTotal.toFixed(2)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate mt-1">
            <span>{data[0]?.date}</span>
            <span>{data[data.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AICostTrend;
