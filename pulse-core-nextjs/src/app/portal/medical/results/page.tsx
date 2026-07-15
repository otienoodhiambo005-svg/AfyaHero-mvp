'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BrainCircuit, ShieldCheck, Zap, Loader2, AlertTriangle } from 'lucide-react';
import { DiagnosticViewer } from '@/components/portal/DiagnosticViewer';
import { useDiagnosticAI } from '@/hooks/useDiagnosticAI';

interface ResultValue {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'CRITICAL' | 'HIGH' | 'LOW' | 'NORMAL';
  previous?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface LabResult {
  id: string;
  patient: string;
  pid: string;
  test: string;
  status: 'Critical' | 'Ready' | 'In Progress';
  collectedAt: string;
  receivedAt: string;
  resultedAt?: string;
  values: ResultValue[];
  insight?: {
    confidence: number;
    summary: string;
    priority: 'high' | 'normal';
  };
}

type ResultsApiPayload = {
  results?: LabResult[];
  error?: string;
};

export default function MedicalResultsPage() {
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<LabResult | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const { isAnalyzing, analyzePathology, pathologyResult, reset, error: pathologyError } = useDiagnosticAI();

  const loadResults = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/medical/results', { cache: 'no-store', credentials: 'same-origin' });
      const data = (await response.json()) as ResultsApiPayload;
      if (!response.ok) {
        setLoadError(typeof data.error === 'string' ? data.error : 'Unable to load lab results.');
        return;
      }
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setLoadError('Network error while loading results. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const handleInsightClick = async (result: LabResult) => {
    setActiveResult(result);
    setDiagOpen(true);
    await analyzePathology({
      specimen_id: result.id,
      description: `Lab Result Analysis for ${result.test}: ${result.values.map((v) => `${v.name}=${v.value}`).join(', ')}`,
    });
  };

  const retryPathology = useCallback(() => {
    if (!activeResult) return;
    void analyzePathology({
      specimen_id: activeResult.id,
      description: `Lab Result Analysis for ${activeResult.test}: ${activeResult.values.map((v) => `${v.name}=${v.value}`).join(', ')}`,
    });
  }, [activeResult, analyzePathology]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">Lab & Imaging Results</h1>
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Updating…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-portal-primary/10 rounded-full border border-portal-primary/20">
          <ShieldCheck className="w-4 h-4 text-portal-primary" />
          <span className="text-[10px] font-black uppercase text-portal-primary tracking-widest">AfyaInsight™ Active</span>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadResults()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-content-bg border border-rose-200 text-rose-800 text-xs font-medium hover:bg-rose-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600 rounded-card bg-content-bg border border-content-border shadow-card">
          <Loader2 className="w-8 h-8 animate-spin text-portal-primary" aria-hidden />
          <p className="text-sm">Loading lab results…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="rounded-card bg-content-bg border border-content-border px-5 py-12 text-center text-sm text-slate-600 shadow-card">
              No resulted labs yet for your facility. Completed or verified tests with entered values will appear here.
            </div>
          ) : (
            results.map((result) => (
              <div
                key={result.id}
                className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card hover:border-portal-primary/30 transition-all group"
              >
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{result.test}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {result.patient} • {result.pid}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Collected {result.collectedAt} · Received {result.receivedAt}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Resulted: {result.resultedAt || 'Processing...'}</p>
                  </div>

                  {result.insight && (
                    <button
                      type="button"
                      onClick={() => void handleInsightClick(result)}
                      className={cn(
                        'flex flex-col items-end gap-1 px-4 py-2 rounded-2xl border transition-all active:scale-95',
                        result.insight.priority === 'high'
                          ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                          : 'bg-portal-primary/5 border-portal-primary/20 hover:bg-portal-primary/10',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[10px] font-black uppercase tracking-tighter',
                            result.insight.priority === 'high' ? 'text-red-600' : 'text-portal-primary',
                          )}
                        >
                          AfyaInsight™
                        </span>
                        {result.insight.priority === 'high' ? (
                          <Zap className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                        ) : (
                          <BrainCircuit className="w-3.5 h-3.5 text-portal-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full',
                              result.insight.priority === 'high' ? 'bg-red-500' : 'bg-portal-primary',
                            )}
                            style={{ width: `${result.insight.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 font-mono">
                          {Math.round(result.insight.confidence * 100)}%
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <DiagnosticViewer
        open={diagOpen}
        onClose={() => {
          setDiagOpen(false);
          reset();
        }}
        type="pathology"
        result={pathologyResult}
        isAnalyzing={isAnalyzing}
        patientName={activeResult?.patient || ''}
        error={pathologyError}
        onRetry={activeResult ? retryPathology : undefined}
      />
    </div>
  );
}
