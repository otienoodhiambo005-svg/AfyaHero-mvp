'use client';

import { useState } from 'react';
import { Activity, User, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const ACCENT = '#3B8B6E';

type TriageLevel = 'Critical' | 'Urgent' | 'Semi-Urgent' | 'Non-Urgent';
type CheckInStatus = 'Waiting' | 'Triaged' | 'Assigned' | 'Cleared';

interface TriagePatient {
  id: string;
  name: string;
  pid: string;
  age: number;
  complaint: string;
  triage: TriageLevel;
  vitals: { bp: string; hr: number; spo2: number; temp: string };
  status: CheckInStatus;
  arrived: string;
  assignedTo?: string;
}

const QUEUE: TriagePatient[] = [
  { id: '1', name: 'Hassan Ali',      pid: 'PID-10021', age: 47, complaint: 'Chest pain, diaphoresis',
    triage: 'Critical', vitals: { bp: '160/104', hr: 112, spo2: 93, temp: '37.1°C' },
    status: 'Assigned', arrived: '09:05', assignedTo: 'Dr. Amina Osei' },
  { id: '2', name: 'Sarah Njoroge',   pid: 'PID-10031', age: 28, complaint: 'Severe asthma attack',
    triage: 'Urgent', vitals: { bp: '118/76', hr: 98, spo2: 90, temp: '37.4°C' },
    status: 'Triaged', arrived: '09:20' },
  { id: '3', name: 'James Odhiambo', pid: 'PID-10025', age: 62, complaint: 'Profuse watery diarrhoea',
    triage: 'Semi-Urgent', vitals: { bp: '105/65', hr: 88, spo2: 97, temp: '38.2°C' },
    status: 'Waiting', arrived: '09:35' },
  { id: '4', name: 'Mary Akinyi',    pid: 'PID-10036', age: 5,  complaint: 'Febrile seizure (resolved)',
    triage: 'Urgent', vitals: { bp: '92/60', hr: 118, spo2: 98, temp: '40.0°C' },
    status: 'Assigned', arrived: '09:42', assignedTo: 'Dr. Hassan Noor' },
  { id: '5', name: 'David Kamau',    pid: 'PID-10040', age: 34, complaint: 'Laceration — right forearm',
    triage: 'Non-Urgent', vitals: { bp: '122/78', hr: 75, spo2: 99, temp: '36.8°C' },
    status: 'Waiting', arrived: '09:50' },
];

const TRIAGE_STYLE: Record<TriageLevel, string> = {
  Critical:      'bg-red-600 text-white',
  Urgent:        'bg-amber-500 text-white',
  'Semi-Urgent': 'bg-yellow-400 text-ink',
  'Non-Urgent':  'bg-green-500 text-white',
};

const STATUS_STYLE: Record<CheckInStatus, string> = {
  Waiting:  'bg-amber-50 text-amber-700',
  Triaged:  'bg-blue-50 text-blue-700',
  Assigned: 'bg-green-50 text-green-700',
  Cleared:  'bg-slate-100 text-slate-500',
};

export default function MedicalCheckinPage() {
  const [triageFilter, setTriageFilter] = useState<TriageLevel | 'All'>('All');
  const filtered = QUEUE.filter((p) => triageFilter === 'All' || p.triage === triageFilter);
  const critical  = QUEUE.filter((p) => p.triage === 'Critical').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Clinical Check-In &amp; Triage</h1>
        {critical > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> {critical} Critical
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ['Critical',  QUEUE.filter(p => p.triage === 'Critical').length,  'bg-red-50 text-red-700'],
          ['Urgent',    QUEUE.filter(p => p.triage === 'Urgent').length,    'bg-amber-50 text-amber-700'],
          ['Waiting',   QUEUE.filter(p => p.status === 'Waiting').length,   'bg-blue-50 text-blue-700'],
          ['Assigned',  QUEUE.filter(p => p.status === 'Assigned').length,  'bg-green-50 text-green-700'],
        ] as [string, number, string][]).map(([label, value, cls]) => (
          <div key={label} className={`rounded-2xl border p-3 shadow-card ${cls}`}>
            <p className="text-xs font-medium">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['All', 'Critical', 'Urgent', 'Semi-Urgent', 'Non-Urgent'] as const).map((t) => (
          <button key={t} onClick={() => setTriageFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              triageFilter === t ? 'text-white border-transparent' : 'bg-content-bg border-content-border text-slate-600'
            }`}
            style={triageFilter === t ? { background: ACCENT } : {}}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-2xl border border-content-border bg-content-bg p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-card bg-content-surface"><User className="w-4 h-4 text-slate-500" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <span className="text-xs font-mono text-slate-400">{p.pid}</span>
                    <span className="text-xs text-slate-400">{p.age}y</span>
                  </div>
                  <p className="text-sm text-slate-500">{p.complaint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TRIAGE_STYLE[p.triage]}`}>{p.triage}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> BP {p.vitals.bp}</span>
              <span>HR {p.vitals.hr} bpm</span>
              <span>SpO₂ {p.vitals.spo2}%</span>
              <span>Temp {p.vitals.temp}</span>
              <span className="flex items-center gap-1 ml-auto"><Clock className="w-3 h-3" /> {p.arrived}</span>
            </div>
            {p.assignedTo && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Assigned to {p.assignedTo}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}