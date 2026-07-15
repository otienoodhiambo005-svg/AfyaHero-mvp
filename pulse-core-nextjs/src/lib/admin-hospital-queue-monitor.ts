/** Shared queue monitor semantics for admin queue summary + operational APIs. */

export const ACTIVE_STATUSES = ['waiting', 'called', 'transferred'] as const;
export const IN_SERVICE_STATUSES = ['in_progress'] as const;

export type DeptKey = 'Reception' | 'Medical' | 'Laboratory' | 'Pharmacy' | 'Billing';

export const DEPT_BUCKETS: Array<{
  dept: DeptKey;
  serviceTypes: string[];
  slaTarget: number;
}> = [
  { dept: 'Reception', serviceTypes: ['Triage'], slaTarget: 15 },
  { dept: 'Medical', serviceTypes: ['OPD'], slaTarget: 30 },
  { dept: 'Laboratory', serviceTypes: ['Lab'], slaTarget: 45 },
  { dept: 'Pharmacy', serviceTypes: ['Pharmacy'], slaTarget: 20 },
  { dept: 'Billing', serviceTypes: [], slaTarget: 10 },
];

/** Live wait minutes (same semantics as medical queue). */
export function waitMinutesLive(arrivedAt: Date | null, stored: number): number {
  if (!arrivedAt) return stored;
  const mins = Math.round((Date.now() - arrivedAt.getTime()) / 60_000);
  return Math.max(stored, mins);
}

export type QueueRowLite = {
  serviceType: string;
  status: string;
  waitMinutes: number;
  arrivedAt: Date | null;
};

export function isDeptAtRisk(
  bucket: (typeof DEPT_BUCKETS)[number],
  rows: QueueRowLite[],
): boolean {
  const bucketRows = bucket.serviceTypes.length
    ? rows.filter((r) => bucket.serviceTypes.includes(r.serviceType))
    : [];

  const waits = bucketRows.map((r) => waitMinutesLive(r.arrivedAt, r.waitMinutes));
  const avgWait = waits.length > 0 ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;
  return bucket.slaTarget > 0 && avgWait > bucket.slaTarget * 0.8;
}
