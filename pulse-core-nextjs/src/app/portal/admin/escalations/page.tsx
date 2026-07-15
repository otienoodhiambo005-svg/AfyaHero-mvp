'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, SendHorizonal, XCircle } from 'lucide-react';

const ACCENT = '#3282B8';

type EscalationActor = { fullName: string | null; email: string | null } | null;

type EscalationRow = {
  id: string;
  title: string;
  body: string;
  serviceArea: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  createdBy: EscalationActor;
  resolvedBy: EscalationActor;
};

type ListResponse = { escalations?: EscalationRow[]; error?: string };
type MutationResponse = { escalation?: EscalationRow; error?: string };

export default function AdminEscalationsPage() {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [items, setItems] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [title, setTitle] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const q = filter === 'all' ? 'status=all' : 'status=open';
        const res = await fetch(`/api/admin/escalations?${q}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = (await res.json()) as ListResponse;
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load escalations');
        }
        setItems(data.escalations ?? []);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load escalations';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function submitNew() {
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/escalations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          ...(serviceArea.trim() ? { serviceArea: serviceArea.trim() } : {}),
        }),
      });
      const data = (await res.json()) as MutationResponse;
      if (!res.ok) {
        throw new Error(data?.error || 'Could not create escalation');
      }
      setTitle('');
      setServiceArea('');
      setBody('');
      setBanner({ type: 'ok', text: 'Escalation logged for your facility.' });
      await load({ silent: true });
    } catch (e) {
      setBanner({ type: 'err', text: e instanceof Error ? e.message : 'Create failed' });
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveOne(id: string) {
    setClosingId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/escalations/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      const data = (await res.json()) as MutationResponse;
      if (!res.ok) {
        throw new Error(data?.error || 'Could not resolve escalation');
      }
      setBanner({ type: 'ok', text: 'Escalation marked resolved.' });
      await load({ silent: true });
    } catch (e) {
      setBanner({ type: 'err', text: e instanceof Error ? e.message : 'Resolve failed' });
    } finally {
      setClosingId(null);
    }
  }

  function actorLabel(a: EscalationActor) {
    if (!a) return 'Unknown';
    return a.fullName || a.email || 'Unknown';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Queue & service escalations</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Log operational escalations for your hospital and close them when cleared.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 rounded-card border border-content-border bg-content-bg px-3 py-2 text-sm font-medium text-slate-700 shadow-card hover:bg-content-surface disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {banner && (
        <div
          className={`rounded-card border px-3 py-2.5 text-sm flex items-start gap-2 ${
            banner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {banner.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['open', 'all'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-card text-sm font-medium transition-all border ${
              filter === key
                ? 'text-white shadow-card border-transparent'
                : 'bg-content-bg text-slate-700 border-content-border hover:bg-content-surface'
            }`}
            style={filter === key ? { backgroundColor: ACCENT } : undefined}
          >
            {key === 'open' ? 'Active' : 'All records'}
          </button>
        ))}
      </div>

      {loading && !refreshing ? (
        <p className="text-sm text-slate-500">Loading escalations…</p>
      ) : null}

      {error ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900 space-y-2">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-content-bg px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-semibold text-ink">New escalation</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-content-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g. OPD queue backup — need second clerk"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Service area (optional)</span>
                <input
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  className="w-full rounded-lg border border-content-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Queue, Lab, Pharmacy…"
                />
              </label>
            </div>
            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-700">Details</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-content-border px-3 py-2 text-sm outline-none resize-y min-h-[96px] focus:ring-2 focus:ring-slate-200"
                placeholder="What is blocked, who is affected, and what help is needed?"
              />
            </label>
            <button
              type="button"
              onClick={() => void submitNew()}
              disabled={submitting || title.trim().length < 2 || body.trim().length < 2}
              className="inline-flex items-center gap-2 rounded-card px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
              {submitting ? 'Saving…' : 'Submit escalation'}
            </button>
          </div>

          <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card space-y-3">
            <h2 className="text-sm font-semibold text-ink">
              {filter === 'open' ? 'Active escalations' : 'Escalation history'}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">
                {filter === 'open' ? 'No open escalations for this facility.' : 'No records yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-content-border/50 rounded-card overflow-hidden">
                {items.map((row) => (
                  <li key={row.id} className="px-3 py-3 text-sm bg-content-bg hover:bg-content-surface/80">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{row.title}</span>
                          {row.status === 'resolved' ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              Resolved
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Open
                            </span>
                          )}
                        </div>
                        {row.serviceArea ? (
                          <p className="text-xs text-slate-500">Area: {row.serviceArea}</p>
                        ) : null}
                        <p className="text-slate-700 whitespace-pre-wrap">{row.body}</p>
                        <p className="text-xs text-slate-500">
                          Logged {new Date(row.createdAt).toLocaleString()} · {actorLabel(row.createdBy)}
                          {row.resolvedAt
                            ? ` · Resolved ${new Date(row.resolvedAt).toLocaleString()} · ${actorLabel(row.resolvedBy)}`
                            : ''}
                        </p>
                      </div>
                      {row.status === 'open' ? (
                        <button
                          type="button"
                          onClick={() => void resolveOne(row.id)}
                          disabled={closingId === row.id}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {closingId === row.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Resolve
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
