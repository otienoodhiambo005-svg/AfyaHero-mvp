'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type QueuePriority = 'Urgent' | 'Normal';
type QueueStatus = 'Waiting' | 'Counseling' | 'Dispensing' | 'Completed';

interface DispenseQueueItem {
  prescriptionId: string;
  token: string;
  patient: string;
  rx: string;
  items: number;
  wait: number;
  priority: QueuePriority;
  status: QueueStatus;
}

const statusStyle: Record<QueueStatus, string> = {
  Waiting: 'bg-slate-100 text-slate-700 border border-content-border',
  Counseling: 'bg-blue-100 text-blue-700 border border-blue-200',
  Dispensing: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  Completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

const priorityStyle: Record<QueuePriority, string> = {
  Urgent: 'bg-red-100 text-red-700 border border-red-200',
  Normal: 'bg-slate-100 text-slate-700 border border-content-border',
};

export default function PharmacyQueuePage() {
  const [queue, setQueue] = useState<DispenseQueueItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [callNextBusy, setCallNextBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/pharmacy/queue', { cache: 'no-store', credentials: 'same-origin' });
      const payload = (await res.json()) as { items?: DispenseQueueItem[]; error?: string };
      if (!res.ok) {
        throw new Error(payload?.error ?? `Could not load queue (${res.status})`);
      }
      if (!Array.isArray(payload.items)) {
        throw new Error('Unexpected response from server.');
      }
      setQueue(payload.items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load queue.');
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => setSuccessMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return queue.filter(
      (item) =>
        item.patient.toLowerCase().includes(q) ||
        item.token.toLowerCase().includes(q) ||
        item.rx.toLowerCase().includes(q),
    );
  }, [search, queue]);

  const kpis = useMemo(() => {
    const active = queue.filter((x) => x.status !== 'Completed');
    const urgent = queue.filter((x) => x.priority === 'Urgent').length;
    const waits = active.map((x) => x.wait);
    const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;
    return { inQueue: active.length, urgent, avgWait };
  }, [queue]);

  async function postQueueAction(body: { action: 'start' | 'call_next'; prescriptionId?: string }) {
    setActionError(null);
    const res = await fetch('/api/pharmacy/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { success?: boolean; message?: string; error?: string };
    if (!res.ok) {
      throw new Error(payload?.error ?? `Request failed (${res.status})`);
    }
    if (payload.message) {
      setSuccessMessage(payload.message);
    }
    await loadQueue();
  }

  const handleCallNext = async () => {
    if (callNextBusy) return;
    setCallNextBusy(true);
    try {
      await postQueueAction({ action: 'call_next' });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not call next patient.');
    } finally {
      setCallNextBusy(false);
    }
  };

  const handleStartRow = async (prescriptionId: string) => {
    if (busyRowId) return;
    setBusyRowId(prescriptionId);
    try {
      await postQueueAction({ action: 'start', prescriptionId });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update this row.');
    } finally {
      setBusyRowId(null);
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Dispensing Queue</h1>
        <p className="text-sm text-slate">Live queue for counseling and medication handover</p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-card border border-content-border bg-content-bg px-4 py-6 text-sm text-charcoal">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-600" aria-hidden />
          <span>Loading queue from your facility…</span>
        </div>
      )}

      {loadError && !loading && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex flex-wrap items-center justify-between gap-2">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="text-xs font-semibold text-rose-900 underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-2">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-xs font-medium shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCallNext()}
          disabled={loading || callNextBusy}
          className="inline-flex items-center gap-2 rounded-card bg-portal-primary px-3 py-2 text-xs font-semibold text-white hover:bg-portal-primary-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {callNextBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
          Call next waiting
        </button>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={loading}
          className="rounded-card border border-content-border px-3 py-2 text-xs font-medium text-charcoal hover:bg-content-bg disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-content-border bg-content-bg p-3">
          <p className="text-xs text-slate">In queue</p>
          <p className="text-xl font-semibold text-ink">{kpis.inQueue}</p>
        </div>
        <div className="rounded-card border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">Urgent</p>
          <p className="text-xl font-bold text-red-700">{kpis.urgent}</p>
        </div>
        <div className="rounded-card border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-xs text-cyan-700">Avg wait</p>
          <p className="text-xl font-bold text-cyan-700">{kpis.avgWait} min</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by token, RX, or patient..."
          aria-label="Search queue by token, prescription, or patient"
          className="w-full rounded-card border border-content-border bg-content-bg py-2.5 pl-10 pr-4 text-sm text-charcoal focus:border-portal-primary/35 focus:outline-none focus:ring-2 focus:ring-portal-primary/15"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-content-border bg-content-bg p-4 shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">Token</th>
              <th className="py-2">Patient</th>
              <th className="py-2">RX</th>
              <th className="py-2">Items</th>
              <th className="py-2">Wait</th>
              <th className="py-2">Priority</th>
              <th className="py-2">Status</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No prescriptions in queue.
                </td>
              </tr>
            )}
            {filtered.map((q) => {
              const canStart = q.status === 'Waiting' || q.status === 'Counseling';
              const rowBusy = busyRowId === q.prescriptionId;
              return (
                <tr key={q.prescriptionId} className="border-b border-content-border/50 hover:bg-content-surface">
                  <td className="py-2 font-mono text-xs text-cyan-700">{q.token}</td>
                  <td className="py-2 text-ink font-medium">{q.patient}</td>
                  <td className="py-2 text-slate-600">{q.rx}</td>
                  <td className="py-2 text-slate-600">{q.items}</td>
                  <td className="py-2 text-slate-700">{q.wait} min</td>
                  <td className="py-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityStyle[q.priority])}>{q.priority}</span>
                  </td>
                  <td className="py-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusStyle[q.status])}>{q.status}</span>
                  </td>
                  <td className="py-2">
                    {canStart ? (
                      <button
                        type="button"
                        disabled={!!busyRowId || callNextBusy}
                        onClick={() => void handleStartRow(q.prescriptionId)}
                        className="text-xs font-medium text-cyan-700 hover:text-cyan-800 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {rowBusy ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : null}
                        Start at counter
                      </button>
                    ) : q.status === 'Dispensing' ? (
                      <span className="text-xs text-slate-500">Active</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
