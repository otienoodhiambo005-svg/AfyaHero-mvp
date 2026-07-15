export interface AIResponseGuardrails {
  disclaimer: string;
  requiresClinicianVerification: boolean;
}

export function createDefaultAIResponseGuardrails(capability: string): AIResponseGuardrails {
  return {
    disclaimer: `${capability.toUpperCase()} output is AI-assisted guidance and must not be used as a sole basis for diagnosis, treatment, or triage decisions.`,
    requiresClinicianVerification: true,
  };
}