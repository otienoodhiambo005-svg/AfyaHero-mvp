'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type QCResult = 'Pass' | 'Review' | 'Fail';

interface QCRun {
  run: string;
  analyzer: string;
  lot: string;
  result: QCResult;
  sigma: string;
  checkedAt: string;
  owner: string;
}

type IncidentSeverity = 'High' | 'Medium' | 'Low';
type IncidentStatus = 'Open' | 'Investigating' | 'Resolved';

interface Incident {
  id: string;
  displayId: string;
  issue: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  openedAt: string;
}

const qcRuns: QCRun[] = [
  { run: 'Chemistry Analyzer QC', analyzer: 'Cobas C311', lot: 'CHEM-22A', result: 'Pass', sigma: '5.2σ', checkedAt: '08:10', owner: 'Kevin M.' },
  { run: 'CBC Control Lot-22', analyzer: 'Sysmex XN-1000', lot: 'CBC-22C', result: 'Pass', sigma: '4.8σ', checkedAt: '09:00', owner: 'Lucy W.' },
  { run: 'AFB Reagent Validation', analyzer: 'ZN Bench 2', lot: 'AFB-11B', result: 'Review', sigma: '3.1σ', checkedAt: '10:20', owner: 'Kevin M.' },
  { run: 'Troponin I EQA', analyzer: 'Finecare FIA', lot: 'TROP-09D', result: 'Fail', sigma: '2.0σ', checkedAt: '11:05', owner: 'Lucy W.' },
];

const resultStyle: Record<QCResult, string> = {
  Pass: 'bg-success/5 text-success border border-success/20',
  Review: 'bg-warning/5 text-warning border border-warning/20',
  Fail: 'bg-danger/5 text-danger border border-danger/20',
};

const severityStyle: Record<IncidentSeverity, string> = {
  High: 'bg-danger/5 text-danger border border-danger/20',
  Medium: 'bg-warning/5 text-warning border border-warning/20',
  Low: 'bg-info/5 text-info border border-info/20',
};

const statusStyle: Record<IncidentStatus, string> = {
  Open: 'bg-slate-100 text-slate-700 border border-content-border',
  Investigating: 'bg-violet-100 text-violet-700 border border-violet-200',
  Resolved: 'bg-success/5 text-success border border-success/20',
};

function formatOpenedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function LabQualityPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    setIncidentsError(null);
    setActionSuccess(null);
    setMutationError(null);
    try {
      const res = await fetch('/api/lab/quality/incidents', { credentials: 'include' });
      const data = (await res.json()) as {
        incidents?: Incident[];
        error?: string;
      };
      if (!res.ok) {
        setIncidentsError(data.error ?? 'Unable to load quality incidents.');
        setIncidents([]);
        return;
      }
      setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
    } catch {
      setIncidentsError('Network error while loading quality incidents.');
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const markResolved = useCallback(
    async (row: Incident) => {
      setMutationBusyId(row.id);
      setMutationError(null);
      setActionSuccess(null);
      try {
        const res = await fetch('/api/lab/quality/incidents', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: row.id, status: 'Resolved' }),
        });
        const data = (await res.json()) as { error?: string; incident?: Incident };
        if (!res.ok) {
          setMutationError(data.error ?? 'Could not update incident.');
          return;
        }
        if (data.incident) {
          const next = data.incident;
          setIncidents((prev) => prev.map((i) => (i.id === next.id ? next : i)));
        } else {
          await loadIncidents();
        }
        setActionSuccess(`${row.displayId} marked resolved.`);
      } catch {
        setMutationError('Network error while updating incident.');
      } finally {
        setMutationBusyId(null);
      }
    },
    [loadIncidents],
  );

  const kpis = useMemo(() => {
    const openIncidents =
      incidentsLoading && incidents.length === 0
        ? null
        : incidents.filter((x) => x.status !== 'Resolved').length;
    return {
      passRate: '92%',
      openIncidents,
      sigmaAvg: '4.1σ',
      tatCompliance: '88%',
    };
  }, [incidents, incidentsLoading]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Lab Quality</h1>
        <p className="text-sm text-slate-600">Quality control, incidents, and turnaround compliance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-success/5 border border-success/20 p-3">
          <p className="text-xs text-success">QC Pass Rate</p>
          <p className="text-xl font-bold text-success">{kpis.passRate}</p>
        </div>
        <div className="rounded-lg bg-danger/5 border border-danger/20 p-3">
          <p className="text-xs text-danger">Open Incidents</p>
          <p className="text-xl font-bold text-danger">
            {kpis.openIncidents === null ? '—' : kpis.openIncidents}
          </p>
        </div>
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
          <p className="text-xs text-violet-700">Avg Sigma</p>
          <p className="text-xl font-bold text-violet-700">{kpis.sigmaAvg}</p>
        </div>
        <div className="rounded-lg bg-info/5 border border-info/20 p-3">
          <p className="text-xs text-info">TAT Compliance</p>
          <p className="text-xl font-bold text-info">{kpis.tatCompliance}</p>
        </div>
      </div>

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-violet-700" />
          <h2 className="text-sm font-semibold text-ink">Quality Control Runs</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">QC Run</th>
              <th className="py-2">Analyzer</th>
              <th className="py-2">Lot</th>
              <th className="py-2">Result</th>
              <th className="py-2">Sigma</th>
              <th className="py-2">Checked At</th>
              <th className="py-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {qcRuns.map((q) => (
              <tr key={q.run} className="border-b border-content-border/50">
                <td className="py-2 font-medium text-ink">{q.run}</td>
                <td className="py-2 text-slate-600">{q.analyzer}</td>
                <td className="py-2 font-mono text-xs text-slate-600">{q.lot}</td>
                <td className="py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', resultStyle[q.result])}>{q.result}</span>
                </td>
                <td className="py-2 text-slate-700">{q.sigma}</td>
                <td className="py-2 text-slate-600">{q.checkedAt}</td>
                <td className="py-2 text-slate-600">{q.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-danger" />
          <h2 className="text-sm font-semibold text-ink">Quality Incidents</h2>
        </div>

        {incidentsLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-content-border bg-content-surface px-3 py-2 text-sm text-slate-600 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
            <span>Loading incidents…</span>
          </div>
        )}

        {!incidentsLoading && incidentsError && (
          <div
            className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>{incidentsError}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadIncidents()}
              className="rounded-lg border border-content-border bg-content-bg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-content-surface shrink-0 self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {mutationError && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger mb-3" role="alert">
            {mutationError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs text-success mb-3">
            {actionSuccess}
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">Incident ID</th>
              <th className="py-2">Issue</th>
              <th className="py-2">Severity</th>
              <th className="py-2">Status</th>
              <th className="py-2">Opened</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {incidentsLoading && incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600 mx-auto mb-2" aria-hidden />
                  <p className="text-sm">Fetching quality incidents…</p>
                </td>
              </tr>
            ) : null}
            {!incidentsLoading && incidentsError && incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500 text-sm">
                  Data could not be loaded. Use <span className="font-medium text-slate-700">Retry</span> above.
                </td>
              </tr>
            ) : null}
            {!incidentsLoading && !incidentsError && incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                  No quality incidents recorded for this hospital.
                </td>
              </tr>
            ) : null}
            {incidents.map((incident) => (
              <tr key={incident.id} className="border-b border-content-border/50">
                <td className="py-2 font-mono text-xs text-violet-700">{incident.displayId}</td>
                <td className="py-2 text-slate-700">{incident.issue}</td>
                <td className="py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', severityStyle[incident.severity])}>
                    {incident.severity}
                  </span>
                </td>
                <td className="py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusStyle[incident.status])}>{incident.status}</span>
                </td>
                <td className="py-2 text-slate-600">{formatOpenedAt(incident.openedAt)}</td>
                <td className="py-2 text-right">
                  {incident.status !== 'Resolved' ? (
                    <button
                      type="button"
                      disabled={mutationBusyId !== null}
                      onClick={() => void markResolved(incident)}
                      className="rounded-lg border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mutationBusyId === incident.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Saving
                        </span>
                      ) : (
                        'Mark resolved'
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
