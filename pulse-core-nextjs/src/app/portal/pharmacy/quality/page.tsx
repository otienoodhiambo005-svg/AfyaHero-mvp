'use client';

import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckStatus = 'Pass' | 'Review' | 'Fail';

interface QualityCheck {
  check: string;
  owner: string;
  dueAt: string;
  status: CheckStatus;
  note?: string;
}

interface Incident {
  id: string;
  issue: string;
  severity: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Investigating' | 'Resolved';
}

const checks: QualityCheck[] = [
  { check: 'Controlled drug register updated', owner: 'Pharm. Mercy', dueAt: '09:00', status: 'Pass' },
  { check: 'Expiry sweep completed', owner: 'Pharm. Kevin', dueAt: '10:00', status: 'Pass' },
  { check: 'Cold-chain log up to date', owner: 'Pharm. Mercy', dueAt: '11:00', status: 'Review', note: 'Fridge 2 had 9.1C spike for 12 min' },
  { check: 'Narcotics count reconciliation', owner: 'Pharm. Kevin', dueAt: '12:00', status: 'Fail', note: 'Morphine ampoules mismatch by 2 units' },
];

const incidents: Incident[] = [
  { id: 'PHQ-101', issue: 'Cold-chain excursion (>8C)', severity: 'High', status: 'Investigating' },
  { id: 'PHQ-098', issue: 'Near-expiry stock not quarantined', severity: 'Medium', status: 'Open' },
  { id: 'PHQ-094', issue: 'Duplicate narcotics entry corrected', severity: 'Low', status: 'Resolved' },
];

const checkStyle: Record<CheckStatus, string> = {
  Pass: 'bg-success/5 text-success border border-success/20',
  Review: 'bg-warning/5 text-warning border border-warning/20',
  Fail: 'bg-danger/5 text-danger border border-danger/20',
};

const sevStyle: Record<Incident['severity'], string> = {
  High: 'bg-danger/5 text-danger border border-danger/20',
  Medium: 'bg-warning/5 text-warning border border-warning/20',
  Low: 'bg-primary/5 text-primary border border-primary/20',
};

const incStatusStyle: Record<Incident['status'], string> = {
  Open: 'bg-slate-100 text-slate-700 border border-content-border',
  Investigating: 'bg-violet-100 text-violet-700 border border-violet-200',
  Resolved: 'bg-success/5 text-success border border-success/20',
};

export default function PharmacyQualityPage() {
  const kpis = {
    passRate: '86%',
    openIssues: incidents.filter((i) => i.status !== 'Resolved').length,
    coldChain: '97.4%',
    reconciled: '99.1%',
  };

  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Pharmacy Quality Checks</h1>
        <p className="text-sm text-slate">Medication safety, cold-chain compliance, and controlled-substance governance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-success/5 border border-success/20 p-3">
          <p className="text-xs text-success">Pass Rate</p>
          <p className="text-xl font-bold text-success">{kpis.passRate}</p>
        </div>
        <div className="rounded-lg bg-danger/5 border border-danger/20 p-3">
          <p className="text-xs text-danger">Open Issues</p>
          <p className="text-xl font-bold text-danger">{kpis.openIssues}</p>
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs text-primary">Cold Chain</p>
          <p className="text-xl font-bold text-cyan-700">{kpis.coldChain}</p>
        </div>
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
          <p className="text-xs text-violet-700">Reconciliation</p>
          <p className="text-xl font-bold text-violet-700">{kpis.reconciled}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-card border border-content-border bg-content-bg p-4 shadow-card">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-700" />
          <h2 className="text-sm font-semibold text-ink">Daily Quality Checklist</h2>
        </div>
        {checks.map((c) => (
          <div key={c.check} className="rounded-card border border-content-border p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-ink font-medium">{c.check}</p>
              <p className="text-xs text-slate-500 mt-1">{c.owner} • due {c.dueAt}</p>
              {c.note && <p className="text-xs text-warning mt-1">{c.note}</p>}
            </div>
            <span className={cn('text-xs rounded-full px-2 py-1', checkStyle[c.status])}>{c.status}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-content-border bg-content-bg p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-3">Quality Incidents</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">ID</th>
              <th className="py-2">Issue</th>
              <th className="py-2">Severity</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id} className="border-b border-content-border/50">
                <td className="py-2 font-mono text-xs text-primary">{i.id}</td>
                <td className="py-2 text-slate-700">{i.issue}</td>
                <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', sevStyle[i.severity])}>{i.severity}</span></td>
                <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', incStatusStyle[i.status])}>{i.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}