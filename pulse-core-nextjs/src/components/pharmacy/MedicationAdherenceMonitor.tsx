'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Pill, Info, TrendingUp, TrendingDown } from 'lucide-react';

interface MedicationAdherenceMonitorProps {
  patientId?: string;
  medications?: Array<{ name: string; frequency: string; duration?: string }>;
  adherenceHistory?: Record<string, unknown>;
  riskFactors?: Record<string, unknown>;
  socialContext?: Record<string, unknown>;
}

export default function MedicationAdherenceMonitor({
  patientId,
  medications,
  adherenceHistory,
  riskFactors,
  socialContext,
}: MedicationAdherenceMonitorProps) {
  const [adherenceData, setAdherenceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessAdherence = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clinical/medication/adherence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          medications,
          adherenceHistory,
          riskFactors,
          socialContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assess medication adherence');
      }

      const data = await response.json();
      setAdherenceData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assess medication adherence');
    } finally {
      setLoading(false);
    }
  };

  const getAdherenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getAdherenceIcon = (level: string) => {
    switch (level) {
      case 'high': return <TrendingUp className="w-4 h-4" />;
      case 'medium': return <TrendingDown className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-900">Medication Adherence Monitoring</h2>
        <p className="text-xs text-slate-500 mt-1">
          AI-powered assessment of medication adherence risk and support strategies
        </p>
      </div>
      <div className="p-5 space-y-4">
        <button
          onClick={assessAdherence}
          disabled={loading || !medications || medications.length === 0}
          className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
              Assessing Adherence...
            </>
          ) : (
            <>
              <Pill className="w-4 h-4 mr-2 inline" />
              Assess Adherence
            </>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {adherenceData && (
          <div className="space-y-4">
            {/* Adherence Score */}
            <div className={`p-4 rounded-lg border ${getAdherenceColor(adherenceData.adherenceLevel)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Adherence Score</span>
                <span className="text-2xl font-bold">{adherenceData.adherenceScore}%</span>
              </div>
              <div className="flex items-center gap-2">
                {getAdherenceIcon(adherenceData.adherenceLevel)}
                <span className="text-xs font-bold uppercase">{adherenceData.adherenceLevel} Adherence</span>
              </div>
            </div>

            {/* Risk Factors */}
            {adherenceData.riskFactors && adherenceData.riskFactors.length > 0 && (
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-slate-900">Risk Factors</span>
                </div>
                <ul className="text-xs space-y-1">
                  {adherenceData.riskFactors.map((factor: string, i: number) => (
                    <li key={i}>• {factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            {adherenceData.summary && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Follow-up</div>
                  <div className="text-sm font-semibold text-slate-900">{adherenceData.summary.priorityFollowup}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">CHW</div>
                  <div className="text-sm font-semibold text-slate-900">{adherenceData.summary.requiresCHW ? 'Yes' : 'No'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Telehealth</div>
                  <div className="text-sm font-semibold text-slate-900">{adherenceData.summary.telehealthEligible ? 'Yes' : 'No'}</div>
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {adherenceData.recommendations && (
              <div className="p-3 rounded-lg border border-violet-200 bg-violet-50">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-semibold text-slate-900">Recommendations</span>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(adherenceData.recommendations, null, 2)}</pre>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Assessed: {adherenceData.metadata?.assessedAt || new Date().toISOString()}</span>
              <span>By: {adherenceData.metadata?.assessedBy || 'System'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
