'use client';

import { ShieldCheck, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const ACCENT = '#3B8B6E';

type CheckStatus = 'Compliant' | 'At Risk' | 'Non-Compliant' | 'Pending';

interface QualityCheck {
  id: string;
  category: string;
  metric: string;
  target: string;
  current: string;
  status: CheckStatus;
  lastReviewed: string;
  notes?: string;
}

const CHECKS: QualityCheck[] = [
  { id: '1', category: 'Patient Safety',    metric: 'Informed Consent Documentation',            target: '100% of elective procedures', current: '98%',           status: 'Compliant',      lastReviewed: 'Today 07:30', notes: 'Two forms pending counter-signature.' },
  { id: '2', category: 'Medication Safety', metric: 'Medication Reconciliation on Admission',    target: '100% within 4h',              current: '86%',           status: 'At Risk',        lastReviewed: 'Today 08:15', notes: 'Delays in General ward — resource constraint flagged.' },
  { id: '3', category: 'Discharge Quality', metric: 'Discharge Counselling Completed',           target: '100% before discharge',       current: '100%',         status: 'Compliant',      lastReviewed: 'Today 09:00' },
  { id: '4', category: 'Infection Control', metric: 'Hand Hygiene Compliance',                   target: '≥ 90%',                        current: '77%',           status: 'Non-Compliant',  lastReviewed: 'Yesterday',   notes: 'IPCS re-training scheduled for afternoon shift.' },
  { id: '5', category: 'Documentation',     metric: 'Clinical Note Timeliness (≤ 1h post-consultation)', target: '≥ 95%',               current: '91%',           status: 'At Risk',        lastReviewed: 'Today 08:45' },
  { id: '6', category: 'Surgical Safety',   metric: 'WHO Surgical Safety Checklist Completion',  target: '100% of procedures',          current: 'Pending audit', status: 'Pending',        lastReviewed: '—' },
];

const STATUS_STYLE: Record<CheckStatus, string> = {
  Compliant:       'bg-green-50 text-green-700 border-green-100',
  'At Risk':       'bg-amber-50 text-amber-700 border-amber-100',
  'Non-Compliant': 'bg-red-50 text-red-700 border-red-100',
  Pending:         'bg-slate-100 text-slate-600 border-content-border',
};

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  Compliant:       <CheckCircle2 className="w-4 h-4" />,
  'At Risk':       <AlertCircle className="w-4 h-4" />,
  'Non-Compliant': <AlertCircle className="w-4 h-4" />,
  Pending:         <Clock className="w-4 h-4" />,
};

export default function MedicalQualityPage() {
  const counts: Record<CheckStatus, number> = {
    Compliant:       CHECKS.filter(c => c.status === 'Compliant').length,
    'At Risk':       CHECKS.filter(c => c.status === 'At Risk').length,
    'Non-Compliant': CHECKS.filter(c => c.status === 'Non-Compliant').length,
    Pending:         CHECKS.filter(c => c.status === 'Pending').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Clinical Quality Metrics</h1>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-5 h-5" style={{ color: ACCENT }} />
          <span className="text-sm text-slate-500">Daily QI Dashboard</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(counts) as [CheckStatus, number][]).map(([status, count]) => (
          <div key={status} className={`rounded-2xl border p-3 shadow-card ${STATUS_STYLE[status]}`}>
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium">{STATUS_ICON[status]}{status}</div>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {CHECKS.map((c) => (
          <div key={c.id} className={`rounded-2xl border p-4 shadow-card ${STATUS_STYLE[c.status]}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{c.category}</p>
                <p className="font-semibold text-ink mt-0.5">{c.metric}</p>
                <div className="flex flex-wrap gap-4 text-xs mt-1">
                  <span>Target: <strong>{c.target}</strong></span>
                  <span>Current: <strong>{c.current}</strong></span>
                  <span className="opacity-60">Reviewed: {c.lastReviewed}</span>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLE[c.status]}`}>
                {STATUS_ICON[c.status]}{c.status}
              </span>
            </div>
            {c.notes && <p className="text-xs mt-2 opacity-80 italic">{c.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}