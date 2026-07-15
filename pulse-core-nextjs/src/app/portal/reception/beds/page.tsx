'use client';

import { useMemo, useState } from 'react';
import { Search, ArrowRightLeft, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

type BedStatus = 'Available' | 'Occupied' | 'Cleaning';

interface WardBed {
  bed: string;
  ward: string;
  status: BedStatus;
  patient?: string;
}

interface AdmitRequest {
  id: string;
  patient: string;
  reason: string;
  priority: 'Urgent' | 'Normal';
  requestedBy: string;
}

const beds: WardBed[] = [
  { bed: 'G-12', ward: 'General', status: 'Available' },
  { bed: 'G-13', ward: 'General', status: 'Occupied', patient: 'Fatuma Hassan' },
  { bed: 'M-04', ward: 'Maternity', status: 'Occupied', patient: 'Achieng Otieno' },
  { bed: 'M-09', ward: 'Maternity', status: 'Available' },
  { bed: 'P-02', ward: 'Paediatric', status: 'Cleaning' },
  { bed: 'ICU-03', ward: 'ICU', status: 'Occupied', patient: 'Samuel Kibet' },
];

const requests: AdmitRequest[] = [
  { id: 'ADM-201', patient: 'Joyce Kamau', reason: 'Observation post asthma exacerbation', priority: 'Urgent', requestedBy: 'Dr. Abuya' },
  { id: 'ADM-202', patient: 'Peter Njoroge', reason: 'Pneumonia with oxygen requirement', priority: 'Normal', requestedBy: 'Dr. Amina' },
  { id: 'ADM-203', patient: 'Mary Achieng', reason: 'Post-op monitoring', priority: 'Normal', requestedBy: 'Dr. Hassan' },
];

const bedStyle: Record<BedStatus, string> = {
  Available: 'bg-success/5 text-success border border-success/20',
  Occupied: 'bg-danger/5 text-danger border border-danger/20',
  Cleaning: 'bg-warning/5 text-warning border border-warning/20',
};

export default function Page() {
  const [query, setQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState<'All' | 'General' | 'Maternity' | 'Paediatric' | 'ICU'>('All');

  const filteredBeds = useMemo(() => {
    const q = query.toLowerCase();
    return beds.filter((b) => {
      const wardMatch = selectedWard === 'All' || b.ward === selectedWard;
      const searchMatch = b.bed.toLowerCase().includes(q) || b.ward.toLowerCase().includes(q) || (b.patient ?? '').toLowerCase().includes(q);
      return wardMatch && searchMatch;
    });
  }, [query, selectedWard]);

  const kpis = {
    total: beds.length,
    available: beds.filter((b) => b.status === 'Available').length,
    occupied: beds.filter((b) => b.status === 'Occupied').length,
    requests: requests.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bed Allocation Desk</h1>
          <p className="text-sm text-slate-600">Assign beds from reception based on availability and triage priority</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-card bg-warning hover:bg-warning/90 text-ink text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/35">
          <UserPlus className="w-4 h-4" /> New Admission
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-card border border-content-border bg-content-bg p-3"><p className="text-xs text-slate-500">Total Beds</p><p className="text-xl font-bold text-ink">{kpis.total}</p></div>
        <div className="rounded-card border border-success/20 bg-success/5 p-3"><p className="text-xs text-success">Available</p><p className="text-xl font-bold text-success">{kpis.available}</p></div>
        <div className="rounded-card border border-danger/20 bg-danger/5 p-3"><p className="text-xs text-danger">Occupied</p><p className="text-xl font-bold text-danger">{kpis.occupied}</p></div>
        <div className="rounded-card border border-primary/20 bg-primary/5 p-3"><p className="text-xs text-primary">Pending Admissions</p><p className="text-xl font-bold text-primary">{kpis.requests}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by bed, ward, or patient..." aria-label="Search beds by number, ward, or patient" className="w-full pl-10 pr-4 py-2.5 rounded-card border border-content-border bg-content-bg text-sm focus:outline-none focus:ring-2 focus:ring-warning/20" />
        </div>
        <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value as 'All' | 'General' | 'Maternity' | 'Paediatric' | 'ICU')} aria-label="Filter beds by ward" className="w-full px-3 py-2.5 rounded-card border border-content-border bg-content-bg text-sm focus:outline-none focus:ring-2 focus:ring-warning/20">
          <option value="All">All wards</option>
          <option value="General">General</option>
          <option value="Maternity">Maternity</option>
          <option value="Paediatric">Paediatric</option>
          <option value="ICU">ICU</option>
        </select>
      </div>

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card overflow-x-auto">
        <h2 className="text-sm font-semibold text-ink mb-3">Current Bed Board</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">Bed</th><th className="py-2">Ward</th><th className="py-2">Status</th><th className="py-2">Patient</th><th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredBeds.map((b) => (
              <tr key={b.bed} className="border-b border-content-border/50">
                <td className="py-2 font-mono text-xs text-warning">{b.bed}</td>
                <td className="py-2 text-slate-700">{b.ward}</td>
                <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', bedStyle[b.status])}>{b.status}</span></td>
                <td className="py-2 text-slate-700">{b.patient ?? '—'}</td>
                <td className="py-2"><button onClick={() => alert(`Reassign bed ${b.bed} in ${b.ward}`)} className="text-xs font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 rounded-md px-1.5 py-1" aria-label={`Reassign bed ${b.bed}`}><ArrowRightLeft className="w-3 h-3" /> Reassign</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-3">Admission Requests</h2>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded-card border border-content-border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">{r.patient} <span className="text-xs text-slate-500">({r.id})</span></p>
                <p className="text-xs text-slate-600">{r.reason} • requested by {r.requestedBy}</p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border', r.priority === 'Urgent' ? 'bg-danger/5 text-danger border-danger/20' : 'bg-slate-100 text-slate-700 border-content-border')}>{r.priority}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}