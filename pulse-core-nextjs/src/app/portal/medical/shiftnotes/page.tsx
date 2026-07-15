'use client';

import { useState } from 'react';
import { Plus, Clock, User, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftNote {
  id: string;
  shift: 'Morning' | 'Afternoon' | 'Night';
  date: string;
  ward: string;
  author: string;
  from: string;
  to: string;
  summary: string;
  handoverItems: string[];
  concerns: string[];
  signed: boolean;
}

const notes: ShiftNote[] = [
  {
    id: '1',
    shift: 'Night',
    date: '15 Jan 2025',
    ward: 'ICU',
    author: 'Nurse Grace Achieng',
    from: '22:00',
    to: '07:00',
    summary: 'Quiet night overall. Hassan Ali (ICU-3) required repositioning ×3 due to SpO₂ instability. Cardiac monitor alarm acknowledged at 03:14 — atrial ectopics, self-terminated.',
    handoverItems: [
      'Hassan Ali — continuous SpO₂ monitoring, escalate if <88% for >5 min',
      'IV Furosemide 40 mg due at 09:00 — not yet administered',
      'Blood transfusion for Fatuma Wanjiru Ward A-12 — Unit 2 in progress',
    ],
    concerns: ['Hassan Ali SpO₂ trending down since 06:00', 'Urine output borderline — monitor closely'],
    signed: true,
  },
  {
    id: '2',
    shift: 'Night',
    date: '15 Jan 2025',
    ward: 'Medical',
    author: 'Nurse James Oloo',
    from: '22:00',
    to: '07:00',
    summary: 'Peter Kamau (B-4) remained afebrile overnight. Wanjiru Njeri (B-8) experienced a hypertensive episode at 02:00 — BP 174/108, duty doctor informed, Nifedipine 10 mg sublingual given.',
    handoverItems: [
      'Wanjiru Njeri — BP monitoring q2h, escalate if systolic >170',
      'Peter Kamau — sputum collection pending, isolation maintained',
      'Morning DR round at 09:30 — patient list updated in system',
    ],
    concerns: ['Wanjiru Njeri still hypertensive at 06:30 (162/100)'],
    signed: true,
  },
];

const SHIFT_COLORS = {
  Morning: 'bg-warning/5 text-warning border border-warning/20',
  Afternoon: 'bg-primary/5 text-primary border border-primary/20',
  Night: 'bg-violet-100 text-violet-700 border border-violet-200',
};

export default function ShiftNotesPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Shift Notes & Handover</h1>
          <p className="text-sm text-slate-500 mt-0.5">Incoming handover summary from night shift — 15 Jan 2025</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-semibold text-white bg-primary shadow-card"
        >
          <Plus className="w-4 h-4" /> Write Shift Note
        </button>
      </div>

      {/* Handover banner */}
      <div className="rounded-card border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary mb-0.5">Handover received from Night Shift</p>
          <p className="text-xs text-primary">22:00 → 07:00 · Signed off by 2 nurses · You are taking over Morning Shift 07:00–15:00</p>
        </div>
        <ArrowRight className="w-5 h-5 text-primary shrink-0" />
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-primary">Your handover due</p>
          <p className="text-lg font-bold text-primary">15:00</p>
        </div>
      </div>

      {/* New note form */}
      {showForm && (
        <div className="rounded-card border border-primary/20 bg-primary/5 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-primary">Write Morning Shift Note</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Ward</label>
              <select className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none">
                {['ICU', 'Medical', 'Maternity', 'Paediatrics', 'Surgical'].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Shift From</label>
              <input type="time" defaultValue="07:00" className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Shift To</label>
              <input type="time" defaultValue="15:00" className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Shift Summary</label>
            <textarea rows={4} className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none resize-none" placeholder="Summarise key events, patient status changes, and actions taken this shift..." />
          </div>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Handover Items (one per line)</label>
            <textarea rows={3} className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none resize-none" placeholder="Pending tasks, upcoming medication times, doctor reviews needed..." />
          </div>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Concerns for Incoming Nurse</label>
            <textarea rows={2} className="w-full rounded-lg border border-primary/20 bg-content-bg px-3 py-2 text-sm outline-none resize-none" placeholder="Any deteriorating patients, escalation triggers, or red flags..." />
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary" onClick={() => setShowForm(false)}>
              Sign & Submit
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-content-border text-slate-600 hover:bg-content-surface">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing notes */}
      <div className="space-y-5">
        {notes.map(note => (
          <div key={note.id} className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
            {/* Note header */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-content-border bg-content-surface/80">
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', SHIFT_COLORS[note.shift])}>
                {note.shift} Shift
              </span>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                {note.from} → {note.to}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <User className="w-3.5 h-3.5" />
                {note.author}
              </div>
              <span className="text-xs text-slate-400">{note.ward} · {note.date}</span>
              {note.signed && (
                <span className="ml-auto flex items-center gap-1 text-xs text-success font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Signed
                </span>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Summary */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Shift Summary</p>
                <p className="text-sm text-slate-700 leading-relaxed">{note.summary}</p>
              </div>

              {/* Handover items */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Handover to Morning Shift</p>
                <ul className="space-y-1">
                  {note.handoverItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Concerns */}
              {note.concerns.length > 0 && (
                <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
                  <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1.5">Concerns</p>
                  <ul className="space-y-1">
                    {note.concerns.map((c, i) => (
                      <li key={i} className="text-sm text-warning flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">⚠</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
