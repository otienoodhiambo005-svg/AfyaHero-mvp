'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  FlaskConical, 
  AlertCircle, 
  Search, 
  Filter, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Download,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface LabResult {
  id: string;
  patient: string;
  ward: string;
  test: string;
  category: 'Hematology' | 'Biochemistry' | 'Microbiology' | 'Imaging';
  value: string;
  unit: string;
  range: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
  time: string;
  trends: number[];
}

export default function LabResultsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/results', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load lab results (${res.status})`);
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      logger.error('Failed to load lab results', { error: err });
      setError(err instanceof Error ? err.message : 'Could not load lab results.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadResults(); }, [loadResults]);

  const filtered = results.filter(r => {
    const matchesSearch = r.patient.toLowerCase().includes(search.toLowerCase()) || 
                         r.test.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || r.category === category;
    return matchesSearch && matchesCat;
  });

  const selectedResult = results.find(r => r.id === selectedId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink tracking-tight">Clinical Laboratory</h1>
          <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest">Real-time Result Telemetry</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2.5 rounded-card bg-content-bg border border-content-border text-slate-400 hover:text-primary hover:border-primary/20 transition-all shadow-card">
            <Download className="w-5 h-5" />
          </button>
          <button className="px-6 py-2.5 rounded-card text-sm font-black text-white bg-primary shadow-lg shadow-primary/30 active:scale-95 transition-all">
            New Lab Request
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
          <FlaskConical className="w-8 h-8 animate-pulse text-primary" />
          <p className="text-sm">Loading lab results…</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div role="alert" className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Critical Alert Strip */}
      {!loading && !error && (
      <div className="rounded-[2rem] bg-danger/5 border-2 border-danger/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-danger animate-pulse" />
          <h2 className="text-sm font-black text-danger uppercase tracking-widest">Immediate Attention Required</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.filter(r => r.status === 'Critical').map(r => (
            <div key={r.id} className="bg-content-bg rounded-2xl p-4 flex items-center justify-between border border-danger/20 shadow-card">
              <div>
                <p className="text-[10px] font-black text-danger uppercase tracking-widest mb-1">{r.patient} · {r.ward}</p>
                <p className="text-sm font-bold text-ink">{r.test}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-danger tracking-tighter">{r.value} {r.unit}</p>
                <p className="text-[10px] text-slate-400 font-medium">Ref: {r.range}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Main Content Split */}
      {!loading && !error && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Results List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-4 bg-content-bg p-2 rounded-2xl border border-content-border shadow-card">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
              <input 
                placeholder="Search patient or test..."
                className="w-full bg-content-surface border-none rounded-card pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="bg-content-surface border-none rounded-card px-4 py-2 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 ring-primary/20"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option>All</option>
              <option>Hematology</option>
              <option>Biochemistry</option>
              <option>Microbiology</option>
              <option>Imaging</option>
            </select>
          </div>

          <div className="bg-content-bg rounded-[2.5rem] border border-content-border overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-content-surface border-b border-content-border/50">
                    {['Patient', 'Test', 'Value', 'Status', 'Trends', ''].map(h => (
                      <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(r => (
                    <tr 
                      key={r.id} 
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "hover:bg-primary/5 transition-colors cursor-pointer group",
                        selectedId === r.id && "bg-primary/10"
                      )}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-ink">{r.patient}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{r.ward}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-700">{r.test}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{r.category}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className={cn(
                          "text-base font-black tracking-tighter",
                          r.status === 'Critical' ? "text-danger" :
                          r.status === 'Abnormal' ? "text-warning" : "text-success"
                        )}>
                          {r.value} <span className="text-[10px] font-medium text-slate-400">{r.unit}</span>
                        </p>
                      </td>
                      <td className="px-6 py-4">
                         <span className={cn(
                           "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                           r.status === 'Critical' ? "bg-danger/5 text-danger border-danger/20" :
                           r.status === 'Abnormal' ? "bg-warning/5 text-warning border-warning/20" :
                           "bg-success/5 text-success border-success/20"
                         )}>
                           {r.status}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-end gap-1 h-8 items-center">
                          {r.trends.map((v, i) => {
                            const max = Math.max(...r.trends);
                            const height = (v / max) * 100;
                            return (
                              <div 
                                key={i} 
                                className={cn(
                                  "w-1 rounded-full",
                                  r.status === 'Critical' ? "bg-danger" : "bg-primary"
                                )}
                                style={{ height: `${height}%` }}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-4 space-y-6">
          {selectedResult ? (
            <div className="bg-content-bg rounded-[2.5rem] border border-content-border p-8 shadow-card space-y-8 sticky top-6 animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                   <FlaskConical className="w-7 h-7 text-primary" />
                </div>
                <div className="flex gap-2">
                   <button aria-label="Share" className="p-2 rounded-lg hover:bg-content-surface text-slate-400"><Share2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-ink tracking-tighter">{selectedResult.test}</h3>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">Full Diagnostic Breakdown</p>
              </div>

              <div className="p-6 bg-content-surface rounded-[2rem] border border-content-border/50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Status</span>
                  {selectedResult.trends[selectedResult.trends.length - 1] > selectedResult.trends[0] ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-danger bg-danger/5 px-2 py-1 rounded-lg border border-danger/20">
                      <TrendingUp className="w-3 h-3" /> TRENDING UP
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-black text-success bg-success/5 px-2 py-1 rounded-lg border border-success/20">
                      <TrendingDown className="w-3 h-3" /> IMPROVING
                    </span>
                  )}
                </div>
                <p className="text-4xl font-black text-ink tracking-tighter">
                  {selectedResult.value} <span className="text-sm font-medium text-slate-400">{selectedResult.unit}</span>
                </p>
                <div className="mt-4 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400 uppercase">Hospital Range</span>
                  <span className="text-ink">{selectedResult.range}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Context</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-content-bg border border-content-border rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-black text-ink">COLLECTED</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">13 Apr 2026, 08:15 AM · Phlebotomy</p>
                  </div>
                  <div className="p-4 bg-content-bg border border-content-border rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-3.5 h-3.5 text-warning" />
                      <span className="text-[10px] font-black text-ink">NOTE</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium italic underline decoration-primary/20">Patient presented with fatigue and symptomatic bradycardia.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-content-border/50 flex gap-4">
                 <button className="flex-1 py-3 rounded-2xl bg-ink text-white text-xs font-black uppercase tracking-widest shadow-xl">Notify Clinician</button>
                 <button aria-label="Download results" className="px-5 py-3 rounded-2xl border border-content-border text-slate-400 hover:text-primary transition-colors"><Download className="w-5 h-5"/></button>
              </div>
            </div>
          ) : (
            <div className="h-[400px] rounded-[2.5rem] border-2 border-dashed border-content-border/50 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-content-surface flex items-center justify-center mb-4">
                <FlaskConical className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Selection Required</p>
              <p className="text-xs text-slate-300 font-medium mt-2">Pick a patient result to view active trends and diagnostic breakdown.</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
