'use client';

import { useState } from 'react';
import { RefreshCw, UserPlus, ArrowLeftRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import PredictiveBedManagementPanel from '@/components/admin/PredictiveBedManagementPanel';

const ACCENT = '#3B82F6';

type BedState = 'available' | 'occupied' | 'maintenance';

interface Bed {
  id: string;
  state: BedState;
  patient?: string;
  admission?: string;
  diagnosis?: string;
  expectedDischarge?: string;
  doctor?: string;
}

interface Ward {
  name: string;
  type: string;
  beds: Bed[];
  dischargesExpected: number;
}

const WARDS: Ward[] = [
  {
    name: 'General Ward',
    type: 'General',
    dischargesExpected: 3,
    beds: [
      { id: 'G01', state: 'occupied', patient: 'Wanjiku Kamau', admission: '13 Jan', diagnosis: 'Typhoid fever', expectedDischarge: '17 Jan', doctor: 'Dr. Njoroge' },
      { id: 'G02', state: 'occupied', patient: 'Brian Omondi', admission: '14 Jan', diagnosis: 'Malaria (P. falciparum)', expectedDischarge: '16 Jan', doctor: 'Dr. Njoroge' },
      { id: 'G03', state: 'available' },
      { id: 'G04', state: 'occupied', patient: 'Fatuma Hassan', admission: '12 Jan', diagnosis: 'Hypertensive urgency', expectedDischarge: '17 Jan', doctor: 'Dr. Amina' },
      { id: 'G05', state: 'occupied', patient: 'James Kimani', admission: '15 Jan', diagnosis: 'Acute gastroenteritis', expectedDischarge: '16 Jan', doctor: 'Dr. Njoroge' },
      { id: 'G06', state: 'maintenance' },
      { id: 'G07', state: 'occupied', patient: 'Achieng Otieno', admission: '13 Jan', diagnosis: 'Post-op cholecystectomy', expectedDischarge: '18 Jan', doctor: 'Dr. Hassan' },
      { id: 'G08', state: 'occupied', patient: 'Peter Njoroge', admission: '14 Jan', diagnosis: 'Pneumonia', expectedDischarge: '17 Jan', doctor: 'Dr. Amina' },
      { id: 'G09', state: 'available' },
      { id: 'G10', state: 'occupied', patient: 'Rose Kamau', admission: '11 Jan', diagnosis: 'UTI', expectedDischarge: '15 Jan', doctor: 'Dr. Njoroge' },
      ...Array.from({ length: 14 }, (_, i) => ({ id: `G${11 + i}`, state: i % 3 === 0 ? ('available' as BedState) : ('occupied' as BedState) })),
    ],
  },
  {
    name: 'ICU',
    type: 'Critical Care',
    dischargesExpected: 1,
    beds: [
      { id: 'ICU01', state: 'occupied', patient: 'Samuel Kibet', admission: '13 Jan', diagnosis: 'Septic shock', expectedDischarge: '20 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU02', state: 'occupied', patient: 'Mary Waweru', admission: '14 Jan', diagnosis: 'Severe TBI', expectedDischarge: '25 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU03', state: 'occupied', patient: 'Mohamed Abdi', admission: '12 Jan', diagnosis: 'Respiratory failure', expectedDischarge: '19 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU04', state: 'occupied', patient: 'Joyce Mutua', admission: '15 Jan', diagnosis: 'DKA', expectedDischarge: '17 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU05', state: 'occupied', patient: 'Hassan Musa', admission: '11 Jan', diagnosis: 'Post-cardiac arrest', expectedDischarge: '22 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU06', state: 'occupied', patient: 'Grace Njoki', admission: '14 Jan', diagnosis: 'Multi-organ failure', expectedDischarge: '28 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU07', state: 'occupied', patient: 'Daniel Ochieng', admission: '15 Jan', diagnosis: 'Severe pneumonia', expectedDischarge: '20 Jan', doctor: 'Dr. Amina Osei' },
      { id: 'ICU08', state: 'occupied', patient: 'Nyambura Gicheru', admission: '15 Jan', diagnosis: 'Eclampsia', expectedDischarge: '18 Jan', doctor: 'Dr. Amina Osei' },
    ],
  },
  {
    name: 'Maternity',
    type: 'Maternity',
    dischargesExpected: 4,
    beds: [
      ...Array.from({ length: 19 }, (_, i) => ({ id: `MAT${i + 1}`, state: 'occupied' as BedState, patient: `Patient M${i + 1}` })),
      { id: 'MAT20', state: 'available' },
    ],
  },
  {
    name: 'Paediatric',
    type: 'Paediatric',
    dischargesExpected: 2,
    beds: [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `PAE${i + 1}`, state: 'occupied' as BedState })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `PAE${13 + i}`, state: i === 0 ? ('maintenance' as BedState) : ('available' as BedState) })),
    ],
  },
  {
    name: 'Surgical',
    type: 'Surgical',
    dischargesExpected: 2,
    beds: [
      ...Array.from({ length: 7 }, (_, i) => ({ id: `SRG${i + 1}`, state: 'occupied' as BedState })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `SRG${8 + i}`, state: 'available' as BedState })),
      { id: 'SRG11', state: 'maintenance' },
      { id: 'SRG12', state: 'maintenance' },
    ],
  },
  {
    name: 'Emergency',
    type: 'Emergency',
    dischargesExpected: 5,
    beds: Array.from({ length: 8 }, (_, i) => ({ id: `EMG${i + 1}`, state: 'occupied' as BedState })),
  },
];

const BED_COLORS: Record<BedState, string> = {
  available: '#3282B8',
  occupied: '#EF4444',
  maintenance: '#F59E0B',
};

function getCurrentKenyaTime(): string {
  return new Date().toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function BedsPage() {
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(() => getCurrentKenyaTime());

  const allBeds = WARDS.flatMap((w) => w.beds);
  const totalBeds = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => b.state === 'occupied').length;
  const availableBeds = allBeds.filter((b) => b.state === 'available').length;
  const maintenanceBeds = allBeds.filter((b) => b.state === 'maintenance').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bed Census</h1>
          <p className="text-slate-500 text-sm mt-0.5">Last updated: {lastUpdated || '--:--:--'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLastUpdated(getCurrentKenyaTime())}
            className="flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium text-slate-700 border border-content-border bg-content-bg hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-card text-sm font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <UserPlus className="w-4 h-4" /> Admit Patient
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-card text-sm font-semibold text-slate-700 border border-content-border bg-content-bg hover:bg-slate-100">
            <ArrowLeftRight className="w-4 h-4" /> Transfer
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Beds', value: totalBeds, color: 'text-ink' },
          { label: 'Occupied', value: occupiedBeds, color: 'text-rose-600' },
          { label: 'Available', value: availableBeds, color: 'text-emerald-700' },
          { label: 'Maintenance', value: maintenanceBeds, color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="bg-content-bg border border-content-border rounded-card p-4 text-center shadow-card">
            <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Predictive Bed Management - Desktop/Tablet Optimized */}
      <PredictiveBedManagementPanel />

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(BED_COLORS).map(([state, color]) => (
          <div key={state} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-slate-600 text-xs capitalize">{state}</span>
          </div>
        ))}
      </div>

      {/* Ward Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {WARDS.map((ward) => {
          const occupied = ward.beds.filter((b) => b.state === 'occupied').length;
          const pct = Math.round((occupied / ward.beds.length) * 100);
          const wardColor = pct >= 100 ? '#EF4444' : pct >= 85 ? '#F59E0B' : ACCENT;

          return (
            <div key={ward.name} className="bg-content-bg border border-content-border rounded-card p-5 space-y-4 shadow-card">
              {/* Ward header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-ink font-semibold">{ward.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${wardColor}20`, color: wardColor }}
                    >
                      {ward.type}
                    </span>
                    {pct >= 100 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                        FULL
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {occupied}/{ward.beds.length} occupied · {ward.dischargesExpected} discharge{ward.dischargesExpected !== 1 ? 's' : ''} expected today
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold" style={{ color: wardColor }}>{pct}%</span>
                </div>
              </div>

              {/* Occupancy bar */}
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: wardColor }}
                />
              </div>

              {/* Bed grid */}
              <div className="flex flex-wrap gap-1.5">
                {ward.beds.map((bed) => (
                  <button
                    key={bed.id}
                    onClick={() => bed.state === 'occupied' && bed.patient ? setSelectedBed(bed) : null}
                    title={bed.id + (bed.patient ? ` — ${bed.patient}` : '')}
                    className={cn(
                      'w-7 h-7 rounded-md transition-all',
                      bed.state === 'occupied' ? 'cursor-pointer hover:scale-110 hover:ring-2 ring-white/20' : 'cursor-default',
                    )}
                    style={{ backgroundColor: BED_COLORS[bed.state] }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bed Detail Modal */}
      {selectedBed && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-content-bg border border-content-border rounded-card w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-ink font-semibold text-lg">{selectedBed.patient}</h2>
                <p className="text-slate-500 text-xs mt-0.5">Bed {selectedBed.id}</p>
              </div>
              <button
                onClick={() => setSelectedBed(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Admission Date', value: selectedBed.admission },
                { label: 'Diagnosis', value: selectedBed.diagnosis },
                { label: 'Expected Discharge', value: selectedBed.expectedDischarge },
                { label: 'Doctor', value: selectedBed.doctor },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="text-ink font-medium">{row.value ?? '—'}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                className="flex-1 py-2 rounded-card text-sm font-semibold text-white"
                style={{ backgroundColor: ACCENT }}
                onClick={() => setSelectedBed(null)}
              >
                View Full Record
              </button>
              <button
                onClick={() => setSelectedBed(null)}
                className="flex-1 py-2 rounded-card text-sm font-semibold text-slate-700 border border-content-border hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
