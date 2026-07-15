export function isRestrictedClinicalQuery(query: string): {
  restricted: boolean;
  category: string | null;
} {
  const lowerQuery = query.toLowerCase();
  
  const restrictedPatterns = [
    { pattern: /\b(what is|diagnose|what does this patient have)\b/i, category: 'diagnosis' },
    { pattern: /\b(should i admit|discharge)\b/i, category: 'disposition_decision' },
  ];

  for (const rule of restrictedPatterns) {
    if (rule.pattern.test(lowerQuery)) {
      return {
        restricted: true,
        category: rule.category
      };
    }
  }

  return {
    restricted: false,
    category: null
  };
}

export interface EpidemiologyGuardrailResult {
  shouldBlock: boolean;
  blockReason?: string;
  workflowOverride?: Array<{ order: number; action: string; mandatory: boolean; deadlineMinutes?: number }>;
  epidemiologyChecked: boolean;
  timestamp: string;
}

export function applyEpidemiologyGuardrails(content: Record<string, unknown> | string, _patientContext?: Record<string, unknown>): EpidemiologyGuardrailResult {
  // Basic implementation for epidemiology guardrails
  const baseResult: EpidemiologyGuardrailResult = {
    shouldBlock: false,
    epidemiologyChecked: true,
    timestamp: new Date().toISOString()
  };

  if (typeof content === 'string') {
    // Check for restricted clinical queries
    const restricted = isRestrictedClinicalQuery(content);
    if (restricted.restricted) {
      return {
        ...baseResult,
        shouldBlock: true,
        blockReason: `Restricted query category: ${restricted.category}. DAWA cannot assist with this type of query.`,
        workflowOverride: [
          { order: 1, action: 'Consult senior clinical staff immediately', mandatory: true },
          { order: 2, action: 'Follow official clinical protocols', mandatory: true, deadlineMinutes: 15 }
        ]
      };
    }
    return baseResult;
  }
  
  if (content && typeof content === 'object') {
    return baseResult;
  }
  
  return baseResult;
}
