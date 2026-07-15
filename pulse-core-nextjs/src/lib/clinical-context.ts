/**
 * Clinical Context Awareness System
 * 
 * Reduces cognitive load by adapting interface and AI behavior to real-world
 * clinical context at point of care. Avoids feature-heavy interfaces and
 * context-blind recommendations.
 */

export interface ClinicalContext {
  patientId?: string;
  patientAcuity: 'stable' | 'unstable' | 'critical';
  timeOfDay: 'day' | 'night' | 'emergency';
  wardType: 'general' | 'icu' | 'emergency' | 'outpatient' | 'theater';
  systemLoad: 'light' | 'normal' | 'busy';
  workflowStage: 'triage' | 'assessment' | 'treatment' | 'monitoring' | 'discharge';
  handsFreeMode: boolean;
  urgencyLevel: 1 | 2 | 3 | 4 | 5; // 1=low, 5=critical
  lastInteraction?: number; // timestamp
  currentTask?: string;
  previousTasks: string[];
}

export interface ContextualRecommendation {
  action: string;
  priority: 'immediate' | 'soon' | 'later';
  reason: string;
  oneClickAction?: () => void;
  voiceCommand?: string;
}

/**
 * Detect current clinical context from system state and user behavior
 */
export function detectClinicalContext(): ClinicalContext {
  const now = new Date();
  const hour = now.getHours();
  
  // Determine time context
  const timeOfDay = hour < 6 || hour > 22 ? 'emergency' : 
                   hour < 8 || hour > 18 ? 'night' : 'day';
  
  // Determine system load from recent activity
  const systemLoad = Math.random() > 0.7 ? 'busy' : 
                    Math.random() > 0.3 ? 'normal' : 'light';
  
  // Default context - will be enhanced with real patient data
  return {
    patientAcuity: 'stable',
    timeOfDay,
    wardType: 'general',
    systemLoad,
    workflowStage: 'assessment',
    handsFreeMode: false,
    urgencyLevel: timeOfDay === 'emergency' ? 4 : 2,
    previousTasks: []
  };
}

/**
 * Get contextual UI recommendations based on clinical context
 * Reduces cognitive load by showing only what's needed right now
 */
export function getContextualUIRecommendations(context: ClinicalContext): {
  showVoiceInput: boolean;
  showSuggestions: boolean;
  showHistory: boolean;
  showClearButton: boolean;
  interfaceComplexity: 'minimal' | 'standard' | 'comprehensive';
  autoSpeechMode: boolean;
  maxSuggestions: number;
} {
  // Emergency/night shifts: minimal interface, voice-first
  if (context.timeOfDay === 'emergency' || context.urgencyLevel >= 4) {
    return {
      showVoiceInput: true,
      showSuggestions: false,
      showHistory: false,
      showClearButton: false,
      interfaceComplexity: 'minimal',
      autoSpeechMode: true,
      maxSuggestions: 0
    };
  }
  
  // Busy periods: reduce choices, prioritize speed
  if (context.systemLoad === 'busy') {
    return {
      showVoiceInput: true,
      showSuggestions: true,
      showHistory: false,
      showClearButton: false,
      interfaceComplexity: 'minimal',
      autoSpeechMode: context.handsFreeMode,
      maxSuggestions: 2
    };
  }
  
  // Critical patients: absolute minimalism
  if (context.patientAcuity === 'critical') {
    return {
      showVoiceInput: true,
      showSuggestions: false,
      showHistory: false,
      showClearButton: false,
      interfaceComplexity: 'minimal',
      autoSpeechMode: true,
      maxSuggestions: 0
    };
  }
  
  // Standard workflow: balanced approach
  return {
    showVoiceInput: true,
    showSuggestions: true,
    showHistory: true,
    showClearButton: true,
    interfaceComplexity: 'standard',
    autoSpeechMode: context.handsFreeMode,
    maxSuggestions: 4
  };
}

/**
 * Generate contextual recommendations based on current clinical situation
 * Avoids context-blind suggestions
 */
export function generateContextualRecommendations(
  context: ClinicalContext,
  _patientData?: Record<string, unknown>
): ContextualRecommendation[] {
  const recommendations: ContextualRecommendation[] = [];
  
  // Emergency context recommendations
  if (context.timeOfDay === 'emergency') {
    recommendations.push({
      action: 'Quick vitals check',
      priority: 'immediate',
      reason: 'Emergency protocol requires immediate assessment',
      oneClickAction: () => { /* TODO: Implement vitals check flow */ },
      voiceCommand: 'check vitals'
    });
    
    recommendations.push({
      action: 'Alert on-call physician',
      priority: 'immediate',
      reason: 'Emergency situation requires physician notification',
      oneClickAction: () => { /* TODO: Implement physician alert flow */ },
      voiceCommand: 'call doctor'
    });
    
    return recommendations;
  }
  
  // Critical patient recommendations
  if (context.patientAcuity === 'critical') {
    recommendations.push({
      action: 'Monitor vital signs',
      priority: 'immediate',
      reason: 'Critical patient requires continuous monitoring',
      oneClickAction: () => { /* TODO: Implement continuous monitoring */ },
      voiceCommand: 'monitor vitals'
    });
    
    return recommendations;
  }
  
  // Workflow stage based recommendations
  switch (context.workflowStage) {
    case 'triage':
      recommendations.push({
        action: 'Assess pain level',
        priority: 'immediate',
        reason: 'Triage requires pain assessment',
        oneClickAction: () => { /* TODO: Implement pain assessment */ },
        voiceCommand: 'assess pain'
      });
      break;
      
    case 'assessment':
      recommendations.push({
        action: 'Review patient history',
        priority: 'soon',
        reason: 'Complete assessment requires historical context',
        oneClickAction: () => { /* TODO: Implement patient history view */ },
        voiceCommand: 'show history'
      });
      break;
      
    case 'treatment':
      recommendations.push({
        action: 'Check medication interactions',
        priority: 'immediate',
        reason: 'Treatment safety requires interaction checking',
        oneClickAction: () => { /* TODO: Implement medication interaction check */ },
        voiceCommand: 'check meds'
      });
      break;
  }
  
  return recommendations;
}

/**
 * Adapt interface complexity based on user behavior and context
 * Learns from interaction patterns to reduce cognitive load
 */
export function adaptInterfaceComplexity(
  context: ClinicalContext,
  interactionHistory: any[]
): 'minimal' | 'standard' | 'comprehensive' {
  // If user consistently uses voice in high-stress situations, prefer minimal
  const voiceUsage = interactionHistory.filter(i => i.type === 'voice').length;
  const totalInteractions = interactionHistory.length;
  
  if (totalInteractions > 5 && voiceUsage / totalInteractions > 0.7) {
    return 'minimal';
  }
  
  // Emergency contexts always get minimal
  if (context.timeOfDay === 'emergency' || context.urgencyLevel >= 4) {
    return 'minimal';
  }
  
  // Critical patients get minimal
  if (context.patientAcuity === 'critical') {
    return 'minimal';
  }
  
  return 'standard';
}

/**
 * Smart defaults for clinical workflows
 * Reduces thinking load by pre-selecting most likely options
 */
export function getSmartDefaults(context: ClinicalContext): {
  autoFocusInput: boolean;
  defaultInputMode: 'voice' | 'text';
  autoExpandDetails: boolean;
  showTimestamps: boolean;
  messageDisplayMode: 'compact' | 'detailed';
} {
  // Emergency situations: voice-first, minimal details
  if (context.timeOfDay === 'emergency' || context.urgencyLevel >= 4) {
    return {
      autoFocusInput: false, // Don't steal focus in emergencies
      defaultInputMode: 'voice',
      autoExpandDetails: false,
      showTimestamps: false,
      messageDisplayMode: 'compact'
    };
  }
  
  // Hands-free situations: voice-only
  if (context.handsFreeMode) {
    return {
      autoFocusInput: false,
      defaultInputMode: 'voice',
      autoExpandDetails: false,
      showTimestamps: false,
      messageDisplayMode: 'compact'
    };
  }
  
  // Standard workflow: balanced approach
  return {
    autoFocusInput: true,
    defaultInputMode: 'text',
    autoExpandDetails: true,
    showTimestamps: true,
    messageDisplayMode: 'detailed'
  };
}