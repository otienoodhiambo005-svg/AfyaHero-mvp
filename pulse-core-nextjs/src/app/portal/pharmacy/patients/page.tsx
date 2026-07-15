'use client';

import { useMemo, useState } from 'react';
import { Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientRx {
  patient: string;
  pid: string;
  rx: string;
  items: number;
  interactions: number;
  adherence: 'Good' | 'Moderate' | 'Poor';
  nextRefill: string;
}

const patientRx: PatientRx[] = [
  { patient: 'Grace Abuya', pid: 'PID-11237', rx: 'RX-9015', items: 3, interactions: 0, adherence: 'Good', nextRefill: '2025-02-02' },
  { patient: 'Joseph Odhiambo', pid: 'PID-11239', rx: 'RX-9016', items: 2, interactions: 1, adherence: 'Moderate', nextRefill: '2025-01-28' },
  { patient: 'Amina Keita', pid: 'PID-11241', rx: 'RX-9017', items: 4, interactions: 2, adherence: 'Poor', nextRefill: '2025-01-24' },
  { patient: 'Hassan Ali', pid: 'PID-11234', rx: 'RX-9018', items: 3, interactions: 0, adherence: 'Good', nextRefill: '2025-02-10' },
];

const adherenceStyle: Record<PatientRx['adherence'], string> = {
  Good: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Moderate: 'bg-amber-100 text-amber-700 border border-amber-200',
  Poor: 'bg-red-100 text-red-700 border border-red-200',
};

export default function PharmacyPatientsPage() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return patientRx.filter(
      (p) =>
        p.patient.toLowerCase().includes(q) ||
        p.pid.toLowerCase().includes(q) ||
        p.rx.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Patients for Dispensing</h1>
        <p className="text-sm text-slate">Medication profile review, interaction risk, and refill continuity</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patient by name, PID, or RX..."
          aria-label="Search patients by name, patient ID, or prescription"
          className="w-full rounded-card border border-content-border bg-content-bg py-2.5 pl-10 pr-4 text-sm text-charcoal focus:border-portal-primary/35 focus:outline-none focus:ring-2 focus:ring-portal-primary/15"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-content-border bg-content-bg p-4 shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">Patient</th>
              <th className="py-2">Prescription</th>
              <th className="py-2">Items</th>
              <th className="py-2">Interactions</th>
              <th className="py-2">Adherence</th>
              <th className="py-2">Next Refill</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.rx} className="border-b border-content-border/50">
                <td className="py-2">
                  <p className="font-medium text-ink">{p.patient}</p>
                  <p className="text-xs text-slate-500">{p.pid}</p>
                </td>
                <td className="py-2 font-mono text-xs text-cyan-700">{p.rx}</td>
                <td className="py-2 text-slate-700">{p.items}</td>
                <td className="py-2">
                  {p.interactions > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      <AlertTriangle className="w-3 h-3" /> {p.interactions}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> 0
                    </span>
                  )}
                </td>
                <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', adherenceStyle[p.adherence])}>{p.adherence}</span></td>
                <td className="py-2 text-slate-600">{p.nextRefill}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}