'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  FlaskConical,
  Pill,
  Stethoscope,
  Image as ImageIcon,
  Plus,
  Filter,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface RoutingOrder {
  id: string;
  code: string;
  patient: string;
  pid: string;
  destination: 'Medical' | 'Lab' | 'Pharmacy' | 'Imaging';
  reason: string;
  urgency: 'Urgent' | 'Routine';
  status: 'Pending' | 'Acknowledged' | 'Completed';
  time: string;
}

interface ListPayload {
  orders: RoutingOrder[];
  timezone: string;
}

const DEST_ICON: Record<string, React.ReactNode> = {
  Medical:  <Stethoscope className="w-4 h-4" />,
  Lab:      <FlaskConical className="w-4 h-4" />,
  Pharmacy: <Pill className="w-4 h-4" />,
  Imaging:  <ImageIcon className="w-4 h-4" />,
};

const STATUS_STYLE: Record<string, string> = {
  Pending:      'bg-warning/5 text-warning',
  Acknowledged: 'bg-primary/5 text-primary',
  Completed:    'bg-success/5 text-success',
};

const URGENCY_STYLE: Record<string, string> = {
  Urgent:  'bg-danger/5 text-danger',
  Routine: 'bg-slate-100 text-slate-600',
};

const EMPTY_NEW = {
  patientName: '',
  patientRef: '',
  destination: 'Medical' as RoutingOrder['destination'],
  reason: '',
  urgency: 'Routine' as RoutingOrder['urgency'],
};

export default function ReceptionOrdersPage() {
  const [destFilter, setDestFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [orders, setOrders] = useState<RoutingOrder[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [creating, setCreating] = useState(false);

  const dests = ['All', 'Medical', 'Lab', 'Pharmacy', 'Imaging'];
  const statuses = ['All', 'Pending', 'Acknowledged', 'Completed'];
  const pending = orders.filter((o) => o.status === 'Pending').length;

  const loadOrders = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/reception/orders', { credentials: 'same-origin' });
      const data = (await response.json().catch(() => null)) as ListPayload | { error?: string } | null;
      if (!response.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Could not load orders (${response.status}).`;
        throw new Error(msg);
      }
      if (!data || !('orders' in data) || !Array.isArray(data.orders)) {
        throw new Error('Unexpected response from server.');
      }
      setOrders(data.orders);
      setTimezone(typeof data.timezone === 'string' ? data.timezone : null);
    } catch (e) {
      setOrders([]);
      setTimezone(null);
      setLoadError(e instanceof Error ? e.message : 'Failed to load routing orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!actionSuccess) return;
    const t = window.setTimeout(() => setActionSuccess(null), 4500);
    return () => window.clearTimeout(t);
  }, [actionSuccess]);

  useEffect(() => {
    if (!showNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) setShowNew(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNew, creating]);

  const filtered = orders.filter((o) => {
    const matchDest = destFilter === 'All' || o.destination === destFilter;
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchDest && matchStatus;
  });

  async function acknowledge(orderId: string) {
    setActionError(null);
    setActionSuccess(null);
    setBusyOrderId(orderId);
    try {
      const response = await fetch(`/api/reception/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Acknowledge failed (${response.status}).`);
      }
      setActionSuccess('Order acknowledged.');
      await loadOrders();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Acknowledge failed.');
    } finally {
      setBusyOrderId(null);
    }
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setCreating(true);
    try {
      const response = await fetch('/api/reception/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          patientName: newForm.patientName.trim(),
          patientRef: newForm.patientRef.trim() || undefined,
          destination: newForm.destination,
          reason: newForm.reason.trim(),
          urgency: newForm.urgency,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Create failed (${response.status}).`);
      }
      setActionSuccess('Routing order created.');
      setShowNew(false);
      setNewForm(EMPTY_NEW);
      await loadOrders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Department Routing Orders</h1>
          {timezone ? (
            <p className="text-xs text-slate-400 mt-0.5">Times shown in {timezone}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-card text-sm font-medium text-slate-700 border border-content-border bg-content-bg hover:bg-content-surface disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
            Refresh
          </button>
          {pending > 0 && (
            <span className="text-sm font-medium text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-1">
              {pending} Pending
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setShowNew(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-card bg-primary text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" aria-hidden /> New Routing
          </button>
        </div>
      </div>

      {loadError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-medium">Could not load routing orders</p>
              <p className="text-warning/90 mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="shrink-0 text-sm font-semibold text-warning underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {actionError && (
        <div
          className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start justify-between gap-3"
          role="status"
        >
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 text-sm font-semibold underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          className="rounded-card border border-success/20 bg-success/5 px-4 py-3 text-sm text-success"
          role="status"
        >
          {actionSuccess}
        </div>
      )}

      {/* Dest summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['Medical', 'Lab', 'Pharmacy', 'Imaging'] as const).map((d) => {
          const count = orders.filter((o) => o.destination === d).length;
          return (
            <div key={d} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card flex items-center gap-2">
              <span className="text-primary">{DEST_ICON[d]}</span>
              <div>
                <p className="text-xs text-slate-500">{d}</p>
                <p className="font-bold text-ink">{loading && orders.length === 0 ? '—' : `${count} orders`}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400" aria-hidden />
        <select
          value={destFilter}
          onChange={(e) => setDestFilter(e.target.value)}
          disabled={loading && orders.length === 0}
          className="rounded-card border border-content-border px-3 py-2 text-sm text-slate-700 outline-none"
        >
          {dests.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={loading && orders.length === 0}
          className="rounded-card border border-content-border px-3 py-2 text-sm text-slate-700 outline-none"
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Orders list */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card divide-y divide-slate-100 relative">
        {loading && orders.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-content-bg/80 py-16 rounded-card">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden />
            <p className="text-sm text-slate-600">Loading routing orders…</p>
          </div>
        )}
        {filtered.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 p-4 hover:bg-content-surface transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-card bg-content-surface shrink-0 text-primary">
                {DEST_ICON[o.destination]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-ink">{o.patient}</p>
                  <span className="text-xs text-slate-400 font-mono">{o.pid}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${URGENCY_STYLE[o.urgency]}`}>{o.urgency}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5 flex-wrap">
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span>{o.destination}</span>
                  <span className="text-slate-300">•</span>
                  <span className="break-words">{o.reason}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs shrink-0">{o.time}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {o.status === 'Pending' && (
                <button
                  type="button"
                  disabled={busyOrderId === o.id}
                  onClick={() => void acknowledge(o.id)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-content-border bg-content-bg text-slate-700 hover:bg-content-surface disabled:opacity-50"
                >
                  {busyOrderId === o.id ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      …
                    </span>
                  ) : (
                    'Acknowledge'
                  )}
                </button>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>{o.status}</span>
            </div>
          </div>
        ))}
        {!loading && !loadError && filtered.length === 0 && (
          <p className="text-center py-8 text-slate-400">No routing orders match filters.</p>
        )}
        {!loading && loadError && orders.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">Orders unavailable until connection is restored.</p>
        )}
      </div>

      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          role="presentation"
          onClick={() => !creating && setShowNew(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-routing-title"
            className="w-full max-w-md rounded-card border border-content-border bg-content-bg shadow-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-routing-title" className="text-lg font-bold text-ink">
              New routing order
            </h2>
            <form onSubmit={(e) => void createOrder(e)} className="space-y-3">
              <div>
                <label htmlFor="ro-patient" className="block text-xs font-medium text-slate-500 mb-1">
                  Patient name
                </label>
                <input
                  id="ro-patient"
                  required
                  value={newForm.patientName}
                  onChange={(e) => setNewForm((f) => ({ ...f, patientName: e.target.value }))}
                  className="w-full rounded-card border border-content-border px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label htmlFor="ro-ref" className="block text-xs font-medium text-slate-500 mb-1">
                  Patient ref (optional)
                </label>
                <input
                  id="ro-ref"
                  value={newForm.patientRef}
                  onChange={(e) => setNewForm((f) => ({ ...f, patientRef: e.target.value }))}
                  placeholder="PID-…"
                  className="w-full rounded-card border border-content-border px-3 py-2 text-sm outline-none font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ro-dest" className="block text-xs font-medium text-slate-500 mb-1">
                    Destination
                  </label>
                  <select
                    id="ro-dest"
                    value={newForm.destination}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, destination: e.target.value as RoutingOrder['destination'] }))
                    }
                    className="w-full rounded-card border border-content-border px-3 py-2 text-sm outline-none"
                  >
                    {(['Medical', 'Lab', 'Pharmacy', 'Imaging'] as const).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ro-urg" className="block text-xs font-medium text-slate-500 mb-1">
                    Urgency
                  </label>
                  <select
                    id="ro-urg"
                    value={newForm.urgency}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, urgency: e.target.value as RoutingOrder['urgency'] }))
                    }
                    className="w-full rounded-card border border-content-border px-3 py-2 text-sm outline-none"
                  >
                    <option value="Routine">Routine</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="ro-reason" className="block text-xs font-medium text-slate-500 mb-1">
                  Reason
                </label>
                <textarea
                  id="ro-reason"
                  required
                  rows={3}
                  value={newForm.reason}
                  onChange={(e) => setNewForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded-card border border-content-border px-3 py-2 text-sm outline-none resize-y"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowNew(false)}
                  className="px-3 py-2 rounded-card text-sm font-medium text-slate-700 border border-content-border hover:bg-content-surface disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-3 py-2 rounded-card bg-primary text-sm font-medium text-white disabled:opacity-50"
                >
                  {creating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      Creating…
                    </span>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
