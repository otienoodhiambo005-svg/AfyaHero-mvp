
export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface GovernanceAnomalyAlert {
  code: string;
  title: string;
  severity: AnomalySeverity;
  narrative: string;
  windowLabel: string;
  metrics: Record<string, number | string>;
  recommendedAction: string;
  followUpNoteTemplate: string;
  evidenceAudits: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
}

/** Rolling windows for audit-derived anomaly heuristics. */
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MS_14D = 14 * 24 * 60 * 60 * 1000;

const PHI_THRESH_WARNING = 200;
const PHI_THRESH_CRITICAL = 500;
const FRICTION_THRESH_INFO = 8;
const FRICTION_THRESH_WARNING = 20;
const EXPORT_DISTINCT_WARNING = 5;
const EXPORT_EVENTS_MIN = 8;

function exportWhereClause(since: Date) {
  return {
    createdAt: { gte: since },
    OR: [
      { action: { contains: 'EXPORT', mode: 'insensitive' as const } },
      { action: { contains: 'export', mode: 'insensitive' as const } },
    ],
  } as const;
}

function frictionWhereClause(since: Date) {
  return {
    createdAt: { gte: since },
    OR: [
      { action: { contains: 'permission_denied', mode: 'insensitive' as const } },
      { action: { contains: 'PERMISSION', mode: 'insensitive' as const } },
      { action: { contains: 'DENIED', mode: 'insensitive' as const } },
      { action: 'MINIMUM_NECESSARY_CHECK' },
    ],
  } as const;
}

export interface AnomalyBatchRow {
  phi7d: number;
  accessFriction7d: number;
}

/** Lightweight per-facility counts for list cards (platform batch query). */
export async function loadAnomalyBatchSignals(
  prisma: any,
  hospitalIds: string[],
): Promise<Map<string, AnomalyBatchRow>> {
  const out = new Map<string, AnomalyBatchRow>();
  if (hospitalIds.length === 0) return out;

  for (const id of hospitalIds) {
    out.set(id, { phi7d: 0, accessFriction7d: 0 });
  }

  const since7 = new Date(Date.now() - MS_7D);

  const [phiGroups, frictionGroups] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['hospitalId'],
      where: {
        hospitalId: { in: hospitalIds },
        createdAt: { gte: since7 },
        action: { startsWith: 'PHI_ACCESS' },
      },
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ['hospitalId'],
      where: {
        hospitalId: { in: hospitalIds },
        ...frictionWhereClause(since7),
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of phiGroups) {
    if (!row.hospitalId) continue;
    const cur = out.get(row.hospitalId);
    if (cur) cur.phi7d = row._count._all;
  }
  for (const row of frictionGroups) {
    if (!row.hospitalId) continue;
    const cur = out.get(row.hospitalId);
    if (cur) cur.accessFriction7d = row._count._all;
  }

  return out;
}

export function anomalyAlertCountFromBatch(row: AnomalyBatchRow): number {
  let n = 0;
  if (row.phi7d >= PHI_THRESH_CRITICAL || row.phi7d >= PHI_THRESH_WARNING) n += 1;
  if (row.accessFriction7d >= FRICTION_THRESH_INFO) n += 1;
  return n;
}

export function governanceFlagsFromAnomalyBatch(row: AnomalyBatchRow): Array<{
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
}> {
  const flags: Array<{ id: string; label: string; severity: 'info' | 'warning' | 'critical' }> = [];
  if (row.phi7d >= PHI_THRESH_CRITICAL) {
    flags.push({
      id: 'anomaly_phi_surge_critical',
      label: `PHI read volume critically elevated (${row.phi7d} events / 7d)`,
      severity: 'critical',
    });
  } else if (row.phi7d >= PHI_THRESH_WARNING) {
    flags.push({
      id: 'anomaly_phi_surge',
      label: `PHI read volume elevated (${row.phi7d} events / 7d) — review access patterns`,
      severity: 'warning',
    });
  }
  if (row.accessFriction7d >= FRICTION_THRESH_WARNING) {
    flags.push({
      id: 'anomaly_access_friction_high',
      label: `High access-denial / policy friction (${row.accessFriction7d} events / 7d)`,
      severity: 'warning',
    });
  } else if (row.accessFriction7d >= FRICTION_THRESH_INFO) {
    flags.push({
      id: 'anomaly_access_friction',
      label: `Elevated access-denial or minimum-necessary checks (${row.accessFriction7d} / 7d)`,
      severity: 'info',
    });
  }
  return flags;
}

/** Full anomaly evaluation + audit samples for superadmin oversight drill-down. */
export async function loadFacilityAnomalyAlerts(
  prisma: any,
  hospitalId: string,
): Promise<GovernanceAnomalyAlert[]> {
  const since7 = new Date(Date.now() - MS_7D);
  const since14 = new Date(Date.now() - MS_14D);

  const [phi7d, friction7d, exportActors, exportTotal] = await Promise.all([
    prisma.auditLog.count({
      where: {
        hospitalId,
        createdAt: { gte: since7 },
        action: { startsWith: 'PHI_ACCESS' },
      },
    }),
    prisma.auditLog.count({
      where: { hospitalId, ...frictionWhereClause(since7) },
    }),
    prisma.auditLog.groupBy({
      by: ['actorEmail'],
      where: { hospitalId, ...exportWhereClause(since14) },
      _count: { _all: true },
    }),
    prisma.auditLog.count({
      where: { hospitalId, ...exportWhereClause(since14) },
    }),
  ]);

  const distinctExportActors = exportActors.filter((r) => r.actorEmail != null && r.actorEmail !== '').length;

  const alerts: GovernanceAnomalyAlert[] = [];

  const pushPhi = async (severity: AnomalySeverity, title: string, narrative: string) => {
    const evidence = await prisma.auditLog.findMany({
      where: {
        hospitalId,
        createdAt: { gte: since7 },
        action: { startsWith: 'PHI_ACCESS' },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorRole: true,
        createdAt: true,
      },
    });
    alerts.push({
      code: severity === 'critical' ? 'PHI_VOLUME_SURGE_CRITICAL' : 'PHI_VOLUME_SURGE',
      title,
      severity,
      narrative,
      windowLabel: 'Rolling 7 days',
      metrics: { phiEvents7d: phi7d },
      recommendedAction:
        severity === 'critical'
          ? 'Triage with facility security lead within 24h; validate role appropriateness and consider temporary access restrictions for outlier accounts.'
          : 'Spot-check top actors in the evidence list and confirm documented clinical or operational justification.',
      followUpNoteTemplate: `[Governance / anomaly] Facility needs review of PHI access volume (${phi7d} PHI_ACCESS events in 7d). Please confirm minimum-necessary adherence and investigate concentrated access if any single account dominates.`,
      evidenceAudits: evidence.map((e) => ({
        id: e.id,
        action: e.action,
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  };

  if (phi7d >= PHI_THRESH_CRITICAL) {
    await pushPhi(
      'critical',
      'PHI access volume — critical threshold',
      'Automated threshold indicates unusually high PHI read logging for this facility in the past week. This can indicate bulk reporting, integration misconfiguration, or inappropriate browsing.',
    );
  } else if (phi7d >= PHI_THRESH_WARNING) {
    await pushPhi(
      'warning',
      'PHI access volume — elevated',
      'PHI read events exceed the advisory threshold. This is not proof of misuse but warrants supervisory sampling.',
    );
  }

  if (friction7d >= FRICTION_THRESH_INFO) {
    const sev: AnomalySeverity = friction7d >= FRICTION_THRESH_WARNING ? 'warning' : 'info';
    const evidence = await prisma.auditLog.findMany({
      where: { hospitalId, ...frictionWhereClause(since7) },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorRole: true,
        createdAt: true,
      },
    });
    alerts.push({
      code: 'ACCESS_POLICY_FRICTION',
      title: 'Access denials & policy friction',
      severity: sev,
      narrative:
        'Repeated permission denials or minimum-necessary checks may signal training gaps, RBAC drift, or deliberate probing.',
      windowLabel: 'Rolling 7 days',
      metrics: { frictionEvents7d: friction7d },
      recommendedAction:
        'Review denied paths with the facility admin; correlate with onboarding changes or new integrations.',
      followUpNoteTemplate: `[Governance / anomaly] Elevated access friction (${friction7d} denial/min-check related events in 7d). Please review RBAC assignments and recent staff changes.`,
      evidenceAudits: evidence.map((e) => ({
        id: e.id,
        action: e.action,
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  }

  if (distinctExportActors >= EXPORT_DISTINCT_WARNING && exportTotal >= EXPORT_EVENTS_MIN) {
    const evidence = await prisma.auditLog.findMany({
      where: { hospitalId, ...exportWhereClause(since14) },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorRole: true,
        createdAt: true,
      },
    });
    alerts.push({
      code: 'EXPORT_ACTOR_DISPERSION',
      title: 'Export-class activity across many accounts',
      severity: 'warning',
      narrative:
        'Several distinct identities triggered export-related audit entries. Legitimate for large hospitals, but unusual for small teams and can indicate shared credentials or uncontrolled extracts.',
      windowLabel: 'Rolling 14 days',
      metrics: {
        exportEvents14d: exportTotal,
        distinctActors: distinctExportActors,
      },
      recommendedAction:
        'Validate export policy attestation; confirm scheduled reports vs ad-hoc downloads; consider tightening export roles.',
      followUpNoteTemplate: `[Governance / anomaly] Export-related audit events (${exportTotal} in 14d) span ${distinctExportActors} distinct actor emails. Please reconcile with approved reporting roster.`,
      evidenceAudits: evidence.map((e) => ({
        id: e.id,
        action: e.action,
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  }

  const rank: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return alerts;
}
