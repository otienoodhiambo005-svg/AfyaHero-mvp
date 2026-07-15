'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Info } from 'lucide-react';

interface LabResultsInterpretationProps {
  labResults?: Record<string, unknown>;
  testName?: string;
  patientAge?: number;
  patientGender?: string;
  patientContext?: string;
}

export default function LabResultsInterpretation({
  labResults,
  testName,
  patientAge,
  patientGender,
  patientContext,
}: LabResultsInterpretationProps) {
  const [interpretation, setInterpretation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInterpret = async () => {
    if (!labResults) {
      setError('Lab results are required for interpretation');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lab/interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labResults,
          testName,
          patientAge,
          patientGender,
          patientContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to interpret lab results');
      }

      const data = await response.json();
      setInterpretation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to interpret lab results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-900">AI Lab Results Interpretation</h2>
        <p className="text-xs text-slate-500 mt-1">
          Get AI-powered clinical interpretation of lab results with recommendations
        </p>
      </div>
      <div className="p-5 space-y-4">
        <button
          onClick={handleInterpret}
          disabled={loading || !labResults}
          className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
              Interpreting...
            </>
          ) : (
            'Interpret Results'
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {interpretation && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                interpretation.confidenceScore >= 0.8 
                  ? 'bg-violet-100 text-violet-700' 
                  : 'bg-slate-100 text-slate-700'
              }`}>
                Confidence: {Math.round((interpretation.confidenceScore || 0) * 100)}%
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {interpretation.provider || 'AI'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <pre className="whitespace-pre-wrap text-xs text-slate-700">{interpretation.interpretation}</pre>
            </div>

            {interpretation.latencyMs && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-3 h-3" />
                <span>Generated in {interpretation.latencyMs}ms</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
