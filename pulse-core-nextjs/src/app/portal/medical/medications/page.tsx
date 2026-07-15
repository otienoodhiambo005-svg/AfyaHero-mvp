'use client';

import { useState, Fragment } from 'react';
import { Syringe, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MAREntry {
  id: string;
  patient: string;
  ward: string;
  bed: string;
  drug: string;
  dose: string;
  route: 'IV' | 'IM' | 'PO' | 'SC' | 'SL' | 'TOP';
  freq: string;
  scheduledTime: string;
  status: 'given' | 'due' | 'overdue' | 'held' | 'refused';
  givenBy?: string;
  givenAt?: string;
  notes?: string;
}

interface AdminFormState {
  dose: string;
  time: string;
  notes: string;
  quantity: number;
}

const marData: MAREntry[] = [
  { id: '1', patient: 'Hassan Ali', ward: 'ICU', bed: 'ICU-3', drug: 'Furosemide', dose: '40 mg', route: 'IV', freq: 'BD', scheduledTime: '09:00', status: 'overdue' },
  { id: '2', patient: 'Hassan Ali', ward: 'ICU', bed: 'ICU-3', drug: 'Hydrochlorothiazide', dose: '25 mg', route: 'PO', freq: 'Daily', scheduledTime: '08:00', status: 'given', givenBy: 'Nurse Jane', givenAt: '08:05' },
  { id: '3', patient: 'Fatuma Wanjiru', ward: 'Maternity', bed: 'A-12', drug: 'Ferrous sulphate', dose: '200 mg', route: 'PO', freq: 'TDS', scheduledTime: '08:00', status: 'given', givenBy: 'Nurse Jane', givenAt: '08:10' },
  { id: '4', patient: 'Fatuma Wanjiru', ward: 'Maternity', bed: 'A-12', drug: 'Folic acid', dose: '5 mg', route: 'PO', freq: 'Daily', scheduledTime: '08:00', status: 'given', givenBy: 'Nurse Jane', givenAt: '08:10' },
  { id: '5', patient: 'Joseph Odhiambo', ward: 'Paediatrics', bed: 'P-2', drug: 'Artesunate', dose: '60 mg', route: 'IV', freq: 'Q12H', scheduledTime: '10:00', status: 'due' },
  { id: '6', patient: 'Peter Kamau', ward: 'Medical', bed: 'B-4', drug: 'Rifampicin', dose: '600 mg', route: 'PO', freq: 'Daily', scheduledTime: '10:30', status: 'due' },
  { id: '7', patient: 'Peter Kamau', ward: 'Medical', bed: 'B-4', drug: 'Isoniazid', dose: '300 mg', route: 'PO', freq: 'Daily', scheduledTime: '10:30', status: 'due' },
  { id: '8', patient: 'Wanjiru Njeri', ward: 'Medical', bed: 'B-8', drug: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily', scheduledTime: '08:00', status: 'given', givenBy: 'Nurse Jane', givenAt: '08:08' },
  { id: '9', patient: 'Wanjiru Njeri', ward: 'Medical', bed: 'B-8', drug: 'Metformin', dose: '500 mg', route: 'PO', freq: 'TDS w/meals', scheduledTime: '13:00', status: 'held', notes: 'Patient fasting for procedure' },
  { id: '10', patient: 'Grace Abuya', ward: 'Maternity', bed: 'A-7', drug: 'Folic acid', dose: '5 mg', route: 'PO', freq: 'Daily', scheduledTime: '08:00', status: 'given', givenBy: 'Nurse Jane', givenAt: '08:12' },
];

const STATUS_STYLES: Record<MAREntry['status'], string> = {
  given:   'bg-success/5 text-success border border-success/20',
  due:     'bg-warning/5 text-warning border border-warning/20',
  overdue: 'bg-danger/5 text-danger border border-danger/20',
  held:    'bg-slate-100 text-slate-600 border border-content-border',
  refused: 'bg-violet-100 text-violet-700 border border-violet-200',
};

const routeColor: Record<MAREntry['route'], string> = {
  IV:  'bg-info/5 text-info',
  IM:  'bg-violet-100 text-violet-700',
  PO:  'bg-success/5 text-success',
  SC:  'bg-warning/5 text-warning',
  SL:  'bg-pink-100 text-pink-700',
  TOP: 'bg-slate-100 text-slate-600',
};

export default function MedicationsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'due' | 'overdue' | 'given'>('all');
  const [administering, setAdministering] = useState<string | null>(null);
  const [entries, setEntries] = useState<MAREntry[]>(marData);
  const [adminForm, setAdminForm] = useState<AdminFormState>({
    dose: '',
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    quantity: 1,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  const filtered = entries.filter(m => {
    const matchSearch = search === '' ||
      m.patient.toLowerCase().includes(search.toLowerCase()) ||
      m.drug.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || m.status === filter || (filter === 'due' && m.status === 'overdue');
    return matchSearch && matchFilter;
  });

  function openAdminForm(entry: MAREntry): void {
    const quantityGuess = Number.parseInt(entry.dose, 10);
    setAdminForm({
      dose: entry.dose,
      time: new Date().toTimeString().slice(0, 5),
      notes: '',
      quantity: Number.isFinite(quantityGuess) && quantityGuess > 0 ? quantityGuess : 1,
    });
    setSubmitError(null);
    setAdministering((current) => (current === entry.id ? null : entry.id));
  }

  async function handleConfirmGiven(entry: MAREntry): Promise<void> {
    setSubmittingId(entry.id);
    setSubmitError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const givenAtIso = new Date(`${today}T${adminForm.time}:00`).toISOString();
      const response = await fetch('/api/medical/medications/administer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: entry.patient,
          medicationName: entry.drug,
          dose: adminForm.dose,
          quantity: adminForm.quantity,
          route: entry.route,
          notes: adminForm.notes || undefined,
          givenAt: givenAtIso,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSubmitError(data.error ?? 'Failed to record medication administration.');
        return;
      }

      setEntries((prev) => prev.map((row) => (
        row.id === entry.id
          ? {
              ...row,
              dose: adminForm.dose,
              status: 'given',
              givenBy: 'Current User',
              givenAt: adminForm.time,
              notes: adminForm.notes || row.notes,
            }
          : row
      )));
      setAdministering(null);
    } catch {
      setSubmitError('Network error while recording administration.');
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleNotifyDoctor(entry: MAREntry): Promise<void> {
    setNotifyingId(entry.id);
    setSubmitError(null);
    try {
      const response = await fetch('/api/medical/doctor-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: entry.patient,
          title: `Medication review for ${entry.drug}`,
          message: `${entry.patient} in ${entry.ward} (${entry.bed}) needs doctor review. Medication: ${entry.drug} ${entry.dose}. ${adminForm.notes || 'No additional notes.'}`,
          channel: 'task',
          priority: entry.status === 'overdue' ? 'urgent' : 'routine',
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSubmitError(data.error ?? 'Unable to notify doctor.');
        return;
      }
    } catch {
      setSubmitError('Network error while notifying doctor.');
    } finally {
      setNotifyingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Medication Administration</h1>
          <p className="text-sm text-slate-500 mt-0.5">Medication Administration Record (MAR) — Morning Shift</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'due', 'overdue', 'given'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors capitalize',
                filter === f
                  ? 'text-white border-transparent bg-primary'
                  : 'bg-content-bg text-slate-600 border-content-border hover:bg-content-surface'
              )}
            >
              {f === 'all' ? `All (${entries.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${entries.filter(m => m.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger">
          {submitError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Due / Overdue', value: entries.filter(m => m.status === 'due' || m.status === 'overdue').length, icon: <Clock className="w-5 h-5" />, colorClass: 'text-warning' },
          { label: 'Overdue', value: entries.filter(m => m.status === 'overdue').length, icon: <AlertTriangle className="w-5 h-5" />, colorClass: 'text-danger' },
          { label: 'Administered', value: entries.filter(m => m.status === 'given').length, icon: <CheckCircle className="w-5 h-5" />, colorClass: 'text-success' },
          { label: 'Held / Refused', value: entries.filter(m => m.status === 'held' || m.status === 'refused').length, icon: <Syringe className="w-5 h-5" />, colorClass: 'text-slate-500' },
        ].map(k => (
          <div key={k.label} className="rounded-card bg-content-bg border border-content-border p-4 flex flex-col gap-2 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{k.label}</span>
              <span className={k.colorClass}>{k.icon}</span>
            </div>
            <p className="text-2xl font-bold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search patient or drug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-card border border-content-border bg-content-bg pl-9 pr-4 py-2.5 text-sm text-slate-700 shadow-card outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* MAR Table */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface">
                {['Patient', 'Ward / Bed', 'Drug', 'Dose', 'Route', 'Freq', 'Scheduled', 'Status', 'Given By', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <Fragment key={m.id}>
                  <tr className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{m.patient}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.ward} · {m.bed}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{m.drug}</td>
                    <td className="px-4 py-3 text-slate-600">{m.dose}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', routeColor[m.route])}>{m.route}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.freq}</td>
                    <td className="px-4 py-3 text-slate-500">{m.scheduledTime}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap', STATUS_STYLES[m.status])}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {m.givenBy ? `${m.givenBy} · ${m.givenAt}` : m.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(m.status === 'due' || m.status === 'overdue') && (
                        <button
                          onClick={() => openAdminForm(m)}
                          className="text-xs font-semibold px-3 py-1 rounded-lg text-white bg-primary transition-colors"
                        >
                          Administer
                        </button>
                      )}
                    </td>
                  </tr>
                  {administering === m.id && (
                    <tr key={`${m.id}-form`} className="bg-primary/5 border-b border-primary/10">
                      <td colSpan={10} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Actual Dose</label>
                            <input
                              value={adminForm.dose}
                              onChange={(e) => setAdminForm((prev) => ({ ...prev, dose: e.target.value }))}
                              className="rounded-lg border border-primary/20 bg-content-bg px-3 py-1.5 text-sm w-28 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Time Given</label>
                            <input
                              type="time"
                              value={adminForm.time}
                              onChange={(e) => setAdminForm((prev) => ({ ...prev, time: e.target.value }))}
                              className="rounded-lg border border-primary/20 bg-content-bg px-3 py-1.5 text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Inventory Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={adminForm.quantity}
                              onChange={(e) => setAdminForm((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value || '1', 10) || 1 }))}
                              className="rounded-lg border border-primary/20 bg-content-bg px-3 py-1.5 text-sm w-24 outline-none"
                            />
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Notes (optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. patient tolerated well"
                              value={adminForm.notes}
                              onChange={(e) => setAdminForm((prev) => ({ ...prev, notes: e.target.value }))}
                              className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-1.5 text-sm outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-primary"
                              disabled={submittingId === m.id}
                              onClick={() => void handleConfirmGiven(m)}
                            >
                              {submittingId === m.id ? 'Saving...' : 'Confirm Given'}
                            </button>
                            <button
                              className="px-4 py-1.5 rounded-lg text-sm font-medium border border-warning/30 text-warning hover:bg-warning/10"
                              disabled={notifyingId === m.id}
                              onClick={() => void handleNotifyDoctor(m)}
                            >
                              {notifyingId === m.id ? 'Notifying...' : 'Notify Doctor'}
                            </button>
                            <button
                              onClick={() => setAdministering(null)}
                              className="px-4 py-1.5 rounded-lg text-sm font-medium border border-content-border text-slate-600 hover:bg-content-surface"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
