import {
  governanceFlagsFromAnomalyBatch,
  loadAnomalyBatchSignals,
  anomalyAlertCountFromBatch,
} from '@/lib/superadmin/governance-anomalies';

export type ComplianceBand = 'aligned' | 'partial' | 'at_risk' | 'not_assessed';
export type RiskTier = 'low' | 'medium' | 'high' | 'critical';

export interface GovernanceRiskFlag {
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface HospitalGovernanceSummary {
  riskLevel: RiskTier;
  riskFlags: GovernanceRiskFlag[];
  complianceStatus: ComplianceBand;
  complianceImplementedPct: number | null;
  openIncidents: number;
  criticalOpenIncidents: number;
  activeBreaches: number;
  pendingStaff: number;
  sensitiveExports14d: number;
  /** Automated anomaly rules on batch signals (PHI volume, access friction). */
  anomalySignalCount: number;
}

const OPEN_INCIDENT_STATUSES = ['open', 'investigating'] as const;
const BREACH_CLOSED_STATUSES = ['resolved', 'closed'] as const;
const SENSITIVE_AUDIT_SINCE_MS = 14 * 24 * 60 * 60 * 1000;
const PENDING_STAFF_WARN = 3;
const EXPORT_BURST_WARN = 5;

function emptySummary(): HospitalGovernanceSummary {
  return {
    riskLevel: 'low',
    riskFlags: [],
    complianceStatus: 'not_assessed',
    complianceImplementedPct: null,
    openIncidents: 0,
    criticalOpenIncidents: 0,
    activeBreaches: 0,
    pendingStaff: 0,
    sensitiveExports14d: 0,
    anomalySignalCount: 0,
  };
}

function countsToMap(
  rows: { hospitalId: string | null; _count: { _all: number } }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of rows) {
    if (!row.hospitalId) continue;
    m.set(row.hospitalId, row._count._all);
  }
  return m;
}

function complianceFromControlRows(
  rows: { hospitalId: string | null; implementationStatus: string; _count: { _all: number } }[],
  hospitalId: string,
): { band: ComplianceBand; pct: number | null } {
  let total = 0;
  let implemented = 0;
  for (const row of rows) {
    if (row.hospitalId !== hospitalId) continue;
    const c = row._count._all;
    total += c;
    if (row.implementationStatus === 'fully_implemented') implemented += c;
  }
  if (total === 0) return { band: 'not_assessed', pct: null };
  const pct = Math.round((implemented / total) * 1000) / 10;
  let band: ComplianceBand;
  if (pct >= 90) band = 'aligned';
  else if (pct >= 50) band = 'partial';
  else band = 'at_risk';
  return { band, pct };
}

function buildFlags(input: {
  licenseNumber: string | null | undefined;
  email: string | null | undefined;
  isActive: boolean;
  openIncidents: number;
  criticalOpenIncidents: number;
  activeBreaches: number;
  pendingStaff: number;
  sensitiveExports14d: number;
}): GovernanceRiskFlag[] {
  const flags: GovernanceRiskFlag[] = [];
  if (!input.isActive) {
    flags.push({
      id: 'facility_inactive',
      label: 'Facility marked inactive',
      severity: 'warning',
    });
  }
  if (!input.licenseNumber?.trim()) {
    flags.push({
      id: 'missing_license',
      label: 'Regulatory identifier (license / MFL) missing',
      severity: 'warning',
    });
  }
  if (!input.email?.trim()) {
    flags.push({
      id: 'missing_contact_email',
      label: 'Primary facility email missing',
      severity: 'info',
    });
  }
  if (input.activeBreaches > 0) {
    flags.push({
      id: 'active_breach',
      label: `${input.activeBreaches} open breach record(s)`,
      severity: 'critical',
    });
  }
  if (input.criticalOpenIncidents > 0) {
    flags.push({
      id: 'critical_incident',
      label: `${input.criticalOpenIncidents} critical security incident(s) open`,
      severity: 'critical',
    });
  } else if (input.openIncidents > 0) {
    flags.push({
      id: 'open_incidents',
      label: `${input.openIncidents} open security incident(s)`,
      severity: 'warning',
    });
  }
  if (input.pendingStaff >= PENDING_STAFF_WARN) {
    flags.push({
      id: 'pending_staff_backlog',
      label: `${input.pendingStaff} staff account(s) awaiting approval`,
      severity: 'warning',
    });
  }
  if (input.sensitiveExports14d >= EXPORT_BURST_WARN) {
    flags.push({
      id: 'export_activity_burst',
      label: `Elevated export-related audit activity (${input.sensitiveExports14d} in 14d)`,
      severity: 'warning',
    });
  }
  return flags;
}

function riskTierFromFlags(flags: GovernanceRiskFlag[]): RiskTier {
  if (flags.some((f) => f.severity === 'critical')) return 'critical';
  if (flags.some((f) => f.severity === 'warning')) return 'high';
  if (flags.some((f) => f.severity === 'info')) return 'medium';
  return 'low';
}

export async function loadGovernanceSummariesForHospitals(
  prisma: any,
  hospitals: {
    id: string;
    licenseNumber?: string | null;
    email?: string | null;
    isActive: boolean;
  }[],
): Promise<Map<string, HospitalGovernanceSummary>> {
  const result = new Map<string, HospitalGovernanceSummary>();
  if (hospitals.length === 0) return result;

  const ids = hospitals.map((h) => h.id);
  const since = new Date(Date.now() - SENSITIVE_AUDIT_SINCE_MS);

  const [
    incidentGroups,
    criticalIncidents,
    breachGroups,
    pendingStaffGroups,
    exportGroups,
    controlGroups,
    anomalyBatch,
  ] = await Promise.all([
    prisma.securityIncident.groupBy({
      by: ['hospitalId'],
      where: {
        hospitalId: { in: ids },
        status: { in: [...OPEN_INCIDENT_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.securityIncident.findMany({
      where: {
        hospitalId: { in: ids },
        severity: 'critical',
        status: { in: [...OPEN_INCIDENT_STATUSES] },
      },
      select: { hospitalId: true },
    }),
    prisma.dataBreachLog.groupBy({
      by: ['hospitalId'],
      where: {
        hospitalId: { in: ids },
        status: { notIn: [...BREACH_CLOSED_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.profile.groupBy({
      by: ['hospitalId'],
      where: {
        hospitalId: { in: ids },
        status: 'pending',
      },
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ['hospitalId'],
      where: {
        hospitalId: { in: ids },
        createdAt: { gte: since },
        OR: [
          { action: { contains: 'EXPORT', mode: 'insensitive' } },
          { action: { contains: 'export', mode: 'insensitive' } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.securityControl.groupBy({
      by: ['hospitalId', 'implementationStatus'],
      where: { hospitalId: { in: ids } },
      _count: { _all: true },
    }),
    loadAnomalyBatchSignals(prisma, ids),
  ]);

  const openByH = countsToMap(incidentGroups);
  const breachByH = countsToMap(breachGroups);
  const pendingByH = countsToMap(pendingStaffGroups);
  const exportByH = countsToMap(exportGroups);

  const criticalByH = new Map<string, number>();
  for (const row of criticalIncidents) {
    if (!row.hospitalId) continue;
    criticalByH.set(row.hospitalId, (criticalByH.get(row.hospitalId) ?? 0) + 1);
  }

  for (const h of hospitals) {
    const openIncidents = openByH.get(h.id) ?? 0;
    const criticalOpenIncidents = criticalByH.get(h.id) ?? 0;
    const activeBreaches = breachByH.get(h.id) ?? 0;
    const pendingStaff = pendingByH.get(h.id) ?? 0;
    const sensitiveExports14d = exportByH.get(h.id) ?? 0;
    const { band, pct } = complianceFromControlRows(controlGroups, h.id);

    const batchRow = anomalyBatch.get(h.id) ?? { phi7d: 0, accessFriction7d: 0 };
    const riskFlags = [
      ...buildFlags({
        licenseNumber: h.licenseNumber,
        email: h.email,
        isActive: h.isActive,
        openIncidents,
        criticalOpenIncidents,
        activeBreaches,
        pendingStaff,
        sensitiveExports14d,
      }),
      ...governanceFlagsFromAnomalyBatch(batchRow),
    ];

    result.set(h.id, {
      riskLevel: riskTierFromFlags(riskFlags),
      riskFlags,
      complianceStatus: band,
      complianceImplementedPct: pct,
      openIncidents,
      criticalOpenIncidents,
      activeBreaches,
      pendingStaff,
      sensitiveExports14d,
      anomalySignalCount: anomalyAlertCountFromBatch(batchRow),
    });
  }

  return result;
}

export function governanceSummaryOrEmpty(
  map: Map<string, HospitalGovernanceSummary>,
  id: string,
): HospitalGovernanceSummary {
  return map.get(id) ?? emptySummary();
}
