/**
 * Clinical Context System - Usage Examples and Patterns
 * 
 * This file demonstrates how to use the clinical context system
 * to create adaptive, low-cognitive-load interfaces for healthcare.
 */

import React from 'react';
import AIConversationPanel from './AIConversationPanel';
import { useClinicalContext } from '@/hooks/useClinicalContext';

/**
 * Example 1: Emergency Department Interface
 * Minimal interface during emergencies to reduce cognitive load
 */
export function EmergencyDepartmentInterface() {
  const { isEmergencyMode: _isEmergencyMode, isBusyPeriod: _isBusyPeriod } = useClinicalContext();
  
  return (
    <div className="h-screen bg-gray-900">
      <AIConversationPanel
        title="Emergency Assistant"
        subtitle="Critical care support"
        suggestionTemplates={[
          'Check vitals',
          'Alert physician',
          'Order labs',
          'Start IV'
        ]}
        // In emergency mode, most features are automatically hidden
        allowVoice={true}
        allowSpeechOutput={true}
        className="h-full"
      />
    </div>
  );
}

/**
 * Example 2: ICU Critical Care Interface
 * Ultra-minimal for critical patients, voice-first
 */
export function ICUCriticalCareInterface() {
  const { isCriticalPatient: _isCriticalPatient } = useClinicalContext();
  
  return (
    <div className="h-screen bg-gray-900">
      <AIConversationPanel
        title="ICU Monitor"
        subtitle="Critical patient support"
        suggestionTemplates={[
          'Monitor vitals',
          'Check ventilator',
          'Review meds',
          'Alert team'
        ]}
        // Critical patients get minimal interface automatically
        allowVoice={true}
        allowSpeechOutput={true}
        className="h-full"
      />
    </div>
  );
}

/**
 * Example 3: General Ward Interface
 * Standard interface for routine care
 */
export function GeneralWardInterface() {
  return (
    <div className="h-screen bg-gray-900">
      <AIConversationPanel
        title="Clinical Assistant"
        subtitle="Patient care support"
        suggestionTemplates={[
          'Review patient history',
          'Check medications',
          'Update chart',
          'Order tests'
        ]}
        // Full interface for routine care
        allowVoice={true}
        allowSpeechOutput={true}
        className="h-full"
      />
    </div>
  );
}

/**
 * Example 4: Night Shift Interface
 * Reduced interface for night shifts when staff is minimal
 */
export function NightShiftInterface() {
  const { clinicalContext } = useClinicalContext();
  
  const isNightShift = clinicalContext?.timeOfDay === 'night';
  
  return (
    <div className="h-screen bg-gray-900">
      <AIConversationPanel
        title="Night Assistant"
        subtitle={isNightShift ? 'After-hours support' : 'Clinical support'}
        suggestionTemplates={[
          'Check emergency protocols',
          'Contact on-call',
          'Review urgent items',
          'Monitor alerts'
        ]}
        // Night shift gets simplified interface
        allowVoice={true}
        allowSpeechOutput={true}
        className="h-full"
      />
    </div>
  );
}

/**
 * Example 5: Hands-Free Operation
 * For situations where hands are occupied (surgery, procedures)
 */
export function HandsFreeInterface() {
  return (
    <div className="h-screen bg-gray-900">
      <AIConversationPanel
        title="Hands-Free Assistant"
        subtitle="Voice-controlled support"
        suggestionTemplates={[
          'Show patient vitals',
          'Check drug interactions',
          'Alert team',
          'Document procedure'
        ]}
        // Voice-first interface
        allowVoice={true}
        allowSpeechOutput={true}
        className="h-full"
      />
    </div>
  );
}

/**
 * Example 6: Custom Clinical Workflow
 * Demonstrates how to customize for specific hospital workflows
 */
export function CustomClinicalWorkflow() {
  const { clinicalContext, contextualRecommendations: _contextualRecommendations } = useClinicalContext();
  
  // Custom logic based on your hospital's specific workflows
  const getCustomSuggestions = () => {
    if (clinicalContext?.wardType === 'theater') {
      return [
        'Pre-op checklist',
        'Anesthesia protocol',
        'Surgical prep',
        'Post-op orders'
      ];
    }
    
    if (clinicalContext?.workflowStage === 'discharge') {
      return [
        'Discharge instructions',
        'Medication reconciliation',
        'Follow-up scheduling',
        'Transport arrangement'
      ];
    }
    
    return [
      'Patient assessment',
      'Care planning',
      'Medication review',
      'Documentation'
    ];
  };
  
  return (
    <div className="h-screen bg-gray-900">
      <AIConversationPanel
        title="Workflow Assistant"
        subtitle="Context-aware clinical support"
        suggestionTemplates={getCustomSuggestions()}
        allowVoice={true}
        allowSpeechOutput={true}
        className="h-full"
      />
    </div>
  );
}

/**
 * Usage Patterns and Best Practices:
 * 
 * 1. EMERGENCY PROTOCOLS:
 *    - Interface automatically minimizes during emergencies
 *    - Voice commands prioritized over text input
 *    - Critical actions surfaced as one-click buttons
 *    - Visual alerts for emergency status
 * 
 * 2. COGNITIVE LOAD REDUCTION:
 *    - Features hidden when not needed
 *    - Smart defaults based on context
 *    - Reduced decision-making burden
 *    - Context-aware suggestions
 * 
 * 3. NON-LINEAR WORKFLOWS:
 *    - No enforced conversation sequences
 *    - Jump between tasks naturally
 *    - Context preserved across interactions
 *    - Support for interrupted workflows
 * 
 * 4. VOICE-FIRST OPERATION:
 *    - Hands-free modes for occupied hands
 *    - Emergency voice commands
 *    - Natural language processing
 *    - Speech output for busy environments
 * 
 * 5. CONTEXT AWARENESS:
 *    - Time of day affects interface complexity
 *    - Patient acuity drives feature visibility
 *    - System load impacts suggestion priority
 *    - Workflow stage determines available actions
 */