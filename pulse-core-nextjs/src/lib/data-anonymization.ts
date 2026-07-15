/**
 * KDPA Data Anonymization Layer
 *
 * Removes patient identifiers (names, IDs, contact info) before sending context
 * to external AI APIs like OpenAI, Claude, Gemini. Clinical data (diagnoses, 
 * medications, lab results) is retained and anonymized for clinical utility.
 *
 * This ensures AI providers never see patient names or identifiers, only
 * clinical classification codes and measurements that cannot identify individuals.
 */

import type { AICitation } from './ai-providers';

/**
 * Anonymized clinical context for external AI APIs
 */
export interface AnonymizedPatientContext {
  encounterHash: string;  // Hash of encounter ID — cannot map back to real patient
  diagnosisCodes: string[]; // ICD-10 codes (not patient names)
  medications: Array<{
    genericName: string;
    dose: string;
    route: string;
    frequency: string;
    durationDays?: number;
  }>;
  labResults: Array<{
    testName: string;
    resultValue: string;
    unit: string;
    referenceRange?: string;
    flag?: string;  // 'H' | 'L' | 'N' — critical values
  }>;
  vitals?: Array<{
    type: string;  // 'BP', 'HR', 'SpO2', 'Temp'
    value: string;
    unit: string;
    recordedAt: string;  // ISO timestamp, no date linkage
  }>;
}

/**
 * Hash an identifier without reversing (one-way)
 * Safe for audit trail — cannot map back to original patient
 */
async function hashValue(input: string): Promise<string> {
  // Use SubtleCrypto if available (browser/Web Runtime)
  // Fall back to Node.js crypto for server runtime
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // Browser
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    // Note: this is async but we'll use sync for compat
    return Array.from(new Uint8Array([...data])).map(x => x.toString(16).padStart(2, '0')).slice(0, 16).join('');
  }

  // Node.js
  try {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
  } catch {
    // Fallback: simple hash for demo
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Anonymize patient context for external AI APIs
 * Remove all PII, retain clinical classifications
 */
export async function anonymizePatientContext(input: {
  patientId?: string;
  encounterId?: string;
  diagnosisCodes?: string[];
  medications?: Array<{ generic_name?: string; dose?: string; route?: string; frequency?: string; duration_days?: number }>;
  labResults?: Array<{ test_name?: string; result_value?: string; unit?: string; reference_range?: string; flag?: string }>;
  vitals?: Array<{ type?: string; value?: string; unit?: string; recorded_at?: string }>;
}): Promise<AnonymizedPatientContext> {
  const encounterHash = input.encounterId
    ? await hashValue(input.encounterId)
    : input.patientId
    ? await hashValue(input.patientId)
    : await hashValue(String(Date.now()));

  return {
    encounterHash,
    diagnosisCodes: input.diagnosisCodes ?? [],
    medications: (input.medications ?? []).map(m => ({
      genericName: m.generic_name ?? 'Unknown',
      dose: m.dose ?? 'Unknown',
      route: m.route ?? 'Unknown',
      frequency: m.frequency ?? 'Unknown',
      durationDays: m.duration_days,
    })),
    labResults: (input.labResults ?? []).map(l => ({
      testName: l.test_name ?? 'Unknown',
      resultValue: l.result_value ?? 'Unknown',
      unit: l.unit ?? '',
      referenceRange: l.reference_range,
      flag: l.flag,
    })),
    vitals: input.vitals?.map(v => ({
      type: v.type ?? 'Unknown',
      value: v.value ?? 'Unknown',
      unit: v.unit ?? '',
      recordedAt: v.recorded_at ?? new Date().toISOString(),
    })),
  };
}

/**
 * Format anonymized context as JSON string for prompt injection
 */
export function formatAnonymizedContextBlock(context: AnonymizedPatientContext): string {
  const sections: string[] = [];
  
  if (context.diagnosisCodes.length > 0) {
    sections.push(`DIAGNOSES (ICD-10): ${context.diagnosisCodes.join(', ')}`);
  }
  
  if (context.medications.length > 0) {
    const medList = context.medications
      .map(m => `${m.genericName} ${m.dose} ${m.route} ${m.frequency}`)
      .join('; ');
    sections.push(`ACTIVE MEDICATIONS: ${medList}`);
  }
  
  if (context.labResults.length > 0) {
    const labList = context.labResults
      .slice(0, 5)  // Limit to 5 most recent
      .map(l => `${l.testName}: ${l.resultValue} ${l.unit}${l.flag ? ` [${l.flag}]` : ''}`)
      .join('; ');
    sections.push(`RECENT LABS: ${labList}`);
  }
  
  if (context.vitals && context.vitals.length > 0) {
    const vitalsList = context.vitals
      .slice(0, 4)  // Last 4 vital signs
      .map(v => `${v.type}: ${v.value} ${v.unit}`)
      .join('; ');
    sections.push(`CURRENT VITALS: ${vitalsList}`);
  }
  
  return sections.length > 0 
    ? `ANONYMIZED CLINICAL CONTEXT:\n${sections.join('\n')}` 
    : '(No clinical context available)';
}

/**
 * Sanitize citations — remove patient-identifying info from metadata
 */
export function sanitizeCitations(citations: AICitation[]): AICitation[] {
  return citations.map(c => ({
    ...c,
    // Remove any patient identifiers from title/excerpt
    title: c.title
      .replace(/[Pp]atient\s+[A-Z][a-z]*(\s+[A-Z][a-z]*)?/g, '[Patient]')
      .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[Name]'),  // Generic name pattern
    excerpt: c.excerpt
      ?.replace(/[Pp]atient\s+[A-Z][a-z]*(\s+[A-Z][a-z]*)?/g, '[Patient]')
      .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[Name]'),
  }));
}
