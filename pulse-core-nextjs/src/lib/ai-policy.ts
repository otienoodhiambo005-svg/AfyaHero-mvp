export type AIConsentMode = 'pending' | 'local_only' | 'external_anonymized';

export interface AIPolicyEvaluation {
  consentMode: AIConsentMode;
  allowsLocal: boolean;
  allowsExternal: boolean;
  requiresAnonymization: boolean;
  reason: string;
}

export interface AIPolicyInput {
  consentMode?: string | null;
  hasSensitiveData?: boolean;
}

export const DEFAULT_AI_CONSENT_MODE: AIConsentMode = 'pending';

export function normalizeAIConsentMode(consentMode?: string | null): AIConsentMode {
  if (consentMode === 'local_only' || consentMode === 'external_anonymized' || consentMode === 'pending') {
    return consentMode;
  }

  return DEFAULT_AI_CONSENT_MODE;
}

export function evaluateAIPolicy(input: AIPolicyInput): AIPolicyEvaluation {
  const consentMode = normalizeAIConsentMode(input.consentMode);

  switch (consentMode) {
    case 'local_only':
      return {
        consentMode,
        allowsLocal: true,
        allowsExternal: false,
        requiresAnonymization: false,
        reason: 'AI use is restricted to local or on-premise processing only.',
      };
    case 'external_anonymized':
      return {
        consentMode,
        allowsLocal: true,
        allowsExternal: true,
        requiresAnonymization: Boolean(input.hasSensitiveData ?? true),
        reason: 'External AI is permitted only for anonymized data.',
      };
    case 'pending':
    default:
      return {
        consentMode: 'pending',
        allowsLocal: true,
        allowsExternal: false,
        requiresAnonymization: false,
        reason: 'Explicit AI consent is still pending. External AI is blocked until consent is recorded.',
      };
  }
}

export function canUseExternalAI(input: AIPolicyInput): boolean {
  return evaluateAIPolicy(input).allowsExternal;
}

export function requiresExternalAnonymization(input: AIPolicyInput): boolean {
  return evaluateAIPolicy(input).requiresAnonymization;
}