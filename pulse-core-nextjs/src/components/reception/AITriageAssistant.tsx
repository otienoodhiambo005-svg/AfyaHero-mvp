'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, AlertTriangle, Activity, TrendingUp, Loader2, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TriageSuggestion {
  suggestedPriority: 'Normal' | 'Urgent' | 'Critical';
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  recommendedActions: string[];
  vitalSignsNeeded: string[];
  priorityLevel?: number; // 1-5 from existing API
  priorityLabel?: string;
}

interface AITriageAssistantProps {
  chiefComplaint: string;
  patientAge?: number;
  patientGender?: string;
  onSuggestion?: (suggestion: TriageSuggestion) => void;
  className?: string;
}

export default function AITriageAssistant({
  chiefComplaint,
  patientAge,
  patientGender,
  onSuggestion,
  className
}: AITriageAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const analyzeComplaint = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use existing API with required fields
      const response = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientAge: patientAge || 30, // Default if not provided
          patientGender: (patientGender === 'M' || patientGender === 'male') ? 'male' : 'female',
          chiefComplaint: chiefComplaint,
          vitals: {
            bloodPressure: { systolic: 120, diastolic: 80 },
            heartRate: 72,
            temperature: 37,
            respiratoryRate: 16,
            oxygenSaturation: 98
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze complaint');
      }

      const data = await response.json();
      setSuggestion(data);
      if (onSuggestion) {
        onSuggestion(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze complaint');
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  }, [chiefComplaint, patientAge, patientGender, onSuggestion]);

  useEffect(() => {
    if (chiefComplaint && chiefComplaint.length >= 10) {
      analyzeComplaint();
    } else {
      setSuggestion(null);
      setError(null);
    }
  }, [chiefComplaint, patientAge, patientGender, analyzeComplaint]);

  const convertPriorityLevel = (priority: number): 'Normal' | 'Urgent' | 'Critical' => {
    if (priority <= 2) return 'Critical';
    if (priority <= 3) return 'Urgent';
    return 'Normal';
  };

  // Rule-based fallback triage logic
  const ruleBasedTriage = (complaint: string): TriageSuggestion => {
    const lowerComplaint = complaint.toLowerCase();
    
    // Critical indicators
    const criticalKeywords = [
      'chest pain', 'heart attack', 'stroke', 'seizure', 'unconscious',
      'difficulty breathing', 'shortness of breath', 'severe bleeding',
      'head injury', 'spinal injury', 'anaphylaxis', 'allergic reaction',
      'severe dehydration', 'lethargy', 'not responding', 'coma'
    ];
    
    // Urgent indicators
    const urgentKeywords = [
      'fever', 'high blood pressure', 'hypertensive', 'diabetic',
      'broken bone', 'fracture', 'deep cut', 'burn', 'vomiting',
      'diarrhea', 'abdominal pain', 'severe pain', 'malaria',
      'preeclampsia', 'pregnancy', 'labor', 'contractions'
    ];

    const hasCritical = criticalKeywords.some(kw => lowerComplaint.includes(kw));
    const hasUrgent = urgentKeywords.some(kw => lowerComplaint.includes(kw));

    if (hasCritical) {
      return {
        suggestedPriority: 'Critical',
        confidence: 0.85,
        reasoning: 'Chief complaint contains critical symptoms requiring immediate attention',
        riskFactors: ['Potential life-threatening condition', 'Requires immediate medical intervention'],
        recommendedActions: ['Immediate vitals assessment', 'Prepare emergency response', 'Alert clinical team'],
        vitalSignsNeeded: ['Blood Pressure', 'Heart Rate', 'Oxygen Saturation', 'Temperature', 'Respiratory Rate']
      };
    }

    if (hasUrgent) {
      return {
        suggestedPriority: 'Urgent',
        confidence: 0.75,
        reasoning: 'Chief complaint indicates urgent medical attention needed',
        riskFactors: ['Condition may deteriorate without treatment', 'Requires timely assessment'],
        recommendedActions: ['Vitals within 15 minutes', 'Clinical assessment within 30 minutes'],
        vitalSignsNeeded: ['Blood Pressure', 'Heart Rate', 'Temperature']
      };
    }

    return {
      suggestedPriority: 'Normal',
      confidence: 0.70,
      reasoning: 'Chief complaint suggests non-emergency presentation',
      riskFactors: ['Low immediate risk', 'Routine assessment appropriate'],
      recommendedActions: ['Standard triage workflow', 'Vitals within 30 minutes'],
      vitalSignsNeeded: ['Blood Pressure', 'Heart Rate', 'Temperature']
    };
  };

  if (!chiefComplaint || chiefComplaint.length < 10) {
    return null;
  }

  const priorityColors = {
    Critical: 'bg-rose-50 border-rose-200 text-rose-900',
    Urgent: 'bg-amber-50 border-amber-200 text-amber-900',
    Normal: 'bg-emerald-50 border-emerald-200 text-emerald-900'
  };

  const priorityBadgeColors = {
    Critical: 'bg-rose-500 text-white',
    Urgent: 'bg-amber-500 text-white',
    Normal: 'bg-emerald-500 text-white'
  };

  return (
    <div className={cn('rounded-2xl border p-4 transition-all', priorityColors[suggestion?.suggestedPriority || 'Normal'], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/50">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Brain className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">AI Triage Suggestion</span>
              {suggestion && (
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', priorityBadgeColors[suggestion.suggestedPriority])}>
                  {suggestion.suggestedPriority}
                </span>
              )}
              {suggestion && (
                <span className="text-xs text-gray-600">
                  {Math.round(suggestion.confidence * 100)}% confidence
                </span>
              )}
            </div>
            {error && (
              <p className="text-sm text-gray-700">{error}</p>
            )}
            {suggestion && !expanded && (
              <p className="text-sm text-gray-700 mt-1">{suggestion.reasoning}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded-lg p-1.5 hover:bg-white/50 transition-colors"
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>

      {expanded && suggestion && (
        <div className="mt-4 space-y-4 pt-4 border-t border-current/20">
          {/* Risk Factors */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">Risk Factors</span>
            </div>
            <ul className="space-y-1">
              {suggestion.riskFactors.map((factor, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-current/60 shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Actions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-semibold">Recommended Actions</span>
            </div>
            <ul className="space-y-1">
              {suggestion.recommendedActions.map((action, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* Vital Signs Needed */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">Vital Signs Required</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestion.vitalSignsNeeded.map((vital, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-current/30 bg-white/50 px-3 py-1 text-xs font-medium"
                >
                  {vital}
                </span>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg bg-white/30 p-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700">
              This is an AI-powered suggestion based on the chief complaint. Clinical judgment should always override automated recommendations. This does not replace professional medical assessment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
