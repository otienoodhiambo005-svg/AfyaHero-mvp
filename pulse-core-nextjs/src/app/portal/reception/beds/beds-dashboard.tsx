'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  Bed, User, Calendar, Loader2, 
  ArrowRightLeft, Check, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface Bed {
  id: string;
  bedNumber: string;
  ward: string;
  type: 'general' | 'icu' | 'maternity' | 'peds';
  status: 'free' | 'occupied' | 'cleaning';
  patientName?: string;
  diagnosis?: string;
  admittedAt?: string;
  daysAdmitted?: number;
  expectedDischarge?: string;
}

interface WardStats {
  ward: string;
  total: number;
  occupied: number;
  available: number;
  cleaning: number;
}

export default function BedsDashboard() {
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<WardStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBeds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reception/beds', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load beds (${res.status})`);
      const data = await res.json();
      setBeds(Array.isArray(data.beds) ? data.beds : []);
      setWards(Array.isArray(data.wards) ? data.wards : []);
    } catch (err) {
      logger.error('Failed to load beds', { error: err });
      setError(err instanceof Error ? err.message : 'Could not load beds.');
      setBeds([]);
      setWards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBeds(); }, [loadBeds]);

  const filteredBeds = selectedWard === 'all' 
    ? beds 
    : beds.filter(b => b.ward === selectedWard);

  const totalBeds = wards.reduce((sum, w) => sum + w.total, 0);
  const occupied = wards.reduce((sum, w) => sum + w.occupied, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

  const bedColors: Record<string, { bg: string; border: string }> = {
    free: { bg: 'bg-success/5', border: 'border-success/30' },
    occupied: { bg: 'bg-danger/5', border: 'border-danger/30' },
    cleaning: { bg: 'bg-warning/5', border: 'border-warning/30' },
  };

  const typeColors: Record<string, string> = {
    general: 'bg-primary/5 text-primary',
    icu: 'bg-purple-100 text-purple-700',
    maternity: 'bg-pink-100 text-pink-700',
    peds: 'bg-warning/5 text-warning',
  };

  return (
    <div className="flex h-full">
      {/* Main Grid */}
      <div className="flex-1 flex flex-col">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-content-surface">
          <div className="bg-content-bg rounded-lg border p-4">
            <div className="text-3xl font-bold">{totalBeds}</div>
            <div className="text-sm text-gray-500">Vilala Vyote</div>
          </div>
          <div className="bg-content-bg rounded-lg border p-4">
            <div className="text-3xl font-bold text-danger">{occupied}</div>
            <div className="text-sm text-gray-500">Waliopo</div>
          </div>
          <div className="bg-content-bg rounded-lg border p-4">
            <div className="text-3xl font-bold text-success">{totalBeds - occupied}</div>
            <div className="text-sm text-gray-500">Wazio</div>
          </div>
          <div className="bg-content-bg rounded-lg border p-4">
            <div className="text-3xl font-bold text-warning">{occupancyRate}%</div>
            <div className="text-sm text-gray-500">Kiwango cha kujaza</div>
          </div>
        </div>

        {/* Ward Tabs */}
        <div className="border-b px-6 py-3 flex gap-2 bg-content-bg overflow-x-auto">
          <button
            onClick={() => setSelectedWard('all')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap',
              selectedWard === 'all' 
                ? 'bg-primary text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Zote
          </button>
          {wards.map(w => (
            <button
              key={w.ward}
              onClick={() => setSelectedWard(w.ward)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-2',
                selectedWard === w.ward 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {w.ward}
              <span className="text-xs bg-content-bg/20 px-1.5 py-0.5 rounded">
                {w.occupied}/{w.total}
              </span>
            </button>
          ))}
        </div>

        {/* Bed Grid */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Loading beds…</p>
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center justify-center h-full gap-2 text-danger">
              <AlertTriangle className="w-6 h-6" />
              <p className="text-sm">{error}</p>
              <button onClick={() => void loadBeds()} className="text-xs text-primary hover:underline">Retry</button>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {filteredBeds.map(bed => {
                const colors = bedColors[bed.status];
                return (
                  <div
                    key={bed.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBed(bed)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBed(bed); } }}
                    className={cn(
                      'aspect-square rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-md flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35',
                      colors.bg,
                      colors.border,
                      selectedBed?.id === bed.id && 'ring-2 ring-blue-500'
                    )}
                  >
                    <div className="text-xs font-medium text-gray-500">{bed.bedNumber}</div>
                    <div className="flex-1 flex items-center justify-center">
                      {bed.status === 'free' ? (
                        <Bed className="w-8 h-8 text-success" />
                      ) : bed.status === 'cleaning' ? (
                        <Loader2 className="w-8 h-8 text-warning animate-spin" />
                      ) : (
                        <User className="w-8 h-8 text-danger" />
                      )}
                    </div>
                    {bed.status === 'occupied' && (
                      <div className="text-xs truncate text-center">{bed.patientName?.split(' ')[0]}</div>
                    )}
                    <div className={cn(
                      'text-xs text-center rounded-full mt-1',
                      typeColors[bed.type]
                    )}>
                      {bed.type.toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="border-t px-6 py-3 flex items-center gap-6 bg-content-bg text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-success/5 border border-success/30" />
            <span>Wazio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-danger/5 border border-danger/30" />
            <span>Waliopo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-warning/5 border border-warning/30" />
            <span>Inasafishwa</span>
          </div>
        </div>
      </div>

      {/* Detail Sidebar */}
      {selectedBed && (
        <div className="w-80 border-l bg-content-bg flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold">{selectedBed.bedNumber}</h2>
            <span className={cn('px-2 py-1 rounded-full text-xs', typeColors[selectedBed.type])}>
              {selectedBed.type}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {selectedBed.status === 'free' ? (
              <div className="text-center py-8">
                <Bed className="w-12 h-12 mx-auto text-success mb-4" />
                <p className="text-gray-500">Kitanda kinajaza</p>
                <button className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                  Laza Mgonjwa
                </button>
              </div>
            ) : selectedBed.status === 'cleaning' ? (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 mx-auto text-warning animate-spin mb-4" />
                <p className="text-gray-500">Inasafishwa</p>
                <button className="mt-4 px-4 py-2 bg-success text-white rounded-md hover:bg-success/90">
                  <Check className="w-4 h-4 inline mr-1" />
                  Imeekwama
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">Mgonjwa</label>
                  <p className="font-medium">{selectedBed.patientName}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Utangulizi</label>
                  <p className="font-medium">{selectedBed.diagnosis}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Siku</label>
                  <p className="font-medium">{selectedBed.daysAdmitted} siku</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Alikuwa</label>
                  <p className="font-medium">{selectedBed.admittedAt}</p>
                </div>
                {selectedBed.expectedDischarge && (
                  <div>
                    <label className="text-xs text-gray-500">Atoka</label>
                    <p className="font-medium">{selectedBed.expectedDischarge}</p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <button className="w-full px-4 py-2 border border-danger text-danger rounded-md hover:bg-danger/5">
                    Ruhusa Mgonjwa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}