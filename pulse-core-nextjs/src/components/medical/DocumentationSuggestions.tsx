'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, FileText, Info, Sparkles } from 'lucide-react';

interface DocumentationSuggestionsProps {
  documentType?: 'soap_note' | 'discharge_summary' | 'progress_note' | 'icd10_codes';
  patientContext?: Record<string, unknown>;
  partialContent?: string;
  suggestionsFor?: 'completion' | 'structure' | 'terminology' | 'codes';
}

export default function DocumentationSuggestions({
  documentType = 'soap_note',
  patientContext,
  partialContent,
  suggestionsFor = 'completion',
}: DocumentationSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clinical/documentation/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          patientContext,
          partialContent,
          suggestionsFor,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate documentation suggestions');
      }

      const data = await response.json();
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate documentation suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
        <h2 className="text-sm font-semibold text-ink">AI Documentation Suggestions</h2>
        <p className="text-xs text-slate-500 mt-1">
          AI-powered assistance for clinical documentation, coding, and terminology
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <select
            value={documentType}
            onChange={(e) => {
              // In a real implementation, this would update the documentType state
              // For now, it's just a visual selector
            }}
            className="px-3 py-2 rounded-lg border border-content-border text-sm focus:outline-none focus:border-violet-500/50"
          >
            <option value="soap_note">SOAP Note</option>
            <option value="discharge_summary">Discharge Summary</option>
            <option value="progress_note">Progress Note</option>
            <option value="icd10_codes">ICD-10 Codes</option>
          </select>
          <button
            onClick={generateSuggestions}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2 inline" />
                Generate Suggestions
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {suggestions && (
          <div className="space-y-4">
            {documentType === 'icd10_codes' && suggestions.suggestions?.codes ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-semibold text-ink">ICD-10 Code Suggestions</span>
                </div>
                {suggestions.suggestions.codes.map((code: any, index: number) => (
                  <div key={index} className="p-3 rounded-lg border border-content-border bg-content-surface">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-violet-600">{code.code}</span>
                      <span className="text-xs text-slate-600">{code.confidence ? `Confidence: ${Math.round(code.confidence * 100)}%` : ''}</span>
                    </div>
                    <p className="text-xs text-slate-700">{code.description}</p>
                  </div>
                ))}
              </div>
            ) : suggestions.suggestions ? (
              <div className="p-4 rounded-lg border border-content-border bg-content-surface">
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(suggestions.suggestions, null, 2)}</pre>
              </div>
            ) : suggestions.text && (
              <div className="p-4 rounded-lg border border-content-border bg-content-surface">
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{suggestions.text}</pre>
              </div>
            )}

            {suggestions.metadata && (
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <Info className="w-3 h-3" />
                <span>Generated: {suggestions.metadata.generatedAt || new Date().toISOString()}</span>
                <span>Model: {suggestions.metadata.model || 'AI'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
