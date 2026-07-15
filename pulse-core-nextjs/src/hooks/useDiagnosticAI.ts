import { useState } from 'react';
import type { 
  RadiologyResult, 
  PathologyResult, 
  RadiologyScan, 
  PathologyAnalysis 
} from '@/types/clinical_ai';

interface UseDiagnosticAIReturn {
  isAnalyzing: boolean;
  radiologyResult: RadiologyResult | null;
  pathologyResult: PathologyResult | null;
  error: string | null;
  analyzeRadiology: (data: RadiologyScan) => Promise<void>;
  analyzePathology: (data: PathologyAnalysis) => Promise<void>;
  reset: () => void;
}

/**
 * Hook to interface with high-integrity Diagnostic AI endpoints.
 * Provides abstraction for medical scans and specimen analysis.
 */
export function useDiagnosticAI(): UseDiagnosticAIReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [radiologyResult, setRadiologyResult] = useState<RadiologyResult | null>(null);
  const [pathologyResult, setPathologyResult] = useState<PathologyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRadiologyResult(null);
    setPathologyResult(null);
    setError(null);
    setIsAnalyzing(false);
  };

  const analyzeRadiology = async (data: RadiologyScan) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'radiology',
          data,
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze radiology scan');

      const payload = await response.json();
      const result = payload?.results as RadiologyResult;
      setRadiologyResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Radiology analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzePathology = async (data: PathologyAnalysis) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pathology',
          data,
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze pathology specimen');

      const payload = await response.json();
      const result = payload?.results as PathologyResult;
      setPathologyResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pathology analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    isAnalyzing,
    radiologyResult,
    pathologyResult,
    error,
    analyzeRadiology,
    analyzePathology,
    reset,
  };
}
