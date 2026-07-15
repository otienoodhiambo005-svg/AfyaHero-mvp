'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Activity, Heart, Baby, Info } from 'lucide-react';

interface DeteriorationRiskDisplayProps {
  patientId?: string;
  vitals?: Record<string, number>;
  consciousness?: string;
  age?: number;
  gender?: string;
  isPregnant?: boolean;
  gestationalWeeks?: number;
}

export default function DeteriorationRiskDisplay({
  patientId,
  vitals,
  consciousness,
  age,
  gender,
  isPregnant,
  gestationalWeeks,
}: DeteriorationRiskDisplayProps) {
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessRisk = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clinical/deterioration-risk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          context: {
            age,
            gender,
            consciousness,
            isPregnant,
            gestationalWeeks,
          },
          vitals,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assess deterioration risk');
      }

      const data = await response.json();
      setRiskData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assess deterioration risk');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-amber-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-emerald-600';
    }
  };

  const getRiskBgColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'high': return 'bg-amber-50 border-amber-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className="w-full rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
        <h2 className="text-sm font-semibold text-ink">Patient Deterioration Risk Assessment</h2>
        <p className="text-xs text-slate-500 mt-1">
          AI-enhanced risk scoring for sepsis, pediatric, and maternal deterioration
        </p>
      </div>
      <div className="p-5 space-y-4">
        <button
          onClick={assessRisk}
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
              Assessing Risk...
            </>
          ) : (
            'Assess Risk'
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {riskData && (
          <div className="space-y-4">
            {/* Overall Risk */}
            <div className={`p-4 rounded-lg border ${getRiskBgColor(riskData.overallRisk)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-ink">Overall Risk</span>
                <span className={`text-xs font-bold uppercase ${getRiskColor(riskData.overallRisk)}`}>
                  {riskData.overallRisk}
                </span>
              </div>
              {riskData.requiresImmediateAction && (
                <div className="flex items-center gap-2 text-xs text-red-700 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Requires Immediate Action
                </div>
              )}
            </div>

            {/* Risk Breakdown */}
            {riskData.risks && (
              <div className="space-y-3">
                {riskData.risks.sepsis && (
                  <div className="p-3 rounded-lg border border-content-border bg-content-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-ink">Sepsis Risk</span>
                      <span className={`ml-auto text-xs font-bold ${getRiskColor(riskData.risks.sepsis.risk)}`}>
                        {riskData.risks.sepsis.risk}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Score: {riskData.risks.sepsis.score}</p>
                    {riskData.risks.sepsis.recommendations && (
                      <ul className="text-xs text-slate-600 mt-2 space-y-1">
                        {riskData.risks.sepsis.recommendations.slice(0, 2).map((rec: string, i: number) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {riskData.risks.pediatric && (
                  <div className="p-3 rounded-lg border border-content-border bg-content-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <Baby className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-ink">Pediatric Risk</span>
                      <span className={`ml-auto text-xs font-bold ${getRiskColor(riskData.risks.pediatric.risk)}`}>
                        {riskData.risks.pediatric.risk}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">PEWS Score: {riskData.risks.pediatric.score}</p>
                  </div>
                )}

                {riskData.risks.maternal && (
                  <div className="p-3 rounded-lg border border-content-border bg-content-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-ink">Maternal Risk</span>
                      <span className={`ml-auto text-xs font-bold ${getRiskColor(riskData.risks.maternal.risk)}`}>
                        {riskData.risks.maternal.risk}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Score: {riskData.risks.maternal.score}</p>
                  </div>
                )}
              </div>
            )}

            {/* AI Insights */}
            {riskData.aiInsights && riskData.aiInsights.length > 0 && (
              <div className="p-3 rounded-lg border border-violet-200 bg-violet-50">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-medium text-ink">AI Insights</span>
                </div>
                <ul className="text-xs text-slate-700 space-y-1">
                  {riskData.aiInsights.slice(0, 3).map((insight: string, i: number) => (
                    <li key={i}>• {insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Assessed: {riskData.metadata?.assessedAt || new Date().toISOString()}</span>
              <span>By: {riskData.metadata?.assessedBy || 'System'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
