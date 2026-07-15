/**
 * Reception data access — Prisma (tenant-scoped), Supabase fallback, mock for demo.
 */
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { supabaseServer, isSupabaseAvailable } from '../supabase-server';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import { isDatabaseAvailable } from './handover';
import { DataSourceUnavailableError } from './errors';
import { MOCK_PATIENTS } from './patients';

export interface ArrivalRow {
  id: string;
  token: string;
  name: string;
  age_sex: string;
  complaint: string;
  priority: 'normal' | 'urgent' | 'critical';
  wait: string;
  status: string;
}

export interface ReceptionKPI {
  arrivals: number;
  arrivals_delta: string;
  queue_now: number;
  queue_urgent: number;
  revenue_today: string;
  revenue_delta: string;
  insurance_pending: number;
  insurance_amount: string;
}

const MOCK_ARRIVALS: ArrivalRow[] = MOCK_PATIENTS.map((p, i) => ({
  id: p.id,
  token: `A${String(101 + i).padStart(3, '0')}`,
  name: p.name,
  age_sex: `${p.age} ${p.gender}`,
  complaint: p.complaint,
  priority: (p.priority.toLowerCase() as 'normal' | 'urgent' | 'critical') || 'normal',
  wait: i === 0 ? '5 min' : `${10 * i} min`,
  status: p.status === 'in-consult' ? 'In Consult' : p.status === 'admitted' ? 'Admitted' : 'Waiting',
}));

const MOCK_KPI: ReceptionKPI = {
  arrivals: 47,
  arrivals_delta: '↑12% vs yesterday',
  queue_now: 12,
  queue_urgent: 3,
  revenue_today: 'KES 84,200',
  revenue_delta: '↑8% vs target',
  insurance_pending: 23,
  insurance_amount: 'KES 142,000',
};

function formatWait(checkedInAt: Date): string {
  const waitMin = Math.round((Date.now() - checkedInAt.getTime()) / 60000);
  return waitMin > 0 ? `${waitMin} min` : '—';
}

function mapCheckin(r: {
  id: string;
  tokenNumber: number | null;
  patientName: string;
  chiefComplaint: string | null;
  priority: string | null;
  status: string;
  checkedInAt: Date;
}): ArrivalRow {
  return {
    id: r.id,
    token: `A${String(r.tokenNumber ?? 0).padStart(3, '0')}`,
    name: r.patientName,
    age_sex: '?',
    complaint: r.chiefComplaint ?? '',
    priority: (r.priority ?? 'normal') as 'normal' | 'urgent' | 'critical',
    wait: formatWait(r.checkedInAt),
    status: r.status,
  };
}

export async function getArrivals(hospitalId?: string): Promise<ArrivalRow[]> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rows = await tenant.receptionCheckin.findMany({
        where: { checkedInAt: { gte: today } },
        orderBy: { checkedInAt: 'desc' },
        take: 30,
      });
      if (rows.length > 0) return rows.map(mapCheckin);
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No arrivals returned from database in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      logger.warn('Prisma arrivals query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Arrivals fetch failed in strict production mode.');
      }
    }
  }

  if (isSupabaseAvailable()) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabaseServer!
        .from('reception_checkins')
        .select('id, token_number, patient_name, age, sex, chief_complaint, priority, status, checked_in_at')
        .gte('checked_in_at', `${today}T00:00:00`)
        .order('checked_in_at', { ascending: false })
        .limit(30);

      if (hospitalId) query = query.eq('hospital_id', hospitalId);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((r: Record<string, unknown>) => {
          const checkedIn = new Date(r.checked_in_at as string);
          const waitMin = Math.round((Date.now() - checkedIn.getTime()) / 60000);
          return {
            id: r.id as string,
            token: `A${String(r.token_number).padStart(3, '0')}`,
            name: r.patient_name as string,
            age_sex: `${r.age || '?'}${r.sex ? String(r.sex).charAt(0).toUpperCase() : ''}`,
            complaint: (r.chief_complaint || '') as string,
            priority: (r.priority || 'normal') as 'normal' | 'urgent' | 'critical',
            wait: waitMin > 0 ? `${waitMin} min` : '—',
            status: (r.status || 'waiting') as string,
          };
        });
      }
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No arrivals returned from Supabase in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Arrivals fetch failed in strict production mode.');
      }
    }
  }

  if (isStrictProductionMode()) {
    throw new DataSourceUnavailableError('Arrivals data source unavailable in strict production mode.');
  }
  return MOCK_ARRIVALS;
}

export async function getReceptionKPI(hospitalId?: string): Promise<ReceptionKPI> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [arrivals, queueRows] = await Promise.all([
        tenant.receptionCheckin.count({ where: { checkedInAt: { gte: today } } }),
        tenant.hospitalQueue.findMany({
          where: { status: 'waiting' },
          select: { priority: true },
        }),
      ]);

      const queueNow = queueRows.length;
      const urgentCount = queueRows.filter(
        (q) => q.priority === 'urgent' || q.priority === 'critical',
      ).length;

      return {
        arrivals,
        arrivals_delta: '',
        queue_now: queueNow,
        queue_urgent: urgentCount,
        revenue_today: MOCK_KPI.revenue_today,
        revenue_delta: MOCK_KPI.revenue_delta,
        insurance_pending: MOCK_KPI.insurance_pending,
        insurance_amount: MOCK_KPI.insurance_amount,
      };
    } catch (error) {
      logger.warn('Prisma reception KPI query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Reception KPI query failed in strict production mode.');
      }
    }
  }

  if (!isSupabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Supabase unavailable for reception KPIs in strict production mode.');
    }
    return MOCK_KPI;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [arrivalsRes, queueRes] = await Promise.all([
      supabaseServer!
        .from('reception_checkins')
        .select('id', { count: 'exact', head: true })
        .gte('checked_in_at', `${today}T00:00:00`)
        .eq('hospital_id', hospitalId || ''),
      supabaseServer!
        .from('hospital_queue')
        .select('id, priority', { count: 'exact' })
        .eq('status', 'waiting')
        .eq('hospital_id', hospitalId || ''),
    ]);

    const arrivals = arrivalsRes.count ?? MOCK_KPI.arrivals;
    const queueData = queueRes.data ?? [];
    const queueNow = queueRes.count ?? MOCK_KPI.queue_now;
    const urgentCount = queueData.filter((q: Record<string, unknown>) =>
      q.priority === 'urgent' || q.priority === 'critical',
    ).length;

    return {
      arrivals,
      arrivals_delta: '',
      queue_now: queueNow,
      queue_urgent: urgentCount,
      revenue_today: MOCK_KPI.revenue_today,
      revenue_delta: MOCK_KPI.revenue_delta,
      insurance_pending: MOCK_KPI.insurance_pending,
      insurance_amount: MOCK_KPI.insurance_amount,
    };
  } catch {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Reception KPI query failed in strict production mode.');
    }
    return MOCK_KPI;
  }
}
