'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search, UserPlus, Users, Clock, Filter, Loader2, AlertTriangle, RefreshCw,
} from 'lucide-react';

const ACCENT = '#2E86AB';

interface FrontDeskPatient {
  id: string;
  pid: string;
  name: string;
  phone: string;
  visitType: string;
  counter: string;
  status: string;
  arrivalTime: string;
  insurance: string;
}

interface ListPayload {
  date: string;
  timezone: string;
  patients: FrontDeskPatient[];
}

const STATUS_STYLE: Record<string, string> = {
  Waiting:    'bg-amber-50 text-amber-700',
  Processing: 'bg-blue-50 text-blue-700',
  Registered: 'bg-purple-50 text-purple-700',
  Cleared:    'bg-green-50 text-green-700',
};

export default function ReceptionPatientsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [rows, setRows] = useState<FrontDeskPatient[]>([]);
  const [meta, setMeta] = useState<{ date: string; timezone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const statuses = ['All', 'Waiting', 'Processing', 'Registered', 'Cleared'];

  const loadPatients = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/reception/patients', { credentials: 'same-origin' });
      const data = (await response.json().catch(() => null)) as ListPayload | { error?: string } | null;
      if (!response.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Could not load register (${response.status}).`;
        throw new Error(msg);
      }
      if (!data || !('patients' in data) || !Array.isArray(data.patients)) {
        throw new Error('Unexpected response from server.');
      }
      setRows(data.patients);
      setMeta({ date: data.date, timezone: data.timezone });
    } catch (e) {
      setRows([]);
      setMeta(null);
      setLoadError(e instanceof Error ? e.message : 'Failed to load front desk register.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const filtered = rows.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.pid.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const waiting = rows.filter((p) => p.status === 'Waiting').length;
  const processing = rows.filter((p) => p.status === 'Processing').length;
  const cleared = rows.filter((p) => p.status === 'Cleared').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Patient Front Desk Register</h1>
          {meta ? (
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {meta.date} ({meta.timezone})
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPatients()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-card text-sm font-medium text-slate-700 border border-content-border bg-content-bg hover:bg-content-surface disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-card text-white text-sm font-medium" style={{ background: ACCENT }}>
            <UserPlus className="w-4 h-4" /> Register Patient
          </button>
        </div>
      </div>

      {loadError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Could not load the register</p>
              <p className="text-amber-800/90 mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadPatients()}
            className="shrink-0 text-sm font-semibold text-amber-950 underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Today',  value: rows.length, icon: <Users className="w-4 h-4" /> },
          { label: 'Waiting',      value: waiting,     icon: <Clock className="w-4 h-4" /> },
          { label: 'Processing',   value: processing,  icon: <Users className="w-4 h-4" /> },
          { label: 'Cleared',      value: cleared,   icon: <Users className="w-4 h-4" /> },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card flex items-center gap-2">
            <span style={{ color: ACCENT }}>{k.icon}</span>
            <div><p className="text-xs text-slate-500">{k.label}</p><p className="font-bold text-ink text-lg">{loading && rows.length === 0 ? '—' : k.value}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient name or PID"
            aria-label="Search patients by name or PID"
            className="w-full pl-9 pr-3 py-2 rounded-card border border-content-border text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#2E86AB]/30"
            disabled={loading && rows.length === 0} />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter patient register by status"
            className="rounded-card border border-content-border px-3 py-2 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-[#2E86AB]/30">
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto relative">
        {loading && rows.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-content-bg/80 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden />
            <p className="text-sm text-slate-600">Loading today&apos;s front desk register…</p>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-content-border">
              <th className="py-3 px-4">PID</th><th className="py-3 px-4">Name</th><th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Visit Type</th><th className="py-3 px-4">Counter</th>
              <th className="py-3 px-4">Arrival</th><th className="py-3 px-4">Insurance</th><th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{p.pid}</td>
                <td className="py-2.5 px-4 font-medium text-ink">{p.name}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.phone}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.visitType}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.counter}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.arrivalTime}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.insurance}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? 'bg-slate-100 text-slate-700'}`}>{p.status}</span>
                </td>
              </tr>
            ))}
            {!loading && !loadError && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No patients match.</td></tr>
            )}
          </tbody>
        </table>
        {!loading && loadError && rows.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">Register unavailable until connection is restored.</p>
        )}
      </div>
    </div>
  );
}
