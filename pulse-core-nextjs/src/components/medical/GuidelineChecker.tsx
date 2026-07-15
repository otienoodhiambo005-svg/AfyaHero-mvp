'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle2, AlertTriangle, XCircle, Loader2, Info, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuidelineCheck {
  guidelineId: string;
  guidelineName: string;
  status: 'compliant' | 'warning' | 'violation';
  message: string;
  recommendation?: string;
  sourceUrl?: string;
  confidence: number;
}

interface GuidelineCheckerProps {
  medication?: string;
  dosage?: string;
  patientAge?: number;
  patientWeight?: number;
  diagnosis?: string;
  allergies?: string[];
  currentMedications?: string[];
  onGuidelineUpdate?: (checks: GuidelineCheck[]) => void;
  className?: string;
}

export default function GuidelineChecker({
  medication,
  dosage,
  patientAge,
  patientWeight,
  diagnosis,
  allergies = [],
  currentMedications = [],
  onGuidelineUpdate,
  className
}: GuidelineCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<GuidelineCheck[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkGuidelines = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/medical/guidelines/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medication,
          dosage,
          patientAge,
          patientWeight,
          diagnosis,
          allergies,
          currentMedications,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check guidelines');
      }

      const data = await response.json();
      setChecks(data.checks || []);
      if (onGuidelineUpdate) {
        onGuidelineUpdate(data.checks || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check guidelines');
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, [medication, dosage, patientAge, patientWeight, diagnosis, allergies, currentMedications, onGuidelineUpdate]);

  useEffect(() => {
    if (medication && (dosage || patientAge || patientWeight)) {
      checkGuidelines();
    } else {
      setChecks([]);
    }
  }, [medication, dosage, patientAge, patientWeight, diagnosis, allergies, currentMedications, checkGuidelines]);

  const ruleBasedGuidelineCheck = (params: {
    medication?: string;
    dosage?: string;
    patientAge?: number;
    patientWeight?: number;
    diagnosis?: string;
    allergies?: string[];
    currentMedications?: string[];
  }): GuidelineCheck[] => {
    const checks: GuidelineCheck[] = [];
    const medLower = params.medication?.toLowerCase() || '';
    const allergiesList = params.allergies || [];
    const currentMedsList = params.currentMedications || [];

    // Pediatric dosing check
    if (params.patientAge && params.patientAge < 18 && medLower.includes('adult')) {
      checks.push({
        guidelineId: 'pediatric-dosing',
        guidelineName: 'Pediatric Dosing Guidelines',
        status: 'violation',
        message: 'Adult formulation prescribed for pediatric patient',
        recommendation: 'Use age-appropriate pediatric formulation and weight-based dosing',
        confidence: 0.95,
      });
    }

    // Allergy check
    if (allergiesList.some(a => medLower.includes(a.toLowerCase()))) {
      checks.push({
        guidelineId: 'allergy-contraindication',
        guidelineName: 'Allergy Contraindication',
        status: 'violation',
        message: `Patient has documented allergy to ${params.medication}`,
        recommendation: 'DO NOT PRESCRIBE - Consider alternative medication class',
        confidence: 0.99,
      });
    }

    // Drug interaction check
    const interactionKeywords = ['warfarin', 'aspirin', 'nsaid', 'ace inhibitor', 'beta blocker'];
    if (currentMedsList.some(m => interactionKeywords.some(kw => m.toLowerCase().includes(kw)))) {
      checks.push({
        guidelineId: 'drug-interaction',
        guidelineName: 'Drug-Drug Interactions',
        status: 'warning',
        message: 'Potential interaction with current medications',
        recommendation: 'Review full interaction profile and consider dose adjustment or alternative',
        confidence: 0.85,
      });
    }

    // Renal/hepatic impairment warning (simplified)
    if (params.diagnosis?.toLowerCase().includes('renal') || params.diagnosis?.toLowerCase().includes('liver')) {
      checks.push({
        guidelineId: 'organ-impairment',
        guidelineName: 'Renal/Hepatic Impairment Dosing',
        status: 'warning',
        message: 'Patient has condition affecting organ function',
        recommendation: 'Consider dose adjustment based on eGFR/hepatic function',
        confidence: 0.75,
      });
    }

    // If no issues found, add compliant check
    if (checks.length === 0) {
      checks.push({
        guidelineId: 'standard-dosing',
        guidelineName: 'Standard Dosing Guidelines',
        status: 'compliant',
        message: 'Prescription follows standard guidelines',
        confidence: 0.90,
      });
    }

    return checks;
  };

  if (!medication) return null;

  const statusColors = {
    compliant: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    violation: 'bg-rose-50 border-rose-200 text-rose-900'
  };

  const statusIcon = {
    compliant: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    violation: <XCircle className="h-4 w-4" />
  };

  const hasViolations = checks.some(c => c.status === 'violation');
  const hasWarnings = checks.some(c => c.status === 'warning');

  return (
    <div className={cn('rounded-card border p-4', hasViolations ? 'border-rose-300 bg-rose-50/50' : hasWarnings ? 'border-amber-300 bg-amber-50/50' : 'border-content-border bg-content-bg', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', hasViolations ? 'bg-rose-100 text-rose-600' : hasWarnings ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold">Clinical Guideline Check</p>
            <p className="text-xs text-slate">{checks.length} guideline(s) reviewed</p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-amber-100 border border-amber-200 px-2 py-1 text-xs text-amber-800 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Fallback
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {checks.map((check, idx) => (
          <div
            key={idx}
            className={cn('rounded-lg border p-3 transition-all', statusColors[check.status])}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <div className="shrink-0 mt-0.5">{statusIcon[check.status]}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{check.guidelineName}</p>
                  <p className="text-sm mt-1">{check.message}</p>
                  {check.recommendation && (
                    <p className="text-xs mt-2 font-medium flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                      {check.recommendation}
                    </p>
                  )}
                  {check.sourceUrl && (
                    <a
                      href={check.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs underline hover:no-underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View guideline
                    </a>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-xs text-slate">
                {Math.round(check.confidence * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
