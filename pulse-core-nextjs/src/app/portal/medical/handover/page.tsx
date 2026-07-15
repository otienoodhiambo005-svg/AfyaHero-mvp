'use client';

import { useState } from 'react';
import { BrainCircuit, AlertTriangle, CheckSquare, Square, User, Clock, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

type HandoverStatus = 'Draft' | 'Submitted' | 'Acknowledged';

interface CriticalPatient {
  name: string;
  ward: string;
  bed: string;
  issue: string;
  action: string;
  priority: 'HIGH' | 'CRITICAL';
}

interface PendingOrder {
  patient: string;
  order: string;
  priority: 'STAT' | 'Urgent' | 'Routine';
  notes: string;
}

interface MedicationDue {
  patient: string;
  drug: string;
  dose: string;
  dueTime: string;
  given: boolean;
}

const criticalPatients: CriticalPatient[] = [
  { name: 'Hassan Ali', ward: 'Medical Ward', bed: 'MW-4A', issue: 'K⁺ 6.8 mEq/L — hyperkalaemia management in progress. Cardiac monitoring active.', action: 'IV Calcium gluconate infusion ongoing. Serial ECGs q4h. Cardiology review at 14:00.', priority: 'CRITICAL' },
  { name: 'Fatuma Wanjiru', ward: 'Maternity Ward', bed: 'MW-2C', issue: 'Severe anaemia Hb 5.2 — 1st unit PRBC transfusion running, 2nd unit pending.', action: 'Monitor transfusion closely. Review Hb post-transfusion. Obstetrics on call aware.', priority: 'CRITICAL' },
  { name: 'Wanjiru Njeri', ward: 'General Ward', bed: 'GW-7B', issue: 'HbA1c 9.8%, uncontrolled DM. New Ciprofloxacin interaction concern — pharmacist alerted.', action: 'BG monitoring q4h. Metformin dose review pending endocrinology.', priority: 'HIGH' },
];

const pendingOrders: PendingOrder[] = [
  { patient: 'Hassan Ali', order: 'Serial Troponin I (3rd at 14:00)', priority: 'STAT', notes: 'Compare trend. Cardiology to review' },
  { patient: 'Fatuma Wanjiru', order: 'Post-transfusion Hb check (15:00)', priority: 'STAT', notes: 'If <7, 3rd unit required' },
  { patient: 'Peter Kamau', order: 'Sputum AFB collection ×2 remaining', priority: 'Routine', notes: 'Early morning collection tomorrow' },
  { patient: 'Grace Abuya', order: 'Obstetric USS (awaiting slot)', priority: 'Urgent', notes: 'BP trending up, expedite' },
];

const medicationsDue: MedicationDue[] = [
  { patient: 'Hassan Ali', drug: 'Calcium Gluconate IV', dose: '10ml 10%', dueTime: '13:30', given: false },
  { patient: 'Fatuma Wanjiru', drug: 'IV Iron Sucrose', dose: '200mg in 100ml NS', dueTime: '13:45', given: false },
  { patient: 'Wanjiru Njeri', drug: 'Metformin 500mg', dose: '500mg oral', dueTime: '14:00', given: false },
  { patient: 'Joseph Odhiambo', drug: 'Artemether/Lumefantrine', dose: '80/480mg', dueTime: '14:00', given: true },
  { patient: 'Grace Abuya', drug: 'Ferrous Sulphate', dose: '200mg oral', dueTime: '14:30', given: false },
];

const priorityStyle = (p: PendingOrder['priority']): string => {
  switch (p) {
    case 'STAT':    return 'bg-danger/5 text-danger';
    case 'Urgent':  return 'bg-warning/5 text-warning';
    case 'Routine': return 'bg-slate-100 text-slate-600';
  }
};

export default function HandoverPage(): React.ReactElement {
  const [status, setStatus] = useState<HandoverStatus>('Draft');
  const [meds, setMeds] = useState<MedicationDue[]>(medicationsDue);
  const [notes, setNotes] = useState<string>('');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [orders, setOrders] = useState<PendingOrder[]>(pendingOrders);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const toggleMed = (index: number): void => {
    setMeds((prev) => prev.map((m, i) => i === index ? { ...m, given: !m.given } : m));
  };

  const updateOrderNote = (index: number, value: string): void => {
    setOrders((prev) => prev.map((o, i) => i === index ? { ...o, notes: value } : o));
  };

  const generateAiSummary = async (): Promise<void> => {
    setAiLoading(true);
    try {
      const chatHistory = [
        ...criticalPatients.map((p) => `Critical: ${p.name} (${p.ward} ${p.bed}) Issue: ${p.issue} Action: ${p.action}`),
        ...orders.map((o) => `Order: ${o.patient} - ${o.order}. Priority: ${o.priority}. Notes: ${o.notes}`),
        ...meds.map((m) => `Medication: ${m.patient} - ${m.drug} ${m.dose} at ${m.dueTime} (given=${m.given})`),
        notes ? `Manual handover notes: ${notes}` : 'No manual handover notes added yet.',
      ];

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'teleconsultation', data: { chatHistory } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate handover summary.');
      }
      const summary = data?.results?.summary as string | undefined;
      const nextSteps = Array.isArray(data?.results?.nextSteps) ? data.results.nextSteps.join(' ') : '';
      setAiSummary([summary, nextSteps].filter(Boolean).join(' '));
    } catch (error) {
      setAiSummary(error instanceof Error ? error.message : 'Failed to generate handover summary.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Shift Handover</h1>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3.5 h-3.5 text-success" />
            <span className="text-sm text-success font-medium">Morning 07:00–15:00</span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full ml-2',
              status === 'Draft'        ? 'bg-slate-100 text-slate-600'    :
              status === 'Submitted'    ? 'bg-warning/5 text-warning'    :
              'bg-success/5 text-success'
            )}>
              {status}
            </span>
          </div>
        </div>
        {status === 'Draft' && (
          <button
            onClick={() => setStatus('Submitted')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success hover:bg-success/90 text-white text-sm font-medium transition-colors w-fit"
          >
            <Send className="w-4 h-4" /> Submit Handover
          </button>
        )}
      </div>

      {/* Critical Patients */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger" /> Critical Patients
        </h2>
        {criticalPatients.map((p, i) => (
          <div
            key={i}
            className={cn(
              'rounded-card border p-4',
              p.priority === 'CRITICAL'
                ? 'border-danger/20 bg-danger/5'
                : 'border-warning/20 bg-warning/5'
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-base font-bold text-ink">{p.name}</span>
                <span className="text-xs text-slate-500 ml-2">— {p.ward} · Bed {p.bed}</span>
              </div>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                p.priority === 'CRITICAL' ? 'bg-danger/5 text-danger' : 'bg-warning/5 text-warning'
              )}>
                {p.priority}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-2"><span className="text-ink font-medium">Issue:</span> {p.issue}</p>
            <p className="text-sm text-slate-600"><span className="text-success font-medium">Action:</span> {p.action}</p>
          </div>
        ))}
      </div>

      {/* Pending Orders */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
          <h2 className="text-sm font-semibold text-ink">Pending Orders ({orders.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {orders.map((o, i) => (
            <div key={i} className="px-5 py-3.5 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-ink">{o.patient}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityStyle(o.priority))}>{o.priority}</span>
                </div>
                <p className="text-xs text-slate-500">{o.order}</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <input
                  value={o.notes}
                  onChange={(e) => updateOrderNote(i, e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-success/50"
                  placeholder="Add note..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Medications Due */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" /> Medications Due (Next 2 Hours)
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {meds.map((m, i) => (
            <div key={i} className={cn('px-5 py-3.5 flex items-center gap-3', m.given && 'opacity-60')}>
              <button onClick={() => toggleMed(i)} className="shrink-0 text-success">
                {m.given
                  ? <CheckSquare className="w-5 h-5" />
                  : <Square className="w-5 h-5 text-slate-500" />
                }
              </button>
              <div className="flex-1">
                <p className="text-sm text-ink">{m.patient}</p>
                <p className="text-xs text-slate-500">{m.drug} — {m.dose}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className={cn('text-sm font-medium', m.given ? 'text-success line-through' : 'text-ink')}>
                  {m.dueTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Handover Notes */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 space-y-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Handover Notes</h2>
          <button
            onClick={generateAiSummary}
            disabled={aiLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-success/5 text-success hover:bg-success/10 transition-colors"
          >
            <BrainCircuit className="w-3.5 h-3.5" /> {aiLoading ? 'Summarizing...' : 'AI Summarize'}
          </button>
        </div>
        <textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="General handover notes, outstanding actions, concerns for incoming team..."
          className="w-full px-4 py-3 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm resize-none focus:outline-none focus:border-success/50"
        />
        {aiSummary && (
          <div className="rounded-lg border border-success/20 bg-success/5 p-4">
            <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1.5">
              <BrainCircuit className="w-3.5 h-3.5" /> AI-Generated Summary
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">{aiSummary}</p>
          </div>
        )}
      </div>

      {/* Incoming Doctor */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-success" /> Receiving Doctor
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold text-sm">
              JK
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Dr. James Kamau</p>
              <p className="text-xs text-slate-500">Afternoon Shift — 15:00–23:00</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              acknowledged ? 'bg-success/5 text-success' : 'bg-warning/5 text-warning'
            )}>
              {acknowledged ? '✓ Acknowledged' : 'Pending Acknowledgement'}
            </span>
            {status === 'Submitted' && !acknowledged && (
              <button
                onClick={() => { setAcknowledged(true); setStatus('Acknowledged'); }}
                className="px-3 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-medium transition-colors"
              >
                Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
