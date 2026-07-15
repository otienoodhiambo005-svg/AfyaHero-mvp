'use client';

import { useEffect, useState } from 'react';
import { Bed, AlertCircle, CheckCircle2 } from 'lucide-react';

const ACCENT = '#3B8B6E';

interface Ward {
  id: string;
  name: string;
  occupied: number;
  total: number;
  critical: number;
  pending: number;
}

interface BedAssignmentsResponse {
  wards?: Ward[];
}

const WARDS: Ward[] = [
  { id: '1', name: 'General Medicine', occupied: 20, total: 24, critical: 2, pending: 1 },
  { id: '2', name: 'ICU',              occupied: 8,  total: 8,  critical: 8, pending: 0 },
  { id: '3', name: 'Maternity',        occupied: 15, total: 18, critical: 1, pending: 2 },
  { id: '4', name: 'Paediatrics',      occupied: 11, total: 16, critical: 3, pending: 0 },
  { id: '5', name: 'Surgical',         occupied: 9,  total: 12, critical: 2, pending: 1 },
  { id: '6', name: 'Isolation',        occupied: 2,  total: 6,  critical: 0, pending: 0 },
];

function barColor(pct: number) {
  if (pct >= 1)    return '#dc2626';
  if (pct >= 0.85) return '#d97706';
  return ACCENT;
}

export default function MedicalBedsPage() {
  const [wards, setWards] = useState<Ward[]>(WARDS);

  useEffect(() => {
    let mounted = true;

    const loadAssignments = async () => {
      try {
        const res = await fetch('/api/medical/beds/assignments', { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) return;
        const payload = (await res.json()) as BedAssignmentsResponse;
        if (mounted && Array.isArray(payload.wards) && payload.wards.length > 0) {
          setWards(payload.wards);
        }
      } catch {
        // Keep current UI data on network errors to avoid disrupting workflow.
      }
    };

    void loadAssignments();
    return () => {
      mounted = false;
    };
  }, []);

  const totalOccupied = wards.reduce((s, w) => s + w.occupied, 0);
  const totalBeds     = wards.reduce((s, w) => s + w.total, 0);
  const fullWards     = wards.filter((w) => w.occupied >= w.total).length;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-ink">Bed Management</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Beds',   value: totalBeds,                color: '#64748b' },
          { label: 'Occupied',     value: totalOccupied,            color: '#dc2626' },
          { label: 'Available',    value: totalBeds - totalOccupied, color: ACCENT   },
          { label: 'Full Wards',   value: fullWards,                color: fullWards > 0 ? '#d97706' : ACCENT },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-card">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {wards.map((w) => {
          const pct   = w.occupied / w.total;
          const avail = w.total - w.occupied;
          const full  = pct >= 1;
          return (
            <div key={w.id} className="rounded-2xl border border-content-border bg-content-bg p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-content-surface">
                    <Bed className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{w.name}</p>
                    <p className="text-xs text-slate-500">{w.occupied}/{w.total} occupied</p>
                  </div>
                </div>
                {full
                  ? <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 rounded-full px-2 py-0.5"><AlertCircle className="w-3 h-3" />Full</span>
                  : <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />{avail} free</span>
                }
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 1) * 100}%`, background: barColor(pct) }} />
              </div>
              <p className="text-right text-xs text-slate-400 mt-1">{Math.round(pct * 100)}% occupancy</p>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-red-600 font-medium">{w.critical} critical</span>
                <span className="text-amber-600">{w.pending} pending admission</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}