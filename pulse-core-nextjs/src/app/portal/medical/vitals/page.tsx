'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, Wind, Droplets, Activity, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface VitalSet {
  patient: string;
  ward: string;
  bed: string;
  time: string;
  bp: string;
  hr: number;
  rr: number;
  temp: number;
  spo2: number;
  gcs?: number;
  trend: 'stable' | 'improving' | 'deteriorating';
}

interface ApiErrorResponse {
  error?: string;
}

const WARDS = ['All Wards', 'ICU', 'Medical', 'Maternity', 'Paediatrics', 'Surgical'];

const trendBadge = {
  stable: 'bg-slate-100 text-slate-600 border border-content-border',
  improving: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
  deteriorating: 'bg-red-100 text-red-600 border border-red-200',
};

const ACCENT = '#2A7BBE';

function ValueCell({ val, warn, critical }: { val: number | string; warn?: boolean; critical?: boolean }) {
  return (
    <span className={cn(
      'font-medium',
      critical ? 'text-red-600 font-bold' : warn ? 'text-amber-600' : 'text-ink'
    )}>
      {val}
    </span>
  );
}

export default function VitalsPage() {
  const [ward, setWard] = useState('All Wards');
  const [vitals, setVitals] = useState<VitalSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    sbp: '',
    dbp: '',
    hr: '',
    rr: '',
    temp: '',
    spo2: '',
    gcs: '',
  });

  const loadVitals = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/medical/vitals', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load vitals (${res.status})`);
      const data = await res.json();
      setVitals(Array.isArray(data) ? data : (data.vitals ?? []));
    } catch (err) {
      logger.error('Failed to load vitals', { error: err });
      setLoadError(err instanceof Error ? err.message : 'Could not load vitals.');
      setVitals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVitals();
  }, [loadVitals]);

  const filtered = ward === 'All Wards' ? vitals : vitals.filter(v => v.ward === ward);

  const handleSaveVitals = async () => {
    if (!recording) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, string | number> = {
      patient_id: '00000000-0000-0000-0000-000000000000', // Placeholder as UI uses static names
    };

    if (form.sbp.trim()) payload.sbp = Number(form.sbp);
    if (form.dbp.trim()) payload.dbp = Number(form.dbp);
    if (form.hr.trim()) payload.heart_rate = Number(form.hr);
    if (form.rr.trim()) payload.respiratory_rate = Number(form.rr);
    if (form.temp.trim()) payload.temperature = Number(form.temp);
    if (form.spo2.trim()) payload.spo2 = Number(form.spo2);

    try {
      const res = await fetch('/api/medical/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        setError(data.error ?? 'Failed to save vitals.');
        return;
      }

      setRecording(null);
      setForm({ sbp: '', dbp: '', hr: '', rr: '', temp: '', spo2: '', gcs: '' });
    } catch {
      setError('Unable to connect to vitals service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Vitals Charting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record and monitor patient vital signs by ward</p>
        </div>
        <div className="relative">
          <select
            value={ward}
            onChange={e => setWard(e.target.value)}
            className="appearance-none rounded-lg border border-content-border bg-content-bg px-4 py-2 pr-8 text-sm font-medium text-slate-700 shadow-card outline-none"
          >
            {WARDS.map(w => <option key={w}>{w}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
        </div>
      )}

      {/* Error State */}
      {loadError && !loading && (
        <div className="rounded-card border border-content-border bg-content-bg p-6 text-center space-y-3">
          <p className="text-sm text-severity-high">{loadError}</p>
          <button onClick={() => void loadVitals()} className="text-xs font-medium px-4 py-2 rounded-control bg-portal-primary text-white hover:bg-portal-primary-hover transition-colors">Retry</button>
        </div>
      )}

      {!loading && !loadError && (<>
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monitoring', value: filtered.length, icon: <HeartPulse className="w-5 h-5" />, color: 'blue' },
          { label: 'Deteriorating', value: filtered.filter(v => v.trend === 'deteriorating').length, icon: <Activity className="w-5 h-5" />, color: 'red' },
          { label: 'Improving', value: filtered.filter(v => v.trend === 'improving').length, icon: <Wind className="w-5 h-5" />, color: 'emerald' },
          { label: 'Stable', value: filtered.filter(v => v.trend === 'stable').length, icon: <Droplets className="w-5 h-5" />, color: 'slate' },
        ].map(k => (
          <div key={k.label} className="rounded-card bg-content-bg border border-content-border p-4 flex flex-col gap-2 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{k.label}</span>
              <span style={{ color: k.color === 'red' ? '#dc2626' : k.color === 'emerald' ? '#059669' : ACCENT }}>{k.icon}</span>
            </div>
            <p className="text-2xl font-bold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Vitals Table */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
          <h2 className="text-sm font-semibold text-ink">Patient Vitals — {ward}</h2>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <HeartPulse className="w-8 h-8 text-slate mx-auto mb-3" />
              <p className="text-sm text-slate">No vitals recorded for this ward</p>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface">
                {['Patient', 'Ward / Bed', 'Time', 'BP (mmHg)', 'HR (bpm)', 'RR (/min)', 'Temp (°C)', 'SpO₂ (%)', 'GCS', 'Trend', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={i} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{v.patient}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{v.ward} · {v.bed}</td>
                  <td className="px-4 py-3 text-slate-500">{v.time}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ValueCell val={v.bp} warn={v.bp.startsWith('16') || v.bp.startsWith('9')} />
                  </td>
                  <td className="px-4 py-3">
                    <ValueCell val={v.hr} critical={v.hr > 110} warn={v.hr > 100} />
                  </td>
                  <td className="px-4 py-3">
                    <ValueCell val={v.rr} warn={v.rr > 20} critical={v.rr > 25} />
                  </td>
                  <td className="px-4 py-3">
                    <ValueCell val={v.temp.toFixed(1)} warn={v.temp > 37.5} critical={v.temp > 38} />
                  </td>
                  <td className="px-4 py-3">
                    <ValueCell val={`${v.spo2}%`} warn={v.spo2 < 95} critical={v.spo2 < 90} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{v.gcs ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap', trendBadge[v.trend])}>
                      {v.trend}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setError(null);
                        setRecording(v.patient === recording ? null : v.patient);
                      }}
                      className="text-xs font-medium px-3 py-1 rounded-control border border-portal-primary/30 text-portal-primary hover:bg-portal-primary/5 transition-colors"
                    >
                      {recording === v.patient ? 'Cancel' : 'Record'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
      </>)}

      {/* Inline record form */}
      {recording && (
        <div className="rounded-card border border-blue-200 bg-blue-50 p-5">
          <h3 className="text-sm font-semibold text-blue-700 mb-4">Record New Vitals — {recording}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['SBP', 'DBP', 'HR (bpm)', 'RR (/min)', 'Temp (°C)', 'SpO₂ (%)', 'GCS (3-15)'].map(field => (
              <div key={field}>
                <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide block mb-1">{field}</label>
                <input
                  type="text"
                  placeholder="—"
                  value={
                    field === 'SBP' ? form.sbp :
                    field === 'DBP' ? form.dbp :
                    field.startsWith('HR') ? form.hr :
                    field.startsWith('RR') ? form.rr :
                    field.startsWith('Temp') ? form.temp :
                    field.startsWith('SpO') ? form.spo2 : form.gcs
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((prev) => {
                      if (field === 'SBP') return { ...prev, sbp: next };
                      if (field === 'DBP') return { ...prev, dbp: next };
                      if (field.startsWith('HR')) return { ...prev, hr: next };
                      if (field.startsWith('RR')) return { ...prev, rr: next };
                      if (field.startsWith('Temp')) return { ...prev, temp: next };
                      if (field.startsWith('SpO')) return { ...prev, spo2: next };
                      return { ...prev, gcs: next };
                    });
                  }}
                  className="w-full rounded-lg border border-blue-200 bg-content-bg px-3 py-2 text-sm text-ink outline-none focus:ring-2 ring-blue-300"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: ACCENT }}
              onClick={() => {
                void handleSaveVitals();
              }}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Vitals'}
            </button>
            <button
              onClick={() => {
                setError(null);
                setRecording(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-content-border hover:bg-content-surface"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
