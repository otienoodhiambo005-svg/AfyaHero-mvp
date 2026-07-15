/**
 * Admin data access — Prisma for wards/beds, Supabase for staff counts, mock fallback for demo.
 * Used by: /portal/admin
 */
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { supabaseServer, isSupabaseAvailable } from '../supabase-server';
import { isDatabaseAvailable } from './handover';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import { DataSourceUnavailableError } from './errors';

export interface WardRow {
  name: string;
  total: number;
  occupied: number;
  doctor: string;
}

export interface AlertRow {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  time: string;
}

const MOCK_WARDS: WardRow[] = [
  { name: 'General Ward', total: 24, occupied: 20, doctor: 'Dr. Njoroge' },
  { name: 'ICU', total: 8, occupied: 8, doctor: 'Dr. Amina Osei' },
  { name: 'Maternity', total: 20, occupied: 19, doctor: 'Dr. Waweru' },
  { name: 'Paediatric', total: 16, occupied: 12, doctor: 'Dr. Kipchoge' },
  { name: 'Surgical', total: 12, occupied: 7, doctor: 'Dr. Hassan' },
  { name: 'Emergency', total: 8, occupied: 8, doctor: 'Dr. Abuya' },
];

const MOCK_ALERTS: AlertRow[] = [
  { id: '1', severity: 'critical', message: 'ICU at full capacity — 3 patients on waiting list', time: '2 min ago' },
  { id: '2', severity: 'warning', message: 'Night shift: 2 nurses needed for General Ward', time: '15 min ago' },
  { id: '3', severity: 'info', message: 'Insurance claim KES 42,000 submitted to SHIF', time: '30 min ago' },
  { id: '4', severity: 'info', message: 'Bed 14-B available after discharge (General Ward)', time: '1 hr ago' },
  { id: '5', severity: 'warning', message: 'Maternity at 95% capacity — consider diversion protocol', time: '2 hr ago' },
];

export async function getWards(hospitalId?: string): Promise<WardRow[]> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for ward data in strict production mode.',
      );
    }
    return MOCK_WARDS;
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('hospitalId is required for ward data in strict production mode.');
    }
    return MOCK_WARDS;
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const beds = await tenant.hospitalBed.findMany({
      orderBy: { wardName: 'asc' },
    });

    const wardMap = new Map<string, { total: number; occupied: number; doctor: string }>();
    for (const bed of beds) {
      const wardName = bed.wardName || 'Unassigned';
      const existing = wardMap.get(wardName) ?? { total: 0, occupied: 0, doctor: 'Unassigned' };
      existing.total += 1;
      if (bed.status === 'occupied') {
        existing.occupied += 1;
      }
      wardMap.set(wardName, existing);
    }

    if (wardMap.size === 0) {
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No ward bed data returned from database in strict production mode.');
      }
      return MOCK_WARDS;
    }

    return Array.from(wardMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      occupied: data.occupied,
      doctor: data.doctor,
    }));
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      throw error;
    }
    logger.warn('Prisma ward aggregation failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Ward bed query failed in strict production mode.');
    }
    return MOCK_WARDS;
  }
}

function relativeTime(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export async function getAlerts(hospitalId?: string): Promise<AlertRow[]> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const [incidents, beds] = await Promise.all([
        tenant.securityIncident.findMany({
          where: { status: { in: ['open', 'investigating'] } },
          orderBy: { detectedAt: 'desc' },
          take: 5,
        }),
        tenant.hospitalBed.findMany({ select: { wardName: true, status: true } }),
      ]);

      const alerts: AlertRow[] = incidents.map((inc) => ({
        id: inc.id,
        severity:
          inc.severity === 'critical' || inc.severity === 'high'
            ? 'critical'
            : inc.severity === 'medium'
              ? 'warning'
              : 'info',
        message: inc.title,
        time: relativeTime(inc.detectedAt),
      }));

      const wardMap = new Map<string, { total: number; occupied: number }>();
      for (const bed of beds) {
        const ward = bed.wardName || 'General';
        const entry = wardMap.get(ward) ?? { total: 0, occupied: 0 };
        entry.total += 1;
        if (bed.status === 'occupied') entry.occupied += 1;
        wardMap.set(ward, entry);
      }
      for (const [ward, stats] of wardMap.entries()) {
        if (stats.total > 0 && stats.occupied / stats.total >= 0.95) {
          alerts.push({
            id: `ward-${ward}`,
            severity: 'warning',
            message: `${ward} at ${Math.round((stats.occupied / stats.total) * 100)}% capacity`,
            time: 'now',
          });
        }
      }

      if (alerts.length > 0) return alerts.slice(0, 8);
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No alerts returned from database in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      logger.warn('Prisma alerts query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Alerts query failed in strict production mode.');
      }
    }
  }

  if (!isSupabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Alerts data source unavailable in strict production mode.');
    }
    return MOCK_ALERTS;
  }

  if (isStrictProductionMode()) {
    throw new DataSourceUnavailableError('Alert source table is not implemented for strict production mode.');
  }
  return MOCK_ALERTS;
}

export async function getStaffCounts(hospitalId?: string): Promise<{ total: number; active: number; pending: number }> {
  const mockCounts = { total: 34, active: 30, pending: 4 };

  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const [total, active, pending] = await Promise.all([
        tenant.profile.count(),
        tenant.profile.count({ where: { status: 'active' } }),
        tenant.profile.count({ where: { status: 'pending' } }),
      ]);
      return { total, active, pending };
    } catch (error) {
      logger.warn('Prisma staff count query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Staff count query failed in strict production mode.');
      }
    }
  }

  if (!isSupabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'Staff counts require DATABASE_URL or Supabase in strict production mode.',
      );
    }
    return mockCounts;
  }

  try {
    const { count: total } = await supabaseServer!
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId || '');

    const { count: active } = await supabaseServer!
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId || '')
      .eq('status', 'active');

    const { count: pending } = await supabaseServer!
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId || '')
      .eq('status', 'pending');

    return {
      total: total ?? mockCounts.total,
      active: active ?? mockCounts.active,
      pending: pending ?? mockCounts.pending,
    };
  } catch {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Staff count query failed in strict production mode.');
    }
    return mockCounts;
  }
}
