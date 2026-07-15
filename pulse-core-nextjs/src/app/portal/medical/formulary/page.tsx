'use client';

import { useState } from 'react';
import { Search, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const ACCENT = '#3B8B6E';

type DrugClass = 'Antibiotic' | 'Anticoagulant' | 'Analgesic' | 'Antihypertensive' | 'Antidiabetic' | 'Antifungal' | 'Antiretroviral' | 'Corticosteroid';
type RestrictionLevel = 'Controlled' | 'Restricted' | 'Monitored' | 'Unrestricted';

interface Drug {
  id: string;
  drug: string;
  genericName: string;
  class: DrugClass;
  restriction: string;
  level: RestrictionLevel;
  route: string;
}

const FORMULARY: Drug[] = [
  { id: '1',  drug: 'Ceftriaxone',    genericName: 'Ceftriaxone sodium',     class: 'Antibiotic',      restriction: 'ID approval required for >5 days',      level: 'Restricted',   route: 'IV/IM'  },
  { id: '2',  drug: 'Enoxaparin',     genericName: 'Enoxaparin sodium',      class: 'Anticoagulant',   restriction: 'Dose adjustment by renal profile',       level: 'Monitored',    route: 'SC'     },
  { id: '3',  drug: 'Morphine',       genericName: 'Morphine sulfate',       class: 'Analgesic',       restriction: 'Controlled dispensing only',             level: 'Controlled',   route: 'IV/IM/PO' },
  { id: '4',  drug: 'Amlodipine',     genericName: 'Amlodipine besylate',    class: 'Antihypertensive', restriction: 'Routine — no restriction',               level: 'Unrestricted', route: 'PO'     },
  { id: '5',  drug: 'Metformin',      genericName: 'Metformin HCl',          class: 'Antidiabetic',    restriction: 'Hold if eGFR <30 ml/min',               level: 'Monitored',    route: 'PO'     },
  { id: '6',  drug: 'Fluconazole',    genericName: 'Fluconazole',            class: 'Antifungal',      restriction: 'Culture confirmation before initiation', level: 'Restricted',   route: 'IV/PO'  },
  { id: '7',  drug: 'Tenofovir',      genericName: 'Tenofovir disoproxil',   class: 'Antiretroviral',  restriction: 'HIV clinic authorisation required',      level: 'Restricted',   route: 'PO'     },
  { id: '8',  drug: 'Dexamethasone',  genericName: 'Dexamethasone sodium phosphate', class: 'Corticosteroid', restriction: 'Short course only; taper protocol required', level: 'Monitored', route: 'IV/PO' },
];

const LEVEL_TONE: Record<RestrictionLevel, 'danger' | 'warning' | 'info' | 'success'> = {
  Controlled: 'danger',
  Restricted: 'warning',
  Monitored: 'info',
  Unrestricted: 'success',
};

const LEVEL_ICON: Record<RestrictionLevel, React.ReactNode> = {
  Controlled:   <ShieldAlert className="w-3.5 h-3.5" />,
  Restricted:   <AlertTriangle className="w-3.5 h-3.5" />,
  Monitored:    <Info className="w-3.5 h-3.5" />,
  Unrestricted: null,
};

const CLASSES: DrugClass[] = ['Antibiotic', 'Anticoagulant', 'Analgesic', 'Antihypertensive', 'Antidiabetic', 'Antifungal', 'Antiretroviral', 'Corticosteroid'];

export default function MedicalFormularyPage() {
  const [search, setSearch]       = useState('');
  const [classFilter, setClass]   = useState<DrugClass | 'All'>('All');
  const [levelFilter, setLevel]   = useState<RestrictionLevel | 'All'>('All');

  const filtered = FORMULARY.filter((d) => {
    const q = search.toLowerCase();
    const matchQ = !q || d.drug.toLowerCase().includes(q) || d.genericName.toLowerCase().includes(q);
    const matchC = classFilter === 'All' || d.class === classFilter;
    const matchL = levelFilter === 'All' || d.level === levelFilter;
    return matchQ && matchC && matchL;
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-ink">Clinical Formulary Guidance</h1>

      {/* Summary by restriction level */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['Controlled', 'Restricted', 'Monitored', 'Unrestricted'] as RestrictionLevel[]).map((level) => (
          <button key={level} onClick={() => setLevel(levelFilter === level ? 'All' : level)}
            className={`rounded-2xl border border-content-border bg-content-bg p-3 shadow-card text-left transition-all ${
              levelFilter === level ? 'ring-2 ring-portal-primary/40' : ''
            }`}
            style={levelFilter === level ? { outline: `2px solid ${ACCENT}`, outlineOffset: '2px' } : {}}>
            <div className="flex items-center gap-1.5 mb-1"><StatusBadge tone={LEVEL_TONE[level]} size="sm">{level}</StatusBadge></div>
            <p className="text-2xl font-bold text-ink">{FORMULARY.filter(d => d.level === level).length}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drug name…" className="w-full pl-9 pr-3 py-2 text-sm border border-content-border rounded-card bg-content-bg focus:outline-none" />
        </div>
        <select value={classFilter} onChange={(e) => setClass(e.target.value as DrugClass | 'All')}
          className="text-sm border border-content-border rounded-card px-3 py-2 bg-content-bg">
          <option value="All">All Classes</option>
          {CLASSES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-content-border bg-content-bg shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 bg-content-surface border-b border-content-border/50">
              {['Drug', 'Generic Name', 'Class', 'Route', 'Restriction', 'Level'].map((h) => (
                <th key={h} className="px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-content-border/50 hover:bg-content-surface">
                <td className="px-4 py-2.5 font-semibold text-ink">{d.drug}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{d.genericName}</td>
                <td className="px-4 py-2.5 text-slate-600">{d.class}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{d.route}</td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">{d.restriction}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge tone={LEVEL_TONE[d.level]} size="sm">{d.level}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}