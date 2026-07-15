'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Calendar, User, Info, CheckCircle } from 'lucide-react';

interface FollowUpRecommendationsProps {
  patientId?: string;
  diagnosis?: string;
  treatment?: Record<string, unknown>;
  riskFactors?: Record<string, unknown>;
  socialContext?: Record<string, unknown>;
  dischargeCondition?: string;
}

export default function FollowUpRecommendations({
  patientId,
  diagnosis,
  treatment,
  riskFactors,
  socialContext,
  dischargeCondition,
}: FollowUpRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clinical/followup/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          diagnosis,
          treatment,
          riskFactors,
          socialContext,
          dischargeCondition,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate follow-up recommendations');
      }

      const data = await response.json();
      setRecommendations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate follow-up recommendations');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className="w-full rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
        <h2 className="text-sm font-semibold text-ink">Patient Follow-up Recommendations</h2>
        <p className="text-xs text-slate-500 mt-1">
          AI-driven personalized follow-up plans based on risk factors and social context
        </p>
      </div>
      <div className="p-5 space-y-4">
        <button
          onClick={generateRecommendations}
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
              Generating Recommendations...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2 inline" />
              Generate Follow-up Plan
            </>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {recommendations && (
          <div className="space-y-4">
            {/* Readmission Risk */}
            {recommendations.readmissionRisk && (
              <div className={`p-3 rounded-lg border ${getRiskColor(recommendations.readmissionRisk.risk)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Readmission Risk</span>
                  <span className="text-xs font-bold uppercase">{recommendations.readmissionRisk.risk}</span>
                </div>
                <p className="text-xs">Score: {recommendations.readmissionRisk.score}/10</p>
                {recommendations.readmissionRisk.factors && recommendations.readmissionRisk.factors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold mb-1">Risk Factors:</p>
                    <ul className="text-xs space-y-1">
                      {recommendations.readmissionRisk.factors.map((factor: string, i: number) => (
                        <li key={i}>• {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {recommendations.summary && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-content-surface border border-content-border">
                  <div className="text-xs text-slate-500">Urgency</div>
                  <div className="text-sm font-semibold text-ink">{recommendations.summary.urgency}</div>
                </div>
                <div className="p-2 rounded-lg bg-content-surface border border-content-border">
                  <div className="text-xs text-slate-500">CHW Needed</div>
                  <div className="text-sm font-semibold text-ink">{recommendations.summary.requiresCHW ? 'Yes' : 'No'}</div>
                </div>
                <div className="p-2 rounded-lg bg-content-surface border border-content-border">
                  <div className="text-xs text-slate-500">Telehealth</div>
                  <div className="text-sm font-semibold text-ink">{recommendations.summary.telehealthEligible ? 'Yes' : 'No'}</div>
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {recommendations.recommendations && (
              <div className="p-3 rounded-lg border border-violet-200 bg-violet-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-semibold text-ink">AI Recommendations</span>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(recommendations.recommendations, null, 2)}</pre>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <Info className="w-3 h-3" />
              <span>Generated: {recommendations.metadata?.generatedAt || new Date().toISOString()}</span>
              <span>By: {recommendations.metadata?.generatedBy || 'System'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
