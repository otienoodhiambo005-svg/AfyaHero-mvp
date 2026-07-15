'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Users, AlertTriangle, CheckCircle2, RefreshCw, History, ShieldAlert, UserPlus } from 'lucide-react';

type DeptQueue = {
  dept: string;
  waiting: number;
  inService: number;
  avgWait: number;
  slaTarget: number;
  alerts: string[];
};

type SummaryResponse = {
  updatedAt: string;
  departments: DeptQueue[];
};

type SlaActionEntry = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  detail: unknown;
  createdAt: string;
};

type SlaActionsResponse = {
  entries: SlaActionEntry[];
  hasMore?: boolean;
  nextOffset?: number | null;
  error?: string;
};

type BulkAtRiskResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  departments?: string[];
  ticketsUpdated?: number;
};

function formatSlaActionLabel(action: string): string {
  if (action === 'queue_sla_bulk_escalation_requested') return 'Bulk escalation (urgent priority)';
  if (action === 'queue_sla_bulk_overflow_assign') return 'Bulk overflow assignment';
  return action;
}

function summarizeDetail(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '';
  const d = detail as Record<string, unknown>;
  const depts = Array.isArray(d.departments) ? (d.departments as string[]).join(', ') : '';
  const n = typeof d.ticketsUpdated === 'number' ? d.ticketsUpdated : null;
  const parts = [depts && `Depts: ${depts}`, n !== null && `Tickets: ${n}`].filter(Boolean);
  return parts.join(' · ');
}

function bulkBusyToken(action: 'escalation_requested' | 'overflow_assign', departments?: string[]) {
  const a = action === 'escalation_requested' ? 'escalation' : 'overflow';
  if (!departments?.length) return a;
  return `${a}:${[...departments].sort().join(',')}`;
}

export default function AdminQueuePage() {
  const [queues, setQueues] = useState<DeptQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** Global: `escalation` | `overflow`; per-dept: `escalation:Medical` */
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [slaEntries, setSlaEntries] = useState<SlaActionEntry[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState<string | null>(null);
  const [slaRefreshing, setSlaRefreshing] = useState(false);
  const [slaHasMore, setSlaHasMore] = useState(false);
  const [slaLoadingMore, setSlaLoadingMore] = useState(false);
  /** Next `offset` for SLA log pagination; ref avoids stale closures and effect re-runs. */
  const slaNextPageOffsetRef = useRef(0);

  const loadSummary = useCallback(async (opts?: { silent?: boolean; feedback?: boolean }) => {
    const silent = opts?.silent ?? false;
    const feedback = opts?.feedback ?? false;
    if (silent) setRefreshing(true);
    else {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await fetch('/api/admin/queue/summary', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as SummaryResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load queue summary');
      }

      setQueues(data.departments ?? []);
      const t = data.updatedAt ? new Date(data.updatedAt) : new Date();
      setLastRefresh(t.toLocaleTimeString());
      setError(null);
      if (feedback) setActionMessage({ type: 'ok', text: 'Queue data refreshed.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load queue summary';
      setError(msg);
      if (feedback) setActionMessage({ type: 'err', text: msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadSlaActions = useCallback(async (opts?: { silent?: boolean; append?: boolean }) => {
    const silent = opts?.silent ?? false;
    const append = opts?.append ?? false;
    if (append) setSlaLoadingMore(true);
    else if (silent) setSlaRefreshing(true);
    else {
      setSlaLoading(true);
      setSlaError(null);
    }
    try {
      const offset = append ? slaNextPageOffsetRef.current : 0;
      const qs = new URLSearchParams({ limit: '30', offset: String(offset) });
      const res = await fetch(`/api/admin/queue/sla-actions?${qs}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as SlaActionsResponse;
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load SLA action log');
      }
      const incoming = data.entries ?? [];
      if (append) {
        setSlaEntries((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const merged = [...prev];
          for (const e of incoming) {
            if (!seen.has(e.id)) merged.push(e);
          }
          return merged;
        });
      } else {
        setSlaEntries(incoming);
      }
      const hasMore = Boolean(data.hasMore);
      const nextOff = typeof data.nextOffset === 'number' ? data.nextOffset : null;
      setSlaHasMore(hasMore);
      slaNextPageOffsetRef.current = nextOff ?? 0;
      setSlaError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load SLA action log';
      setSlaError(msg);
    } finally {
      setSlaLoading(false);
      setSlaRefreshing(false);
      setSlaLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    slaNextPageOffsetRef.current = 0;
    void loadSlaActions();
  }, [loadSlaActions]);

  useEffect(() => {
    if (!actionMessage) return;
    const t = window.setTimeout(() => setActionMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [actionMessage]);

  const total = queues.reduce((s, q) => s + q.waiting, 0);
  const atRisk = queues.filter((q) => q.avgWait > q.slaTarget * 0.8).length;
  const atRiskDeptNames = queues.filter((q) => q.avgWait > q.slaTarget * 0.8).map((q) => q.dept);

  const runBulkAtRisk = async (
    action: 'escalation_requested' | 'overflow_assign',
    departmentScope?: string[],
  ) => {
    const busy = bulkBusyToken(action, departmentScope);
    setBulkBusy(busy);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/queue/bulk-at-risk', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          departments:
            departmentScope?.length ? departmentScope : atRiskDeptNames.length ? atRiskDeptNames : undefined,
        }),
      });
      const data = (await res.json()) as BulkAtRiskResponse;
      if (!res.ok) {
        throw new Error(data?.error || 'Bulk action failed');
      }
      const msg = data.message ?? 'Bulk action completed.';
      setActionMessage({ type: 'ok', text: msg });
      slaNextPageOffsetRef.current = 0;
      await Promise.all([loadSummary({ silent: true }), loadSlaActions({ silent: true })]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bulk action failed';
      setActionMessage({ type: 'err', text: msg });
    } finally {
      setBulkBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Department Queue Monitor</h1>
        <div className="flex flex-wrap items-center gap-2">
          {actionMessage && (
            <span
              role="status"
              className={`text-xs font-medium px-2 py-1 rounded-lg ${
                actionMessage.type === 'ok'
                  ? 'bg-success/5 text-success border border-success/20'
                  : 'bg-danger/5 text-danger border border-danger/20'
              }`}
            >
              {actionMessage.text}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadSummary({ silent: true, feedback: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-content-border bg-content-bg px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-card hover:bg-content-surface disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Last refresh: {lastRefresh ?? '—'}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadSummary({ feedback: true })}
            className="shrink-0 rounded-lg bg-content-bg px-3 py-1.5 text-xs font-semibold text-danger border border-danger/20 hover:bg-danger/10"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !error ? (
        <div className="rounded-card border border-content-border bg-content-bg p-8 text-center text-sm text-slate-500 shadow-card">
          Loading live queue metrics…
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          {/* At-risk bulk controls */}
          {atRisk > 0 ? (
            <div className="rounded-card border border-warning/20 bg-warning/5 px-4 py-3 shadow-card flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-sm text-warning">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Operational controls</p>
                  <p className="text-xs text-warning/90 mt-0.5">
                    Apply to all departments currently at risk ({atRisk}). Actions are logged for SLA review.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runBulkAtRisk('escalation_requested')}
                  disabled={Boolean(bulkBusy) || loading || refreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-content-bg px-3 py-1.5 text-xs font-semibold text-warning shadow-card hover:bg-warning/10 disabled:opacity-50"
                >
                  {bulkBusy === bulkBusyToken('escalation_requested') ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {bulkBusy === bulkBusyToken('escalation_requested') ? 'Applying…' : 'Mark escalation (urgent)'}
                </button>
                <button
                  type="button"
                  onClick={() => void runBulkAtRisk('overflow_assign')}
                  disabled={Boolean(bulkBusy) || loading || refreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-content-border bg-content-bg px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-card hover:bg-content-surface disabled:opacity-50"
                >
                  {bulkBusy === bulkBusyToken('overflow_assign') ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  {bulkBusy === bulkBusyToken('overflow_assign') ? 'Assigning…' : 'Assign overflow (waiting)'}
                </button>
              </div>
            </div>
          ) : null}

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Waiting', value: total, icon: <Users className="w-4 h-4" />, className: 'text-primary' },
              {
                label: 'Depts at Risk',
                value: atRisk,
                icon: <AlertTriangle className="w-4 h-4" />,
                className: 'text-warning',
              },
              {
                label: 'Depts On Target',
                value: Math.max(0, queues.length - atRisk),
                icon: <CheckCircle2 className="w-4 h-4" />,
                className: 'text-success',
              },
            ].map((s) => (
              <div key={s.label} className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
                <div className="flex items-center gap-2 mb-1">
                  <span className={s.className}>{s.icon}</span>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
                <p className="text-2xl font-bold text-ink">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Department cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {queues.map((q) => {
              const pct = q.slaTarget > 0 ? Math.min(100, Math.round((q.avgWait / q.slaTarget) * 100)) : 0;
              const ok = pct < 80;
              return (
                <div key={q.dept} className="rounded-card border border-content-border bg-content-bg p-5 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink">{q.dept}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ok ? 'bg-success/5 text-success' : 'bg-warning/5 text-warning'
                      }`}
                    >
                      {ok ? 'On Target' : 'At Risk'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Waiting</p>
                      <p className="font-bold text-ink text-lg">{q.waiting}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">In Service</p>
                      <p className="font-bold text-ink text-lg">{q.inService}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Avg Wait: {q.avgWait} min
                      </span>
                      <span>SLA: {q.slaTarget} min</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${ok ? 'bg-success' : 'bg-warning'}`}
                      />
                    </div>
                  </div>
                  {q.alerts.length > 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-warning bg-warning/5 rounded-lg px-2 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {q.alerts[0]}
                    </div>
                  )}
                  {!ok ? (
                    <div className="pt-1 border-t border-content-border/50 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void runBulkAtRisk('escalation_requested', [q.dept])}
                        disabled={Boolean(bulkBusy) || loading || refreshing}
                        className="inline-flex items-center gap-1 rounded-md border border-warning/20 bg-warning/5 px-2 py-1 text-[11px] font-semibold text-warning hover:bg-warning/10 disabled:opacity-50"
                      >
                        {bulkBusy === bulkBusyToken('escalation_requested', [q.dept]) ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        Escalate dept
                      </button>
                      <button
                        type="button"
                        onClick={() => void runBulkAtRisk('overflow_assign', [q.dept])}
                        disabled={Boolean(bulkBusy) || loading || refreshing}
                        className="inline-flex items-center gap-1 rounded-md border border-content-border bg-content-surface px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {bulkBusy === bulkBusyToken('overflow_assign', [q.dept]) ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        Overflow
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* SLA breach / queue ops action log */}
          <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-ink">SLA & queue action log</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  slaNextPageOffsetRef.current = 0;
                  void loadSlaActions({ silent: true });
                }}
                disabled={slaLoading || slaRefreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-content-border bg-content-bg px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-card hover:bg-content-surface disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${slaRefreshing ? 'animate-spin' : ''}`} />
                {slaRefreshing ? 'Refreshing…' : 'Refresh log'}
              </button>
            </div>
            {slaError && (
              <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-2 py-1.5">{slaError}</p>
            )}
            {slaLoading && !slaError ? (
              <p className="text-sm text-slate-500">Loading action history…</p>
            ) : null}
            {!slaLoading && !slaError && slaEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No SLA bulk actions recorded yet for this facility.</p>
            ) : null}
            {!slaLoading && slaEntries.length > 0 ? (
              <>
                <ul className="divide-y divide-slate-100 border border-content-border/50 rounded-card overflow-hidden">
                  {slaEntries.map((e) => (
                    <li key={e.id} className="px-3 py-2.5 text-sm bg-content-bg hover:bg-content-surface/80">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-ink">{formatSlaActionLabel(e.action)}</span>
                        <time className="text-xs text-slate-500 shrink-0" dateTime={e.createdAt}>
                          {new Date(e.createdAt).toLocaleString()}
                        </time>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {e.actorEmail ?? 'Unknown actor'}
                        {e.actorRole ? ` · ${e.actorRole}` : ''}
                      </p>
                      {summarizeDetail(e.detail) ? (
                        <p className="text-xs text-slate-500 mt-1">{summarizeDetail(e.detail)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {slaHasMore ? (
                  <button
                    type="button"
                    onClick={() => void loadSlaActions({ append: true })}
                    disabled={slaLoadingMore || slaRefreshing}
                    className="w-full rounded-lg border border-content-border bg-content-surface/80 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {slaLoadingMore ? 'Loading…' : 'Load older entries'}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
