import { useState, useEffect } from 'react';
import {
  detectClinicalContext,
  getContextualUIRecommendations,
  generateContextualRecommendations,
  getSmartDefaults,
  type ClinicalContext,
  type ContextualRecommendation
} from '@/lib/clinical-context';

interface UseClinicalContextReturn {
  clinicalContext: ClinicalContext | null;
  uiRecommendations: ReturnType<typeof getContextualUIRecommendations> | null;
  contextualRecommendations: ContextualRecommendation[];
  smartDefaults: ReturnType<typeof getSmartDefaults> | null;
  isEmergencyMode: boolean;
  isCriticalPatient: boolean;
  isBusyPeriod: boolean;
  refreshContext: () => void;
}

/**
 * Hook to manage clinical context awareness
 * Provides adaptive interface recommendations based on clinical situation
 */
export function useClinicalContext(): UseClinicalContextReturn {
  const [clinicalContext, setClinicalContext] = useState<ClinicalContext | null>(null);
  const [uiRecommendations, setUiRecommendations] = useState<ReturnType<typeof getContextualUIRecommendations> | null>(null);
  const [contextualRecommendations, setContextualRecommendations] = useState<ContextualRecommendation[]>([]);
  const [smartDefaults, setSmartDefaults] = useState<ReturnType<typeof getSmartDefaults> | null>(null);

  const refreshContext = () => {
    const context = detectClinicalContext();
    const recommendations = getContextualUIRecommendations(context);
    const contextualRecs = generateContextualRecommendations(context);
    const defaults = getSmartDefaults(context);
    
    setClinicalContext(context);
    setUiRecommendations(recommendations);
    setContextualRecommendations(contextualRecs);
    setSmartDefaults(defaults);
  };

  useEffect(() => {
    // Defer refresh to avoid synchronous setState in effect
    setTimeout(() => refreshContext(), 0);

    // Refresh context periodically to adapt to changing conditions
    const interval = setInterval(refreshContext, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const isEmergencyMode = clinicalContext ? 
    clinicalContext.timeOfDay === 'emergency' || clinicalContext.urgencyLevel >= 4 : false;
  
  const isCriticalPatient = clinicalContext ? 
    clinicalContext.patientAcuity === 'critical' : false;
  
  const isBusyPeriod = clinicalContext ? 
    clinicalContext.systemLoad === 'busy' : false;

  return {
    clinicalContext,
    uiRecommendations,
    contextualRecommendations,
    smartDefaults,
    isEmergencyMode,
    isCriticalPatient,
    isBusyPeriod,
    refreshContext
  };
}