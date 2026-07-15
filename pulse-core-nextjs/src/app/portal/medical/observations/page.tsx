'use client';

import { useState } from 'react';
import { Activity, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import VoiceDocumentationPanel from '@/components/medical/VoiceDocumentationPanel';

interface Observation {
  id: string;
  patient: string;
  ward: string;
  bed: string;
  category: 'Pain' | 'Intake/Output' | 'Wound' | 'Neuro' | 'Respiratory' | 'Mobility';
  finding: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  time: string;
  nurse: string;
  followUp: boolean;
}

const observations: Observation[] = [
  { id: '1', patient: 'Hassan Ali', ward: 'ICU', bed: 'ICU-3', category: 'Respiratory', finding: 'Laboured breathing at rest; use of accessory muscles noted. SpO₂ trending down over past hour.', severity: 'severe', time: '08:47', nurse: 'Nurse Jane', followUp: true },
  { id: '2', patient: 'Hassan Ali', ward: 'ICU', bed: 'ICU-3', category: 'Intake/Output', finding: 'IV input: 500 ml NS over 4 hrs. Urine output: 60 ml/h (adequate). Mild oedema both ankles.', severity: 'moderate', time: '08:30', nurse: 'Nurse Jane', followUp: false },
  { id: '3', patient: 'Fatuma Wanjiru', ward: 'Maternity', bed: 'A-12', category: 'Neuro', finding: 'Alert and orientated ×3. Reports feeling dizzy on standing. Fetal movements active.', severity: 'mild', time: '09:05', nurse: 'Nurse Jane', followUp: false },
  { id: '4', patient: 'Peter Kamau', ward: 'Medical', bed: 'B-4', category: 'Respiratory', finding: 'Productive cough. Isolation precautions intact. Patient masked. Room negative pressure confirmed.', severity: 'moderate', time: '09:10', nurse: 'Nurse Jane', followUp: true },
  { id: '5', patient: 'Wanjiru Njeri', ward: 'Medical', bed: 'B-8', category: 'Pain', finding: 'Reports headache 6/10. BP 168/104 mmHg. Analgesia withheld pending doctor review.', severity: 'moderate', time: '09:15', nurse: 'Nurse Jane', followUp: true },
  { id: '6', patient: 'Joseph Odhiambo', ward: 'Paediatrics', bed: 'P-2', category: 'Neuro', finding: 'Less irritable compared to admission. Able to take oral fluids. Temp reduced to 38.4°C.', severity: 'mild', time: '09:20', nurse: 'Nurse Jane', followUp: false },
  { id: '7', patient: 'Amina Keita', ward: 'Surgical', bed: 'S-3', category: 'Wound', finding: 'Lower back dressing dry and intact. No erythema or discharge. Ambulating with minimal assistance.', severity: 'normal', time: '09:30', nurse: 'Nurse Jane', followUp: false },
  { id: '8', patient: 'Daniel Muthoni', ward: 'Surgical', bed: 'S-6', category: 'Wound', finding: 'Appendectomy wound: no signs of infection. Steri-strips intact. Bowel sounds normal.', severity: 'normal', time: '09:35', nurse: 'Nurse Jane', followUp: false },
];

const SEVERITY_STYLES: Record<Observation['severity'], string> = {
  normal:   'bg-success/5 text-success border border-success/20',
  mild:     'bg-warning/5 text-warning border border-warning/20',
  moderate: 'bg-warning/5 text-warning border border-warning/20',
  severe:   'bg-danger/5 text-danger border border-danger/20',
};

const CATEGORY_ICONS: Record<Observation['category'], React.ReactNode> = {
  'Pain':        <span className="text-danger">●</span>,
  'Intake/Output': <span className="text-info">●</span>,
  'Wound':       <span className="text-warning">●</span>,
  'Neuro':       <span className="text-violet-400">●</span>,
  'Respiratory': <span className="text-sky-400">●</span>,
  'Mobility':    <span className="text-success">●</span>,
};

const ALL_CATEGORIES = ['All', 'Pain', 'Intake/Output', 'Wound', 'Neuro', 'Respiratory', 'Mobility'];

export default function ObservationsPage() {
  const [catFilter, setCatFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);

  const filtered = catFilter === 'All' ? observations : observations.filter(o => o.category === catFilter);
  const followUpCount = observations.filter(o => o.followUp).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Patient Observations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Nursing observations log — Morning Shift</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-semibold text-white bg-primary shadow-card"
        >
          <Plus className="w-4 h-4" /> New Observation
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Logged', value: observations.length, icon: <Activity className="w-5 h-5" />, colorClass: 'text-primary' },
          { label: 'Follow-up Required', value: followUpCount, icon: <AlertTriangle className="w-5 h-5" />, colorClass: 'text-danger' },
          { label: 'Severe Findings', value: observations.filter(o => o.severity === 'severe').length, icon: <AlertTriangle className="w-5 h-5" />, colorClass: 'text-warning' },
          { label: 'Normal', value: observations.filter(o => o.severity === 'normal').length, icon: <CheckCircle className="w-5 h-5" />, colorClass: 'text-success' },
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

      {/* Voice-First Documentation - Desktop/Tablet Optimized */}
      <VoiceDocumentationPanel />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
              catFilter === c
                ? 'text-white border-transparent bg-primary'
                : 'bg-content-bg text-slate-600 border-content-border hover:bg-content-surface'
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* New observation form */}
      {showForm && (
        <div className="rounded-card border border-primary/20 bg-primary/5 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-primary">Record New Observation</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Patient</label>
              <input type="text" placeholder="Patient name" className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Ward / Bed</label>
              <input type="text" placeholder="e.g. Medical · B-4" className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Category</label>
              <select className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none">
                {ALL_CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Severity</label>
              <select className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none">
                {['normal', 'mild', 'moderate', 'severe'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Finding / Notes</label>
            <textarea rows={3} className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30 resize-none" placeholder="Describe your observation in detail..." />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
              <input type="checkbox" className="rounded" />
              Flag for doctor follow-up
            </label>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary" onClick={() => setShowForm(false)}>
              Save Observation
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-content-border text-slate-600 hover:bg-content-surface">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Observations list */}
      <div className="space-y-3">
        {filtered.map(obs => (
          <div key={obs.id} className={cn(
            'rounded-card border bg-content-bg p-4 shadow-card',
            obs.followUp ? 'border-warning/20' : 'border-content-border'
          )}>
            <div className="flex items-start gap-3">
              <span className="mt-1 shrink-0 text-lg">{CATEGORY_ICONS[obs.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">{obs.patient}</span>
                  <span className="text-xs text-slate-500">{obs.ward} · {obs.bed}</span>
                  <span className="text-xs font-medium text-slate-500">[{obs.category}]</span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', SEVERITY_STYLES[obs.severity])}>
                    {obs.severity}
                  </span>
                  {obs.followUp && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/5 text-warning border border-warning/20 uppercase">
                      <AlertTriangle className="w-2.5 h-2.5" /> Follow-up
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{obs.finding}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {obs.time}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 pl-7">Recorded by {obs.nurse}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
