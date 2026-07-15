/**
 * AfyaHero AI Audit Logger
 *
 * Writes a structured record to the Supabase `ai_audit_log` table after
 * every AI provider invocation. In demo / no-Supabase mode it falls back
 * to a console log so the UX is never blocked.
 *
 * Features
 * ─────────
 * • Captures provider, model, latency, success / failure
 * • Truncates input/output to 200 chars — no raw PII stored in the audit row
 * • Stores DAWA persona name for persona-specific reporting
 * • Optional patient_id linkage (when patient context is active)
 * • Admin can query all hospital logs; clinician can query only their own
 *   (enforced by Supabase RLS — see schema-v2.sql)
 *
 * Usage
 * ─────
 * import { logAIInteraction, type AIAuditEntry } from '@/lib/ai-audit';
 *
 * await logAIInteraction({
 *   userRole: session.role,
 *   userSubrole: session.subrole,
 *   userName: session.name,
 *   hospitalId: session.hospitalId,
 *   aiType: 'diagnostic',
 *   providerUsed: 'hf',
 *   modelUsed: 'meta-llama/Llama-3.3-70B-Instruct',
 *   latencyMs: 1234,
 *   success: true,
 *   inputSummary: symptoms.slice(0, 200),
 *   outputSummary: JSON.stringify(results).slice(0, 200),
 * });
 */

import type { ProviderName } from './ai-providers';
import { enqueueJob } from './queue';
import logger from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIAnalysisType =
  | 'diagnostic'
  | 'inventory'
  | 'lab'
  | 'analytics'
  | 'teleconsultation'
  | 'drug_interaction'
  | 'icd10'
  | 'radiology'
  | 'pathology'
  | 'health-feed-validation'
  | 'autonomous_workflow'
  | 'triage'
  | 'imaging'
  | 'formulary_lookup'
  | 'dicom_storage'
  | 'consultation'
  | 'dawa'
  | 'diagnosis'
  | 'documentation'
  | 'lab_interpretation'
  | 'imaging_analysis'
  | 'risk_prediction'
  | 'clinical_query'
  | 'protocol_lookup'
  | 'referral_draft'
  | 'billing_coding'
  | 'population_health'
  | 'mch_care'
  | 'hiv_tb_management';

export type DAWAPersona =
  | 'DAWA-Clinical'
  | 'DAWA-Ward'
  | 'DAWA-Rx'
  | 'DAWA-Lab'
  | 'DAWA-Ops';

export interface AIAuditEntry {
  /** PortalRole from the session cookie */
  userRole: string;
  /** Sub-role e.g. 'doctor' | 'nurse' */
  userSubrole?: string;
  /** Display name from session */
  userName?: string;
  /** UUID of the hospital — undefined in demo mode */
  hospitalId?: string;
  /** UUID of the authenticated user — undefined in demo mode */
  userId?: string;
  /** AI analysis type that was requested */
  aiType: AIAnalysisType;
  /** DAWA persona name (only for analytics type with DAWA routing) */
  dawaPersona?: DAWAPersona;
  /** Winning provider identifier */
  providerUsed: ProviderName;
  /** Exact model string returned by the provider layer */
  modelUsed: string;
  /** Prompt tokens consumed (if available from the provider) */
  promptTokens?: number;
  /** Completion tokens consumed (if available from the provider) */
  completionTokens?: number;
  /** Wall-clock latency in milliseconds */
  latencyMs: number;
  /** Whether the call produced a usable result */
  success: boolean;
  /** Error message if success=false */
  errorMessage?: string;
  /**
   * Truncated (≤200 chars) non-PII summary of the input.
   * Strip dates of birth, SHIF numbers, ID numbers before passing.
   */
  inputSummary?: string;
  /**
   * Truncated (≤200 chars) summary of the AI output (first result or answer).
   */
  outputSummary?: string;
  /** Serialized DAWA write-action payload (for audit trail of DB mutations) */
  actionTaken?: string;
  /** Patient UUID when patient context was injected */
  patientId?: string;
  /** Confidence score (0-1) for the AI output */
  confidenceScore?: number;
  /** Whether the output was flagged for human review */
  requiresReview?: boolean;
  /** Details about consensus if multiple models were used */
  consensusDetails?: {
    agreement: number;
    flaggedForReview: boolean;
  };
}

// ─── Supabase client (server-side, service role) ─────────────────────────────

/**
 * Lazily creates a Supabase admin client using the service role key.
 * This bypasses RLS so we can always INSERT audit rows regardless of
 * the calling user's permissions.
 * Returns null when the required env vars are absent (demo mode).
 */
async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  // Dynamic import so we don't hard-depend on @supabase/supabase-js at import time.
  // The import is cached by Node's module system on subsequent calls.
  try {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

// ─── Sanitize helper ─────────────────────────────────────────────────────────

/** Trims a string to maxLen and removes obvious PII patterns. */
function sanitize(text: string | undefined, maxLen = 200): string {
  if (!text) return '';
  // Redact Kenya National ID / SHIF patterns: 7–8 digit numbers
  const cleaned = text.replace(/\b\d{7,8}\b/g, '[ID]');
  return cleaned.slice(0, maxLen);
}

// ─── Log function ─────────────────────────────────────────────────────────────

/**
 * Fire-and-forget audit log. Errors are caught internally so the calling
 * route handler is never blocked or crashed by a logging failure.
 */
export async function logAIInteraction(entry: AIAuditEntry): Promise<void> {
  const row = {
    hospital_id: entry.hospitalId ?? null,
    user_id: entry.userId ?? null,
    user_role: entry.userRole,
    user_subrole: entry.userSubrole ?? null,
    user_name: entry.userName ?? null,
    ai_type: entry.aiType,
    dawa_persona: entry.dawaPersona ?? null,
    provider_used: entry.providerUsed,
    model_used: entry.modelUsed,
    prompt_tokens: entry.promptTokens ?? null,
    completion_tokens: entry.completionTokens ?? null,
    latency_ms: entry.latencyMs,
    success: entry.success,
    error_message: entry.errorMessage ?? null,
    input_summary: sanitize(entry.inputSummary),
    output_summary: sanitize(entry.outputSummary),
    action_taken: entry.actionTaken ?? null,
    patient_id: entry.patientId ?? null,
    created_at: new Date().toISOString(),
  };

  const supabase = await getSupabaseAdmin();

  if (!supabase) {
    // Demo / no-DB mode — log to logger for local visibility
    logger.info('[AI Audit] Demo mode - audit logged to console', {
      type: row.ai_type,
      provider: row.provider_used,
      model: row.model_used,
      latencyMs: row.latency_ms,
      success: row.success,
      role: row.user_role,
      persona: row.dawa_persona,
    });
    return;
  }

  try {
    await enqueueJob('audit-log', row, {
      priority: 3,
      maxRetries: 3
    });
  } catch (err) {
    // Fallback if queueing fails
    logger.warn('[AI Audit] Queueing failed, attempting direct insert', { error: err });
    try {
      const { error } = await supabase.from('ai_audit_log').insert(row);
      if (error) {
        logger.warn('[AI Audit] Insert failed', { error: error.message });
      }
    } catch (insertErr) {
      logger.warn('[AI Audit] Unexpected error on direct insert', {
        error: insertErr instanceof Error ? insertErr.message : String(insertErr),
      });
    }
  }
}

// ─── Batch helper for diagnostic consensus ───────────────────────────────────

/**
 * Logs audit entries for each provider in a parallel consensus call.
 * Accepts an array of {provider, model, latencyMs, success, error?} objects
 * alongside the shared context (role, type, etc.).
 */
export async function logConsensusInteractions(
  providerResults: Array<{
    provider: ProviderName;
    model: string;
    latencyMs: number;
    success: boolean;
    error?: string;
  }>,
  sharedContext: Omit<
    AIAuditEntry,
    'providerUsed' | 'modelUsed' | 'latencyMs' | 'success' | 'errorMessage'
  >,
): Promise<void> {
  // Fire-and-forget all entries in parallel
  await Promise.allSettled(
    providerResults.map((r) =>
      logAIInteraction({
        ...sharedContext,
        providerUsed: r.provider,
        modelUsed: r.model,
        latencyMs: r.latencyMs,
        success: r.success,
        errorMessage: r.error,
      }),
    ),
  );
}
