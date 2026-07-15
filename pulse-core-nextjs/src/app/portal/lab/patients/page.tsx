'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientLabTrack {
  patientId: string;
  patient: string;
  pid: string;
  ward: string;
  requested: number;
  completed: number;
  pendingCritical: number;
  lastResultAt: string;
}

export default function LabPatientsPage() {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientLabTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/lab/patients', { credentials: 'include' });
      const data = (await res.json()) as {
        patients?: PatientLabTrack[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? 'Unable to load patient lab tracking.');
        setPatients([]);
        return;
      }
      setPatients(Array.isArray(data.patients) ? data.patients : []);
    } catch {
      setLoadError('Network error while loading patient lab tracking.');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return patients.filter(
      (p) =>
        p.patient.toLowerCase().includes(q) ||
        p.pid.toLowerCase().includes(q) ||
        p.ward.toLowerCase().includes(q),
    );
  }, [query, patients]);

  const totals = useMemo(() => {
    return {
      tracked: patients.length,
      pending: patients.reduce((acc, p) => acc + (p.requested - p.completed), 0),
      critical: patients.reduce((acc, p) => acc + p.pendingCritical, 0),
    };
  }, [patients]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Patient Lab Tracking</h1>
        <p className="text-sm text-slate-600">Monitor completion progress and critical pending tests per patient</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-content-border bg-content-bg px-4 py-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
          <span>Loading patient tracking…</span>
        </div>
      )}

      {!loading && loadError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadPatients()}
            className="rounded-lg border border-content-border bg-content-bg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-content-surface shrink-0 self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-content-bg border border-content-border p-3">
          <p className="text-xs text-slate-500">Patients Tracked</p>
          <p className="text-xl font-bold text-ink">{loading ? '—' : totals.tracked}</p>
        </div>
        <div className="rounded-card bg-violet-50 border border-violet-200 p-3">
          <p className="text-xs text-violet-700">Pending Tests</p>
          <p className="text-xl font-bold text-violet-700">{loading ? '—' : totals.pending}</p>
        </div>
        <div className="rounded-card bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-700">Critical Pending</p>
          <p className="text-xl font-bold text-red-700">{loading ? '—' : totals.critical}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient, PID, or ward..."
          aria-label="Search patients in lab tracking"
          disabled={loading && patients.length === 0}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-content-bg border border-content-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 disabled:opacity-60"
        />
      </div>

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">Patient</th>
              <th className="py-2">Ward</th>
              <th className="py-2">Requested</th>
              <th className="py-2">Completed</th>
              <th className="py-2">Progress</th>
              <th className="py-2">Critical Pending</th>
              <th className="py-2">Last Result</th>
            </tr>
          </thead>
          <tbody>
            {loading && patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600 mx-auto mb-2" aria-hidden />
                  <p className="text-sm">Fetching lab activity by patient…</p>
                </td>
              </tr>
            ) : null}
            {!loading && patients.length === 0 && !loadError ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                  No lab requests in the last 30 days for this hospital.
                </td>
              </tr>
            ) : null}
            {!loading && loadError && patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500 text-sm">
                  Data could not be loaded. Use <span className="font-medium text-slate-700">Retry</span> above.
                </td>
              </tr>
            ) : null}
            {filtered.map((p) => {
              const progress =
                p.requested > 0 ? Math.round((p.completed / p.requested) * 100) : 0;
              return (
                <tr key={p.patientId} className="border-b border-content-border/50">
                  <td className="py-2">
                    <p className="font-medium text-ink">{p.patient}</p>
                    <p className="text-xs text-slate-500">{p.pid}</p>
                  </td>
                  <td className="py-2 text-slate-600">{p.ward}</td>
                  <td className="py-2 text-slate-700">{p.requested}</td>
                  <td className="py-2 text-slate-700">{p.completed}</td>
                  <td className="py-2 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-violet-600" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-600">{progress}%</span>
                    </div>
                  </td>
                  <td className="py-2">
                    {p.pendingCritical > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3" /> {p.pendingCritical}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> 0
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-slate-600">{p.lastResultAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-2">Backlog Summary</h2>
        {filtered.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">No patients match your search.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-600">
            {filtered.map((p) => {
              const pending = p.requested - p.completed;
              return (
                <li key={`${p.patientId}-summary`} className="flex items-center justify-between">
                  <span>{p.patient}</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      pending > 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {pending} pending
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
