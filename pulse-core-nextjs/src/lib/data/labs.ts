/**
 * Lab data access — Prisma (tenant-scoped), Supabase fallback, mock for demo.
 */
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { supabaseServer, isSupabaseAvailable } from '../supabase-server';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import { isDatabaseAvailable } from './handover';
import { DataSourceUnavailableError } from './errors';

export interface LabQueueRow {
  id: string;
  lab_id: string;
  patient_name: string;
  test_name: string;
  panel?: string;
  sample_type: string;
  priority: 'routine' | 'urgent' | 'STAT';
  status: string;
  ordered_at: string;
  turnaround: string;
  abnormal?: boolean;
  critical?: boolean;
}

const MOCK_LAB_QUEUE: LabQueueRow[] = [
  { id: '1', lab_id: 'LAB-2847', patient_name: 'Hassan Ali', test_name: 'Blood Culture', sample_type: 'Blood', priority: 'STAT', status: 'processing', ordered_at: '08:20', turnaround: '4h 20m' },
  { id: '2', lab_id: 'LAB-2848', patient_name: 'Fatuma Wanjiru', test_name: 'CBC + Iron Studies', sample_type: 'Blood', priority: 'STAT', status: 'completed', ordered_at: '08:35', turnaround: '1h 15m', abnormal: true },
  { id: '3', lab_id: 'LAB-2849', patient_name: 'Peter Kamau', test_name: 'Sputum AFB / GeneXpert', sample_type: 'Sputum', priority: 'urgent', status: 'sample-collected', ordered_at: '09:05', turnaround: '—' },
  { id: '4', lab_id: 'LAB-2850', patient_name: 'Grace Muthoni', test_name: 'ANC Panel (Hb, HIV, VDRL, Blood Group)', sample_type: 'Blood', priority: 'routine', status: 'ordered', ordered_at: '09:20', turnaround: '—' },
  { id: '5', lab_id: 'LAB-2851', patient_name: 'James Odhiambo', test_name: 'Malaria RDT + Slide', sample_type: 'Blood', priority: 'urgent', status: 'completed', ordered_at: '07:50', turnaround: '25m', abnormal: true },
  { id: '6', lab_id: 'LAB-2852', patient_name: 'Amina Sheikh', test_name: 'RBS + HbA1c + Ketones', sample_type: 'Blood', priority: 'STAT', status: 'completed', ordered_at: '06:30', turnaround: '45m', critical: true },
];

function formatTurnaround(orderedAt: Date, completedAt: Date | null): string {
  if (!completedAt) return '—';
  const mins = Math.round((completedAt.getTime() - orderedAt.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function mapLabRow(
  r: {
    id: string;
    labId: string;
    testName: string;
    panel: string | null;
    sampleType: string | null;
    priority: string;
    status: string;
    orderedAt: Date;
    completedAt: Date | null;
    abnormal: boolean;
    critical: boolean;
    patient: { name: string };
  },
): LabQueueRow {
  return {
    id: r.id,
    lab_id: r.labId,
    patient_name: r.patient.name,
    test_name: r.testName,
    panel: r.panel ?? undefined,
    sample_type: r.sampleType ?? 'Blood',
    priority: (r.priority as 'routine' | 'urgent' | 'STAT') || 'routine',
    status: r.status,
    ordered_at: r.orderedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    turnaround: formatTurnaround(r.orderedAt, r.completedAt),
    abnormal: r.abnormal,
    critical: r.critical,
  };
}

export async function getLabQueue(hospitalId?: string): Promise<LabQueueRow[]> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const rows = await tenant.labRequest.findMany({
        orderBy: { orderedAt: 'desc' },
        take: 50,
        include: { patient: { select: { name: true } } },
      });
      if (rows.length > 0) return rows.map(mapLabRow);
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No lab queue data returned from database in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      logger.warn('Prisma lab queue query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Lab queue query failed in strict production mode.');
      }
    }
  }

  if (isSupabaseAvailable()) {
    try {
      let query = supabaseServer!
        .from('lab_requests')
        .select('id, lab_id, patient_id, test_name, panel, sample_type, priority, status, ordered_at, abnormal, critical, notes')
        .order('ordered_at', { ascending: false })
        .limit(50);

      if (hospitalId) query = query.eq('hospital_id', hospitalId);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          lab_id: r.lab_id as string,
          patient_name: (r.patient_name as string) || 'Unknown',
          test_name: r.test_name as string,
          panel: r.panel as string | undefined,
          sample_type: (r.sample_type as string) || 'Blood',
          priority: r.priority as 'routine' | 'urgent' | 'STAT',
          status: r.status as string,
          ordered_at: new Date(r.ordered_at as string).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          turnaround: '—',
          abnormal: r.abnormal as boolean | undefined,
          critical: r.critical as boolean | undefined,
        }));
      }
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No lab queue data returned from Supabase in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Lab queue query failed in strict production mode.');
      }
    }
  }

  if (isStrictProductionMode()) {
    throw new DataSourceUnavailableError('Lab queue data source unavailable in strict production mode.');
  }
  return MOCK_LAB_QUEUE;
}
