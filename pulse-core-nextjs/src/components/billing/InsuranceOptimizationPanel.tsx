'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, FileText, Loader2, Info, TrendingUp, XCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClaimField {
  field: string;
  status: 'complete' | 'incomplete' | 'invalid';
  message: string;
  suggestion?: string;
}

interface ICD10Suggestion {
  code: string;
  description: string;
  confidence: number;
  justification: string;
  specificity: 'high' | 'medium' | 'low';
}

interface ClaimValidation {
  claimId: string;
  completenessScore: number;
  rejectionRisk: 'low' | 'medium' | 'high';
  riskPercentage: number;
  requiredFields: ClaimField[];
  icd10Suggestions: ICD10Suggestion[];
  optimizationTips: string[];
  recommendedActions: string[];
}

interface InsuranceOptimizationPanelProps {
  claimId?: string;
  diagnosis?: string;
  procedures?: string[];
  patientId?: string;
  className?: string;
}

export default function InsuranceOptimizationPanel({
  claimId,
  diagnosis,
  procedures = [],
  patientId,
  className
}: InsuranceOptimizationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ClaimValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateClaim = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/billing/insurance/optimize-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          diagnosis,
          procedures,
          patientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate claim');
      }

      const data = await response.json();
      setValidation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate claim');
      setValidation(null);
    } finally {
      setLoading(false);
    }
  }, [claimId, diagnosis, procedures, patientId]);

  useEffect(() => {
    if (diagnosis || claimId) {
      validateClaim();
    }
  }, [diagnosis, claimId, validateClaim]);

  const generateMockValidation = (): ClaimValidation => {
    return {
      claimId: claimId || 'CLAIM-2024-001',
      completenessScore: 78,
      rejectionRisk: 'medium',
      riskPercentage: 35,
      requiredFields: [
        { field: 'Patient Demographics', status: 'complete', message: 'SHIF member ID and demographics verified' },
        { field: 'SHIF Authorization', status: 'complete', message: 'Valid SHIF authorization number present' },
        { field: 'ICD-10 Coding', status: 'incomplete', message: 'Code lacks specificity for SHIF tariff requirements', suggestion: 'Use SHIF-approved ICD-10 code with laterality' },
        { field: 'Procedure Documentation', status: 'complete', message: 'All procedures mapped to SHIF benefit package' },
        { field: 'Medical Necessity', status: 'incomplete', message: 'SHIF medical necessity justification incomplete', suggestion: 'Add clinical notes per SHIF documentation standards' },
        { field: 'Prior Authorization', status: 'invalid', message: 'SHIF prior authorization missing for Tier 3 procedure', suggestion: 'Obtain SHIF pre-authorization via e-claims portal' },
      ],
      icd10Suggestions: [
        {
          code: 'B54',
          description: 'Malaria, unspecified',
          confidence: 0.92,
          justification: 'SHIF Tier 1 benefit - matches documented malaria diagnosis',
          specificity: 'medium'
        },
        {
          code: 'B50.9',
          description: 'Plasmodium falciparum malaria, unspecified',
          confidence: 0.85,
          justification: 'SHIF Tier 2 benefit - specific for severe malaria cases',
          specificity: 'high'
        },
        {
          code: 'B50.0',
          description: 'Plasmodium falciparum malaria with cerebral complications',
          confidence: 0.78,
          justification: 'SHIF Tier 3 benefit - requires pre-authorization',
          specificity: 'high'
        }
      ],
      optimizationTips: [
        'Add clinical documentation supporting SHIF medical necessity criteria',
        'Include SHIF pre-authorization reference for Tier 2+ procedures',
        'Use SHIF-approved ICD-10 codes from benefit package',
        'Document all comorbidities affecting SHIF benefit eligibility',
        'Include Kenya Medical Practitioners and Dentists Council (KMPDC) provider number'
      ],
      recommendedActions: [
        'Obtain SHIF pre-authorization via e-claims portal before submission',
        'Update ICD-10 code to SHIF-approved specific option',
        'Add medical necessity documentation per SHIF standards',
        'Review claim completeness against SHIF validation rules',
        'Submit claim through SHIF e-claims system with digital signature'
      ]
    };
  };

  const riskColors = {
    low: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    medium: 'bg-amber-50 border-amber-200 text-amber-900',
    high: 'bg-rose-50 border-rose-200 text-rose-900'
  };

  const riskBadge = {
    low: 'bg-emerald-500 text-white',
    medium: 'bg-amber-500 text-white',
    high: 'bg-rose-500 text-white'
  };

  const fieldStatusIcon = {
    complete: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    incomplete: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    invalid: <XCircle className="h-4 w-4 text-rose-600" />
  };

  if (!diagnosis && !claimId) return null;

  return (
    <div className={cn('rounded-2xl border border-content-border bg-content-bg p-5 shadow-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-ink">Insurance Claim Optimization</h3>
            <p className="text-xs text-slate">AI-powered claim validation & coding assistance</p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs text-amber-800 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Fallback
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      {validation && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl border border-content-border bg-content-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-slate" />
                <span className="text-xs text-slate">Completeness Score</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{validation.completenessScore}%</span>
              </div>
            </div>

            <div className="rounded-xl border border-content-border bg-content-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-slate" />
                <span className="text-xs text-slate">Rejection Risk</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{validation.riskPercentage}%</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', riskBadge[validation.rejectionRisk])}>
                  {validation.rejectionRisk}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-content-border bg-content-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-slate" />
                <span className="text-xs text-slate">Fields Complete</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">
                  {validation.requiredFields.filter(f => f.status === 'complete').length}
                </span>
                <span className="text-sm text-slate">of {validation.requiredFields.length}</span>
              </div>
            </div>
          </div>

          {/* Required Fields Validation */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-semibold">Claim Field Validation</span>
            </div>
            <div className="space-y-2">
              {validation.requiredFields.map((field, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border p-3',
                    field.status === 'complete' ? 'bg-emerald-50 border-emerald-200' :
                    field.status === 'incomplete' ? 'bg-amber-50 border-amber-200' :
                    'bg-rose-50 border-rose-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="shrink-0 mt-0.5">{fieldStatusIcon[field.status]}</div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{field.field}</p>
                        <p className="text-sm mt-1">{field.message}</p>
                        {field.suggestion && (
                          <p className="text-xs mt-2 font-medium flex items-start gap-1 text-amber-700">
                            <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
                            {field.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ICD-10 Coding Suggestions */}
          {validation.icd10Suggestions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-semibold">ICD-10 Coding Suggestions</span>
              </div>
              <div className="space-y-2">
                {validation.icd10Suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border p-3 transition-all hover:shadow-md',
                      suggestion.specificity === 'high' ? 'bg-indigo-50 border-indigo-200' :
                      suggestion.specificity === 'medium' ? 'bg-blue-50 border-blue-200' :
                      'bg-slate-50 border-slate-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold">{suggestion.code}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',
                            suggestion.specificity === 'high' ? 'bg-indigo-500 text-white' :
                            suggestion.specificity === 'medium' ? 'bg-blue-500 text-white' :
                            'bg-slate-500 text-white'
                          )}>
                            {suggestion.specificity} specificity
                          </span>
                          <span className="text-xs text-slate">{Math.round(suggestion.confidence * 100)}% confidence</span>
                        </div>
                        <p className="text-sm">{suggestion.description}</p>
                        <p className="text-xs mt-2 text-slate">{suggestion.justification}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimization Tips */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4" />
              <span className="text-sm font-semibold">Optimization Tips</span>
            </div>
            <div className="space-y-2">
              {validation.optimizationTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Recommended Actions Before Submission</span>
            </div>
            <div className="space-y-2">
              {validation.recommendedActions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg bg-white/50 p-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
