import type { Prisma } from '@prisma/client';

/** Audit action written when a super admin marks a compliance event as reviewed. */
export const COMPLIANCE_SUPERADMIN_REVIEW_ACTION = 'COMPLIANCE_SUPERADMIN_REVIEW' as const;

/** Where clause: facility-scoped audit rows that represent elevated compliance risk. */
export function highRiskComplianceAuditWhere(since?: Date): Prisma.AuditLogWhereInput {
  const time: Prisma.AuditLogWhereInput = since ? { createdAt: { gte: since } } : {};
  return {
    ...time,
    hospitalId: { not: null },
    NOT: { action: COMPLIANCE_SUPERADMIN_REVIEW_ACTION },
    OR: [
      { action: { startsWith: 'PHI_ACCESS' } },
      { action: { contains: 'EXPORT', mode: 'insensitive' } },
      { action: { contains: 'BREACH', mode: 'insensitive' } },
      { action: { contains: 'permission_denied', mode: 'insensitive' } },
      { action: { contains: 'PERMISSION_DENIED', mode: 'insensitive' } },
      { action: 'MINIMUM_NECESSARY_CHECK' },
      { action: { contains: 'DENIED', mode: 'insensitive' } },
    ],
  };
}

/** Server-side guard: only logs matching the compliance high-risk heuristic may be “reviewed”. */
export function auditActionLooksHighRiskCompliance(action: string): boolean {
  if (action === COMPLIANCE_SUPERADMIN_REVIEW_ACTION) return false;
  if (action.startsWith('PHI_ACCESS')) return true;
  if (action.includes('EXPORT') || action.includes('export')) return true;
  if (action.includes('BREACH') || action.includes('breach')) return true;
  if (action.toLowerCase().includes('permission_denied')) return true;
  if (action.includes('PERMISSION_DENIED')) return true;
  if (action === 'MINIMUM_NECESSARY_CHECK') return true;
  if (action.includes('DENIED')) return true;
  return false;
}
