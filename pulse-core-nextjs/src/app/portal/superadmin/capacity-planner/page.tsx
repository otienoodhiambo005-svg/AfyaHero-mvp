'use client';

import { useCallback, useEffect, useState } from 'react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Flag,
  X,
  MapPin,
} from 'lucide-react';

interface ForecastBlock {
  projectedQueueArrivals: number;
  deltaPctVsPriorDay?: number;
  deltaPctVsLast7?: number;
  priorDayArrivals?: number;
  last7dArrivals?: number;
  method: string;
}

interface FacilityRow {
  hospitalId: string;
  name: string;
  location: string | null;
  isActive: boolean;
  occupancyPct: number | null;
  bedsTotal: number;
  bedsOccupied: number;
  activeQueue: number;
  avgWaitMinutes: number;
  urgentInQueue: number;
  queuePressure: number;
  labStuckOver48h: number;
  bottleneckScore: number;
  forecast24h: ForecastBlock & { priorDayArrivals: number; deltaPctVsPriorDay: number };
  forecast7d: ForecastBlock & { last7dArrivals: number; deltaPctVsLast7: number };
  proactiveSupport: {
    flaggedAt: string;
    actorEmail: string | null;
    note?: string;
  } | null;
}

interface CapacityPayload {
  generatedAt: string;
  facilities: FacilityRow[];
}

function bottleneckStyles(score: number) {
  if (score >= 75) return 'text-danger bg-danger/15 border-danger/25';
  if (score >= 50) return 'text-warning bg-warning/15 border-warning/25';
  if (score >= 30) return 'text-warning bg-warning/10 border-warning/20';
  return 'text-success bg-success/10 border-success/20';
}

function deltaIcon(delta: number) {
  if (delta > 3) return <TrendingUp className="w-3.5 h-3.5 text-danger" aria-hidden />;
  if (delta < -3) return <TrendingDown className="w-3.5 h-3.5 text-success" aria-hidden />;
  return <Minus className="w-3.5 h-3.5 text-slate" aria-hidden />;
}

export default function CapacityPlannerPage() {
  const [data, setData] = useState<CapacityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagTarget, setFlagTarget] = useState<FacilityRow | null>(null);
  const [flagNote, setFlagNote] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/capacity-planner', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setData(null);
        setError(typeof json.error === 'string' ? json.error : 'Failed to load capacity data');
        return;
      }
      setData(json as CapacityPayload);
    } catch {
      setData(null);
      setError('Network error while loading capacity planner');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitFlag = async () => {
    if (!flagTarget) return;
    setFlagSubmitting(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/superadmin/capacity-planner/flag', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: flagTarget.hospitalId,
          note: flagNote.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage({
          type: 'err',
          text: typeof json.error === 'string' ? json.error : 'Could not record flag',
        });
        return;
      }
      setActionMessage({
        type: 'ok',
        text: typeof json.message === 'string' ? json.message : 'Facility flagged for proactive support.',
      });
      setFlagTarget(null);
      setFlagNote('');
      await load();
    } catch {
      setActionMessage({ type: 'err', text: 'Network error while saving flag' });
    } finally {
      setFlagSubmitting(false);
    }
  };

  return (
    <PageLayout
      title="Capacity planner"
      subtitle="Cross-hospital occupancy, queue pressure, and arrival forecasts for proactive operations."
      maxWidth="full"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-card border border-content-border bg-content-surface px-4 py-2 text-sm font-semibold text-charcoal shadow-card transition hover:bg-content-bg disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          Refresh
        </button>
      }
    >
      {actionMessage && (
        <div
          className={cn(
            'mb-4 rounded-card border px-4 py-3 text-sm',
            actionMessage.type === 'ok'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-danger/30 bg-danger/10 text-danger',
          )}
          role="status"
        >
          {actionMessage.text}
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Loading cross-facility capacity signals…</p>
        </div>
      )}

      {error && !loading && (
        <PageSection
          className="border-danger/30 bg-danger/5"
          contentClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-danger">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-card border border-danger/30 bg-content-bg px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </PageSection>
      )}

      {data && (
        <PageSection
          title="Facilities"
          description={`Snapshot generated ${new Date(data.generatedAt).toLocaleString()}. Forecasts use linear trend on daily queue arrivals (UTC).`}
          className="border-content-border bg-content-surface"
        >
          {loading && (
            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-slate">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" aria-hidden />
              Refreshing capacity signals…
            </p>
          )}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-content-border text-xs font-bold uppercase tracking-wider text-slate">
                  <th className="pb-3 pr-4">Facility</th>
                  <th className="pb-3 pr-4">Occupancy</th>
                  <th className="pb-3 pr-4">Queue</th>
                  <th className="pb-3 pr-4">Pressure</th>
                  <th className="pb-3 pr-4">Bottleneck</th>
                  <th className="pb-3 pr-4">Forecast 24h</th>
                  <th className="pb-3 pr-4">Forecast 7d</th>
                  <th className="pb-3 pr-4">Support</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-content-border">
                {data.facilities.map((f) => (
                  <tr key={f.hospitalId} className="text-charcoal">
                    <td className="py-3 pr-4 align-top">
                      <div className="font-semibold text-charcoal">{f.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="line-clamp-1">{f.location || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      {f.occupancyPct == null ? (
                        <span className="text-slate">No beds</span>
                      ) : (
                        <span className="font-mono tabular-nums">{f.occupancyPct}%</span>
                      )}
                      <div className="text-xs text-slate">
                        {f.bedsOccupied}/{f.bedsTotal} beds
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top font-mono tabular-nums">
                      <div>{f.activeQueue} active</div>
                      <div className="text-xs text-slate">
                        μ wait {f.avgWaitMinutes}m · urgent {f.urgentInQueue}
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top font-mono tabular-nums">{f.queuePressure}</td>
                    <td className="py-3 pr-4 align-top">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-lg border px-2 py-1 text-xs font-bold font-mono tabular-nums',
                          bottleneckStyles(f.bottleneckScore),
                        )}
                      >
                        {f.bottleneckScore}
                      </span>
                      <div className="mt-1 text-xs text-slate">
                        labs &gt;48h: {f.labStuckOver48h}
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="flex items-center gap-1.5 font-mono tabular-nums">
                        {deltaIcon(f.forecast24h.deltaPctVsPriorDay)}
                        <span>{f.forecast24h.projectedQueueArrivals}</span>
                      </div>
                      <div className="text-xs text-slate">
                        Δ {f.forecast24h.deltaPctVsPriorDay}% vs prior day
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="flex items-center gap-1.5 font-mono tabular-nums">
                        {deltaIcon(f.forecast7d.deltaPctVsLast7)}
                        <span>{f.forecast7d.projectedQueueArrivals}</span>
                      </div>
                      <div className="text-xs text-slate">
                        Δ {f.forecast7d.deltaPctVsLast7}% vs last 7d total
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate">
                      {f.proactiveSupport ? (
                        <>
                          <div className="font-medium text-charcoal">Flagged</div>
                          <div>{new Date(f.proactiveSupport.flaggedAt).toLocaleString()}</div>
                          {f.proactiveSupport.actorEmail && (
                            <div className="truncate max-w-[140px]" title={f.proactiveSupport.actorEmail}>
                              {f.proactiveSupport.actorEmail}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                    <td className="py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setFlagTarget(f);
                          setFlagNote('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-content-border bg-content-bg px-3 py-1.5 text-xs font-bold text-charcoal hover:bg-content-surface"
                      >
                        <Flag className="h-3.5 w-3.5 text-primary" aria-hidden />
                        Flag
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.facilities.length === 0 && (
            <p className="text-sm text-slate">No active facilities found.</p>
          )}
        </PageSection>
      )}

      {flagTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flag-dialog-title"
        >
          <div className="w-full max-w-md rounded-t-2xl border border-content-border bg-content-surface shadow-2xl sm:rounded-card">
            <div className="flex items-center justify-between border-b border-content-border px-5 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <h2 id="flag-dialog-title" className="truncate text-lg font-bold text-charcoal">
                  Proactive support
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !flagSubmitting && setFlagTarget(null)}
                className="rounded-lg p-2 text-slate hover:bg-content-bg hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-slate">
                Flag <span className="font-semibold text-charcoal">{flagTarget.name}</span> for
                proactive support. This is written to the audit log.
              </p>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate">
                Optional note
                <textarea
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-card border border-content-border bg-content-surface px-3 py-2 text-sm text-ink placeholder:text-slate outline-none ring-primary/30 focus:ring-2"
                  placeholder="Context for the support team…"
                  maxLength={2000}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={flagSubmitting}
                  onClick={() => setFlagTarget(null)}
                  className="rounded-card border border-content-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-content-bg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={flagSubmitting}
                  onClick={() => void submitFlag()}
                  className="inline-flex items-center gap-2 rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {flagSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Confirm flag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
