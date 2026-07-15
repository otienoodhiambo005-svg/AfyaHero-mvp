export type AIExecutionMode = 'local' | 'external';

export interface AICapabilityDefinition {
  capability: string;
  displayName: string;
  supportedExecutionModes: AIExecutionMode[];
  description: string;
}

export const AI_CAPABILITY_REGISTRY: Record<string, AICapabilityDefinition> = {
  dawa: {
    capability: 'dawa',
    displayName: 'DAWA Clinical Assistant',
    supportedExecutionModes: ['local', 'external'],
    description: 'Clinical documentation and decision-support assistance with clinician review required.',
  },
};

export function getAICapabilityDefinition(capability: string): AICapabilityDefinition | null {
  return AI_CAPABILITY_REGISTRY[capability] ?? null;
}