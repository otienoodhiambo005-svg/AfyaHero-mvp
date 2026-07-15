'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Search } from 'lucide-react';

const ACCENT = '#D4763C';

type Severity = 'Major' | 'Moderate' | 'Minor' | 'None';

interface DrugResult {
  id: string;
  patient: string;
  pid: string;
  rxRef: string;
  drugs: string[];
  interaction: string;
  severity: Severity;
  recommendation: string;
  reviewedBy: string;
}

const RESULTS: DrugResult[] = [
  {
    id: '1', patient: 'Hassan Ali', pid: 'PID-10021', rxRef: 'RX-2851',
    drugs: ['Ciprofloxacin 500mg', 'Tizanidine 4mg'],
    interaction: 'Ciprofloxacin inhibits CYP1A2, increasing tizanidine plasma levels up to 10×. Risk of severe hypotension and sedation.',
    severity: 'Major',
    recommendation: 'Avoid combination. Consider alternative antibiotic (e.g. Amoxicillin) or withhold tizanidine during course.',
    reviewedBy: 'PharmD. Njeri',
  },
  {
    id: '2', patient: 'Fatuma Wanjiru', pid: 'PID-10022', rxRef: 'RX-2847',
    drugs: ['Ferrous Sulphate 200mg', 'Calcium Carbonate 500mg'],
    interaction: 'Calcium reduces iron absorption by up to 50% when taken simultaneously.',
    severity: 'Moderate',
    recommendation: 'Separate administration by at least 2 hours. Take iron on empty stomach.',
    reviewedBy: 'PharmD. Ochieng',
  },
  {
    id: '3', patient: 'Peter Kamau', pid: 'PID-10023', rxRef: 'RX-2850',
    drugs: ['Metformin 500mg', 'Lisinopril 10mg'],
    interaction: 'No clinically significant interaction identified.',
    severity: 'None',
    recommendation: 'Safe to dispense as prescribed.',
    reviewedBy: 'PharmD. Njeri',
  },
  {
    id: '4', patient: 'Grace Muthoni', pid: 'PID-10024', rxRef: 'RX-2849',
    drugs: ['Warfarin 5mg', 'Ibuprofen 400mg'],
    interaction: 'NSAIDs potentiate anticoagulant effect of warfarin and increase GI bleeding risk.',
    severity: 'Major',
    recommendation: 'Substitute NSAID with Paracetamol 1g PRN. Monitor INR closely.',
    reviewedBy: 'PharmD. Ochieng',
  },
  {
    id: '5', patient: 'James Odhiambo', pid: 'PID-10025', rxRef: 'RX-2846',
    drugs: ['Amoxicillin 500mg', 'Paracetamol 500mg', 'ORS Sachet'],
    interaction: 'Minor: amoxicillin may reduce efficacy of live BCG vaccine if administered concurrently.',
    severity: 'Minor',
    recommendation: 'Ensure no concurrent live vaccine administration.',
    reviewedBy: 'PharmD. Njeri',
  },
];

const SEV_STYLE: Record<Severity, string> = {
  Major:    'bg-red-50 text-red-700 border-red-100',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-100',
  Minor:    'bg-blue-50 text-blue-700 border-blue-100',
  None:     'bg-green-50 text-green-700 border-green-100',
};

const SEV_ICON: Record<Severity, React.ReactNode> = {
  Major:    <ShieldAlert className="w-4 h-4" />,
  Moderate: <AlertTriangle className="w-4 h-4" />,
  Minor:    <Info className="w-4 h-4" />,
  None:     <CheckCircle2 className="w-4 h-4" />,
};

export default function PharmacyResultsPage() {
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState<Severity | 'All'>('All');

  const filtered = RESULTS.filter((r) => {
    const matchSearch = r.patient.toLowerCase().includes(search.toLowerCase()) || r.rxRef.includes(search);
    const matchSev    = sevFilter === 'All' || r.severity === sevFilter;
    return matchSearch && matchSev;
  });

  const counts = {
    Major:    RESULTS.filter((r) => r.severity === 'Major').length,
    Moderate: RESULTS.filter((r) => r.severity === 'Moderate').length,
    Minor:    RESULTS.filter((r) => r.severity === 'Minor').length,
    None:     RESULTS.filter((r) => r.severity === 'None').length,
  };

  return (
    <div className="space-y-5 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Clinical Pharmacology Results</h1>
        {counts.Major > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> {counts.Major} Major Alert{counts.Major > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['Major', 'Moderate', 'Minor', 'None'] as Severity[]).map((s) => (
          <button key={s}
            onClick={() => setSevFilter(sevFilter === s ? 'All' : s)}
            className={`rounded-card border p-3 text-left shadow-card transition-all ${SEV_STYLE[s]}`}
            style={sevFilter === s ? { outline: `2px solid ${ACCENT}`, outlineOffset: '2px' } : {}}
          >
            <div className="flex items-center gap-1.5 mb-1">{SEV_ICON[s]}<span className="text-xs font-medium">{s}</span></div>
            <p className="text-lg font-bold">{counts[s]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or RX ref"
          aria-label="Search results by patient or prescription reference"
          className="w-full rounded-card border border-content-border bg-content-bg py-2 pl-9 pr-3 text-sm text-charcoal outline-none focus:border-portal-primary/35 focus:ring-2 focus:ring-portal-primary/15" />
      </div>

      {/* Result cards */}
      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className={`rounded-card border p-4 shadow-card ${SEV_STYLE[r.severity]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-ink">{r.patient}</p>
                  <span className="text-xs font-mono text-slate-500">{r.pid}</span>
                  <span className="text-xs font-mono text-slate-500">{r.rxRef}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Drugs: {r.drugs.join(' + ')}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${SEV_STYLE[r.severity]}`}>
                {SEV_ICON[r.severity]}{r.severity}
              </span>
            </div>
            <p className="text-sm mt-2">{r.interaction}</p>
            <div className="mt-2 pt-2 border-t border-content-border">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Recommendation</p>
              <p className="text-sm mt-0.5">{r.recommendation}</p>
            </div>
            <p className="text-xs text-right mt-2 opacity-70">Reviewed by: {r.reviewedBy}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-slate-400">No results match filters.</p>}
      </div>
    </div>
  );
}