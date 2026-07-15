'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, BrainCircuit, AlertTriangle, Trash2, Eye, X, Video, ArrowLeftRight, Loader2, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

type RxStatus = 'Pending Dispensing' | 'Dispensed' | 'Partial';

interface ActiveRx {
  rxNum: string;
  patient: string;
  prescribed: string;
  status: RxStatus;
  drugs: string;
}

interface DrugItem {
  id: number;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
}


const statusStyles: Record<RxStatus, string> = {
  'Pending Dispensing': 'bg-warning/5 text-warning border border-warning/20',
  'Dispensed':          'bg-success/5 text-success border border-success/20',
  'Partial':            'bg-warning/5 text-warning border border-warning/20',
};

const FREQUENCIES: string[] = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 8 hours', 'At bedtime', 'As needed (PRN)', 'Weekly'];
const ROUTES: string[] = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Sublingual', 'Rectal'];

let nextId = 1;

export default function PrescriptionsPage(): React.ReactElement {
  const [activeRx, setActiveRx] = useState<ActiveRx[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [aiChecked, setAiChecked] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/medical/prescriptions', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load prescriptions (${res.status})`);
      const data = await res.json();
      setActiveRx(Array.isArray(data) ? data : (data.prescriptions ?? []));
    } catch (err) {
      logger.error('Failed to load prescriptions', { error: err });
      setLoadError(err instanceof Error ? err.message : 'Could not load prescriptions.');
      setActiveRx([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrescriptions();
  }, [loadPrescriptions]);

  const addDrug = (): void => {
    setDrugs((prev) => [
      ...prev,
      { id: nextId++, drug: '', dose: '', frequency: 'Once daily', duration: '7 days', route: 'Oral', quantity: 7 },
    ]);
  };

  const removeDrug = (id: number): void => {
    setDrugs((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDrug = (id: number, field: keyof DrugItem, value: string | number): void => {
    setDrugs((prev) => prev.map((d) => d.id === id ? { ...d, [field]: value } : d));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Prescriptions</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-success" />
            AI drug interaction checking active
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/portal/medical/handover"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-content-border text-slate-700 hover:bg-content-surface text-sm font-medium transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Shift Handover
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-control bg-portal-primary hover:bg-portal-primary-hover text-white text-sm font-medium transition-colors w-fit"
          >
            <Plus className="w-4 h-4" /> {showForm ? 'Hide Form' : 'New Prescription'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
        </div>
      )}

      {/* Error State */}
      {loadError && !loading && (
        <div className="rounded-card border border-content-border bg-content-bg p-6 text-center space-y-3">
          <p className="text-sm text-severity-high">{loadError}</p>
          <button onClick={() => void loadPrescriptions()} className="text-xs font-medium px-4 py-2 rounded-control bg-portal-primary text-white hover:bg-portal-primary-hover transition-colors">Retry</button>
        </div>
      )}

      {/* Active Prescriptions */}
      {!loading && !loadError && (
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
          <h2 className="text-sm font-semibold text-ink">Active Prescriptions</h2>
        </div>
        <div className="overflow-x-auto">
          {activeRx.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Pill className="w-8 h-8 text-slate mx-auto mb-3" />
              <p className="text-sm text-slate">No active prescriptions</p>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Rx #', 'Patient', 'Prescribed', 'Status', 'Drugs', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRx.map((rx) => (
                <tr key={rx.rxNum} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 text-success font-mono text-xs whitespace-nowrap">{rx.rxNum}</td>
                  <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{rx.patient}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{rx.prescribed}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusStyles[rx.status])}>{rx.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{rx.drugs}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button className="text-xs text-success hover:text-success flex items-center gap-1">
                      <Eye className="w-3 h-3" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
      )}

      {/* New Prescription Form */}
      {showForm && (
        <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-content-surface/80">
            <h2 className="text-sm font-semibold text-ink">New Prescription</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-5">
            {/* Patient */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Patient</label>
              <input
                defaultValue="Hassan Ali — PID-11234"
                className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink text-sm focus:outline-none focus:border-portal-primary"
              />
            </div>

            {/* Drug Items Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-slate-500">Drug Items</label>
                <button
                  onClick={addDrug}
                  className="flex items-center gap-1 text-xs text-success hover:text-success px-2.5 py-1 rounded-lg border border-success/20 hover:border-success/30 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Drug
                </button>
              </div>
              <div className="space-y-2">
                {drugs.map((d) => (
                  <div key={d.id} className="rounded-lg bg-content-surface border border-content-border p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-500 block mb-1">Drug Name</label>
                        <input
                          value={d.drug}
                          onChange={(e) => updateDrug(d.id, 'drug', e.target.value)}
                          placeholder="e.g. Metformin"
                          className="w-full px-2.5 py-1.5 rounded bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-portal-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Dose</label>
                        <input
                          value={d.dose}
                          onChange={(e) => updateDrug(d.id, 'dose', e.target.value)}
                          placeholder="e.g. 500mg"
                          className="w-full px-2.5 py-1.5 rounded bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-portal-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Frequency</label>
                        <select
                          value={d.frequency}
                          onChange={(e) => updateDrug(d.id, 'frequency', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-portal-primary"
                        >
                          {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Duration</label>
                        <input
                          value={d.duration}
                          onChange={(e) => updateDrug(d.id, 'duration', e.target.value)}
                          placeholder="e.g. 7 days"
                          className="w-full px-2.5 py-1.5 rounded bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-portal-primary"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 block mb-1">Route</label>
                          <select
                            value={d.route}
                            onChange={(e) => updateDrug(d.id, 'route', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-portal-primary"
                          >
                            {ROUTES.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => { if (d.drug && window.confirm(`Remove ${d.drug} from prescription?`)) removeDrug(d.id); else if (!d.drug) removeDrug(d.id); }}
                          className="mb-0.5 text-danger hover:text-danger shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="text-xs text-slate-500 block mb-1">Qty</label>
                      <input
                        type="number"
                        value={d.quantity}
                        onChange={(e) => updateDrug(d.id, 'quantity', Number(e.target.value))}
                        className="w-20 px-2.5 py-1.5 rounded bg-content-bg border border-content-border text-ink text-xs focus:outline-none focus:border-portal-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical Notes */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Clinical Notes</label>
              <textarea
                rows={3}
                placeholder="Indication, precautions, special instructions..."
                className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm resize-none focus:outline-none focus:border-portal-primary"
              />
            </div>

            {/* AI Check */}
            <div>
              <button
                onClick={() => setAiChecked(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm hover:bg-violet-500/30 transition-colors"
              >
                <BrainCircuit className="w-4 h-4" /> AI Check Interactions
              </button>
              {aiChecked && (
                <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-warning mb-1">Interaction Warning</p>
                    <p className="text-xs text-slate-600">
                      ⚠️ <span className="text-ink font-medium">Metformin + Ciprofloxacin</span>: potential interaction (moderate). Monitor blood glucose levels closely — Ciprofloxacin may potentiate hypoglycaemia. Consider alternative antibiotic if clinically appropriate.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-content-border text-slate-600 text-sm hover:bg-content-surface transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={() => { setSubmitted(true); setShowForm(false); }}
                className="flex items-center gap-2 px-5 py-2 rounded-control bg-portal-primary hover:bg-portal-primary-hover text-white text-sm font-medium transition-colors"
              >
                Sign &amp; Send to Pharmacy
              </button>
            </div>

            {submitted && (
              <div className="rounded-lg border border-success/20 bg-success/5 p-3 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-success shrink-0" />
                <p className="text-xs text-success">Prescription signed and sent to pharmacy successfully.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drug Interaction Section */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-success" /> Drug Interaction Checker
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Drug 1', placeholder: 'e.g. Metformin...' },
            { label: 'Drug 2', placeholder: 'e.g. Ciprofloxacin...' },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
              <input
                defaultValue={f.label === 'Drug 1' ? 'Metformin 500mg' : 'Ciprofloxacin 500mg'}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm focus:outline-none focus:border-portal-primary"
              />
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-warning/5 border border-warning/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">Moderate Interaction</span>
          </div>
          <p className="text-xs font-semibold text-ink mb-1">Metformin ↔ Ciprofloxacin</p>
          <p className="text-xs text-slate-600">Fluoroquinolones may enhance the hypoglycaemic effect of antidiabetics. Monitor blood glucose levels closely during and after antibiotic therapy. Educate patient on signs of hypoglycaemia.</p>
          <p className="text-xs font-medium text-warning mt-2">Recommendation: Monitor BG q6h. Consider dose adjustment if prolonged use.</p>
        </div>
      </div>
    </div>
  );
}
