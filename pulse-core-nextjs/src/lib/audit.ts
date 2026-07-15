import { supabaseServer, isSupabaseAvailable } from './supabase-server';
import logger from './logger';

export type AuditAction =
  | 'patient.view'
  | 'patient.create'
  | 'patient.update'
  | 'patient.discharge'
  | 'prescription.create'
  | 'prescription.dispense'
  | 'prescription.cancel'
  | 'lab.order'
  | 'lab.collect'
  | 'lab.result'
  | 'lab.verify'
  | 'consultation.start'
  | 'consultation.complete'
  | 'vitals.record'
  | 'checkin.create'
  | 'checkin.update'
  | 'queue.call'
  | 'queue.complete'
  | 'handover.submit'
  | 'handover.acknowledge'
  | 'admin.staff_approve'
  | 'admin.staff_suspend'
  | 'admin.feed_update'
  | 'ai.diagnosis'
  | 'ai.radiology'
  | 'ai.pathology'
  | 'ai.scribe'
  | 'auth.login'
  | 'auth.logout'
  | 'chp_app.patients.list'
  | 'chp_app.visit_note.create'
  | 'chp_app.visit_note.audit';

interface AuditEntry {
  action: AuditAction;
  actor_id?: string;
  actor_email?: string;
  actor_role?: string;
  hospital_id?: string;
  resource_type?: string;
  resource_id?: string;
  detail?: Record<string, unknown>;
  ip_address?: string;
}

/**
 * Log a clinical/admin action to the audit_logs table.
 * Fire-and-forget — never blocks the caller on failure.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  if (!isSupabaseAvailable()) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[audit] Supabase unavailable, logging to console', {
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
      });
    }
    return;
  }

  try {
    await supabaseServer!.from('audit_logs').insert({
      action: entry.action,
      actor_id: entry.actor_id ?? null,
      actor_email: entry.actor_email ?? null,
      actor_role: entry.actor_role ?? null,
      hospital_id: entry.hospital_id ?? null,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      detail: entry.detail ?? null,
      ip_address: entry.ip_address ?? null,
    });
  } catch (err) {
    logger.error('[audit] Failed to write audit log', {
      error: err instanceof Error ? err.message : String(err),
      action: entry.action,
    });
  }
}
