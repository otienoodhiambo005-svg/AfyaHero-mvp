/**
 * KDPA Audit Logging — AfyaHero
 *
 * Immutable audit trail for all patient data access, AI queries, and sensitive operations.
 * Stores in Supabase in an append-only, tamper-evident audit_log table.
 * 
 * Required events:
 *   - patient_view       — User accessed a patient record
 *   - patient_export     — Patient data exported/downloaded
 *   - ai_query           — AI-assisted clinical decision made with patient data
 *   - auth_success       — Successful login
 *   - auth_failure       — Failed login attempt
 *   - permission_denied  — User tried accessing data they're not authorized for
 *   - data_modify        — Patient record created/updated/deleted
 *   - session_timeout    — User session expired
 */

import { createClient } from '@supabase/supabase-js';
import type { PortalRole } from '@/types';
import logger from './logger';

export type AuditEventType = 
  | 'patient_view' 
  | 'patient_export' 
  | 'ai_query' 
  | 'auth_success' 
  | 'auth_failure' 
  | 'permission_denied' 
  | 'data_modify' 
  | 'session_timeout'
  | 'ai_consent_change'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | '2fa_attempt'
  | '2fa_backup_attempt'
  | 'login_success'
  | 'login_failed'
  | 'logout';

export interface AuditLogEntry {
  type: AuditEventType;
  userId: string;
  role: PortalRole;
  hospitalId: string;
  patientId?: string;
  description: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  recordedAt: Date;
}

// Server-side only — uses service role for audit table write access
function getAuditClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  
  return createClient(url, key, { 
    auth: { persistSession: false },
    // Audit client bypasses RLS — has direct write to audit_log table
  });
}

/**
 * Log an audit event to Supabase.
 * Fails silently if Supabase unavailable — audit failure should never crash the app.
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const client = getAuditClient();
  if (!client) {
    logger.warn('[Audit] Supabase not configured — audit skipped', {
      eventType: entry.type,
      userId: entry.userId,
    });
    return;
  }

  try {
    const { error } = await client
      .from('audit_log')
      .insert([
        {
          type: entry.type,
          user_id: entry.userId,
          role: entry.role,
          hospital_id: entry.hospitalId,
          patient_id: entry.patientId,
          description: entry.description,
          success: entry.success,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
          metadata: entry.metadata,
          recorded_at: entry.recordedAt,
        },
      ]);

    if (error) {
      logger.warn('[Audit] Failed to log event', {
        error: error.message,
        eventType: entry.type,
      });
    }
  } catch (err) {
    logger.warn('[Audit] Unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      eventType: entry.type,
    });
  }
}

/**
 * Convenience wrappers for common audit events
 */

export async function auditPatientAccess(
  userId: string,
  role: PortalRole,
  hospitalId: string,
  patientId: string,
  ipAddress: string,
  userAgent: string,
) {
  await auditLog({
    type: 'patient_view',
    userId,
    role,
    hospitalId: hospitalId,
    patientId,
    description: `Accessed patient record ${patientId}`,
    success: true,
    ipAddress,
    userAgent,
    recordedAt: new Date(),
  });
}

export async function auditAuthSuccess(
  userId: string,
  role: PortalRole,
  hospitalId: string,
  ipAddress: string,
  userAgent: string,
) {
  await auditLog({
    type: 'auth_success',
    userId,
    role,
    hospitalId: hospitalId,
    description: `User logged in (role: ${role})`,
    success: true,
    ipAddress,
    userAgent,
    recordedAt: new Date(),
  });
}

export async function auditAuthFailure(
  email: string,
  ipAddress: string,
  userAgent: string,
  reason: string,
) {
  await auditLog({
    type: 'auth_failure',
    userId: email,
    role: 'reception',  // Placeholder — failed auth doesn't have role yet
    hospitalId: 'unknown',
    description: `Login attempt failed: ${reason}`,
    success: false,
    ipAddress,
    userAgent,
    recordedAt: new Date(),
  });
}

export async function auditAIQuery(
  userId: string,
  role: PortalRole,
  hospitalId: string,
  patientId: string | undefined,
  provider: string,
  model: string,
  ipAddress: string,
  userAgent: string,
) {
  await auditLog({
    type: 'ai_query',
    userId,
    role,
    hospitalId: hospitalId,
    patientId,
    description: `Generated AI response (${provider}/${model}) ${patientId ? `for patient ${patientId}` : ''}`,
    success: true,
    ipAddress,
    userAgent,
    metadata: { provider, model },
    recordedAt: new Date(),
  });
}

export async function auditPermissionDenied(
  userId: string,
  role: PortalRole,
  hospitalId: string,
  resource: string,
  ipAddress: string,
  userAgent: string,
) {
  await auditLog({
    type: 'permission_denied',
    userId,
    role,
    hospitalId: hospitalId,
    description: `Permission denied: attempted access to ${resource}`,
    success: false,
    ipAddress,
    userAgent,
    recordedAt: new Date(),
  });
}

export async function auditSessionTimeout(
  userId: string,
  role: PortalRole,
  hospitalId: string,
  inactiveMinutes: number,
  ipAddress: string,
  userAgent: string,
) {
  await auditLog({
    type: 'session_timeout',
    userId,
    role,
    hospitalId: hospitalId,
    description: `Session expired after ${inactiveMinutes} minutes of inactivity`,
    success: true,
    ipAddress,
    userAgent,
    metadata: { inactiveMinutes },
    recordedAt: new Date(),
  });
}

export async function auditAIConsentChange(
  userId: string,
  role: PortalRole,
  hospitalId: string,
  useExternalAI: boolean,
  ipAddress: string,
  userAgent: string,
) {
  await auditLog({
    type: 'ai_consent_change',
    userId,
    role,
    hospitalId: hospitalId,
    description: `AI consent preference changed: ${useExternalAI ? 'enabled external AI' : 'disabled external AI (local only)'}`,
    success: true,
    ipAddress,
    userAgent,
    metadata: { useExternalAI },
    recordedAt: new Date(),
  });
}

/**
 * Generic audit function for auth-related events that don't require a specific role.
 * Used for events like login, logout, password reset, etc.
 */
export async function auditAuthEvent(params: {
  type: 'login_success' | 'login_failed' | 'logout' | 'password_reset_requested' | 'password_reset_completed' | '2fa_attempt' | '2fa_backup_attempt';
  userId?: string;
  email?: string;
  role?: string;
  hospitalId?: string;
  ipAddress: string;
  userAgent: string;
  reason?: string;
}) {
  const description = params.type === 'login_success'
    ? `User logged in: ${params.email ?? params.userId ?? 'unknown'}`
    : params.type === 'login_failed'
      ? `Failed login attempt: ${params.email ?? 'unknown'}${params.reason ? ` (${params.reason})` : ''}`
      : params.type === 'logout'
        ? `User logged out: ${params.userId ?? 'unknown'}`
        : params.type === 'password_reset_requested'
          ? `Password reset requested for ${params.email ?? 'unknown'}`
          : params.type === 'password_reset_completed'
            ? `Password reset completed for ${params.email ?? params.userId ?? 'unknown'}`
            : `Auth event: ${params.type}`;

  await auditLog({
    type: params.type,
    userId: params.userId ?? params.email ?? 'unknown',
    role: (params.role ?? 'reception') as PortalRole,
    hospitalId: params.hospitalId ?? 'unknown',
    description,
    success: params.type === 'login_success' || params.type === 'password_reset_completed' || params.type === 'logout',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.reason ? { reason: params.reason } : undefined,
    recordedAt: new Date(),
  });
}
