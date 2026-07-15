'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Filter } from 'lucide-react';

type Station = 'Hematology' | 'Chemistry' | 'Microbiology' | 'Serology' | 'Urinalysis';
type SampleStatus = 'Processing' | 'Awaiting Analysis' | 'Complete' | 'QC Hold';

interface Sample {
  id: string;
  patient: string;
  station: Station;
  test: string;
  priority: 'STAT' | 'Urgent' | 'Routine';
  status: SampleStatus;
  receivedAt: string;
  etaMin: number;
}

const QUEUE: Sample[] = [
  { id: 'SMP-4101', patient: 'Hassan Ali',     station: 'Hematology',  test: 'Full Blood Count',        priority: 'STAT',    status: 'Processing',       receivedAt: '08:42', etaMin: 6 },
  { id: 'SMP-4102', patient: 'Grace Abuya',    station: 'Chemistry',   test: 'LFTs + Renal Profile',    priority: 'Urgent',  status: 'Awaiting Analysis', receivedAt: '08:50', etaMin: 11 },
  { id: 'SMP-4103', patient: 'Fatuma Wanjiru', station: 'Microbiology', test: 'Blood Culture & Sensitivity', priority: 'Urgent', status: 'Processing',       receivedAt: '09:01', etaMin: 17 },
  { id: 'SMP-4104', patient: 'Peter Kamau',    station: 'Serology',    test: 'HIV & Hepatitis Screen',  priority: 'Routine', status: 'Awaiting Analysis', receivedAt: '09:08', etaMin: 22 },
  { id: 'SMP-4105', patient: 'Daniel Muthoni', station: 'Urinalysis',  test: 'Urine M/C/S',             priority: 'Routine', status: 'Complete',          receivedAt: '08:30', etaMin: 0 },
  { id: 'SMP-4106', patient: 'Amina Keita',    station: 'Hematology',  test: 'Coagulation Profile',     priority: 'STAT',    status: 'QC Hold',           receivedAt: '09:15', etaMin: 8 },
  { id: 'SMP-4107', patient: 'Joseph Odhiambo', station: 'Chemistry',   test: 'Cardiac Enzymes (Troponin)', priority:'STAT',   status: 'Processing',       receivedAt: '09:20', etaMin: 14 },
];

const STATUS_STYLE: Record<SampleStatus, string> = {
  Processing:        'bg-blue-50 text-blue-700',
  'Awaiting Analysis':'bg-amber-50 text-amber-700',
  Complete:          'bg-green-50 text-green-700',
  'QC Hold':         'bg-red-50 text-red-700',
};

const STATUS_ICON: Record<SampleStatus, React.ReactNode> = {
  Processing:        <Clock className="w-3.5 h-3.5" />,
  'Awaiting Analysis':<Clock className="w-3.5 h-3.5" />,
  Complete:          <CheckCircle2 className="w-3.5 h-3.5" />,
  'QC Hold':         <AlertTriangle className="w-3.5 h-3.5" />,
};

const PRIORITY_STYLE: Record<string, string> = {
  STAT:    'bg-red-50 text-red-700',
  Urgent:  'bg-amber-50 text-amber-700',
  Routine: 'bg-slate-100 text-slate-600',
};

export default function LabQueuePage() {
  const [stationFilter, setStationFilter] = useState<Station | 'All'>('All');
  const [statusFilter,  setStatusFilter]  = useState<SampleStatus | 'All'>('All');

  const stations: (Station | 'All')[]  = ['All', 'Hematology', 'Chemistry', 'Microbiology', 'Serology', 'Urinalysis'];
  const statuses: (SampleStatus | 'All')[] = ['All', 'Processing', 'Awaiting Analysis', 'QC Hold', 'Complete'];

  const filtered = QUEUE.filter((s) => {
    const matchSt  = stationFilter === 'All' || s.station === stationFilter;
    const matchSta = statusFilter === 'All'  || s.status  === statusFilter;
    return matchSt && matchSta;
  });

  const statCounts = {
    processing: QUEUE.filter((s) => s.status === 'Processing').length,
    holds:      QUEUE.filter((s) => s.status === 'QC Hold').length,
    complete:   QUEUE.filter((s) => s.status === 'Complete').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Sample Processing Queue</h1>
        {statCounts.holds > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {statCounts.holds} QC Hold{statCounts.holds > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Processing',  value: statCounts.processing, icon: <Clock className="w-4 h-4" />,         color: '#3282B8' },
          { label: 'QC Hold',     value: statCounts.holds,      icon: <AlertTriangle className="w-4 h-4" />,  color: '#dc2626' },
          { label: 'Completed',   value: statCounts.complete,   icon: <CheckCircle2 className="w-4 h-4" />,  color: '#16a34a' },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card flex items-center gap-2">
            <span style={{ color: k.color }}>{k.icon}</span>
            <div><p className="text-xs text-slate-500">{k.label}</p><p className="font-bold text-ink text-lg">{k.value}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value as Station | 'All')}
          aria-label="Filter by lab station"
          className="rounded-card border border-content-border bg-content-bg px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300">
          {stations.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SampleStatus | 'All')}
          aria-label="Filter by sample status"
          className="rounded-card border border-content-border bg-content-bg px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300">
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-content-border">
              <th className="py-3 px-4">Sample ID</th>
              <th className="py-3 px-4">Patient</th>
              <th className="py-3 px-4">Test</th>
              <th className="py-3 px-4">Station</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Received</th>
              <th className="py-3 px-4">ETA</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{s.id}</td>
                <td className="py-2.5 px-4 font-medium text-ink">{s.patient}</td>
                <td className="py-2.5 px-4 text-slate-600">{s.test}</td>
                <td className="py-2.5 px-4 text-slate-600">{s.station}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLE[s.priority]}`}>{s.priority}</span>
                </td>
                <td className="py-2.5 px-4 text-slate-500">{s.receivedAt}</td>
                <td className="py-2.5 px-4 text-slate-600">{s.status === 'Complete' ? '—' : `${s.etaMin} min`}</td>
                <td className="py-2.5 px-4">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>
                    {STATUS_ICON[s.status]}{s.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No samples match filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}