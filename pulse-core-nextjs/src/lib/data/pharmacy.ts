/**
 * Pharmacy data access — Prisma (tenant-scoped), Supabase fallback, mock for demo.
 */
import type { Prisma } from '@prisma/client';
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { supabaseServer, isSupabaseAvailable } from '../supabase-server';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import { isDatabaseAvailable } from './handover';
import { DataSourceUnavailableError } from './errors';

export interface RxQueueRow {
  id: string;
  rx_number: string;
  patient_name: string;
  prescribed_by: string;
  status: string;
  priority: string;
  insurance?: string;
  alert?: string;
  items_count: number;
}

export interface TopDrugRow {
  drug: string;
  qty: number;
}

const MOCK_RX_QUEUE: RxQueueRow[] = [
  { id: '1', rx_number: 'RX-2851', patient_name: 'Hassan Ali', prescribed_by: 'Dr. Amina', status: 'dispensing', priority: 'urgent', insurance: 'SHIF', items_count: 3 },
  { id: '2', rx_number: 'RX-2847', patient_name: 'Mohammed Odhiambo', prescribed_by: 'Dr. Njoroge', status: 'on-hold', priority: 'urgent', insurance: 'Cash', alert: 'DOSING ALERT', items_count: 2 },
  { id: '3', rx_number: 'RX-2850', patient_name: 'Fatuma Wanjiru', prescribed_by: 'Dr. Amina', status: 'pending', priority: 'urgent', insurance: 'SHIF', items_count: 4 },
];

const MOCK_TOP_DRUGS: TopDrugRow[] = [
  { drug: 'Artemether/Lumefantrine 80/480mg', qty: 42 },
  { drug: 'Amoxicillin 500mg Caps', qty: 38 },
  { drug: 'Paracetamol 500mg', qty: 35 },
];

function countRxItems(items: Prisma.JsonValue): number {
  return Array.isArray(items) ? items.length : 0;
}

export async function getRxQueue(hospitalId?: string): Promise<RxQueueRow[]> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const rows = await tenant.prescription.findMany({
        orderBy: { prescribedAt: 'desc' },
        take: 50,
        include: {
          patient: { select: { name: true } },
          prescribedByProfile: { select: { fullName: true } },
        },
      });
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          rx_number: r.rxNumber,
          patient_name: r.patient.name,
          prescribed_by: r.prescribedByProfile.fullName,
          status: r.status,
          priority: r.priority,
          insurance: r.insurance ?? undefined,
          items_count: countRxItems(r.items),
        }));
      }
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No pharmacy queue data returned from database in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      logger.warn('Prisma pharmacy queue query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Pharmacy queue query failed in strict production mode.');
      }
    }
  }

  if (isSupabaseAvailable()) {
    try {
      let query = supabaseServer!
        .from('prescriptions')
        .select('id, rx_number, patient_id, prescribed_by, status, priority, insurance, items, notes')
        .order('prescribed_at', { ascending: false })
        .limit(50);

      if (hospitalId) query = query.eq('hospital_id', hospitalId);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const patientIds = Array.from(
          new Set(data.map((row) => row.patient_id).filter((id): id is string => typeof id === 'string')),
        );
        const prescriberIds = Array.from(
          new Set(data.map((row) => row.prescribed_by).filter((id): id is string => typeof id === 'string')),
        );

        const [patientResult, profileResult] = await Promise.all([
          patientIds.length > 0
            ? supabaseServer!.from('patients').select('id, name').in('id', patientIds)
            : Promise.resolve({ data: [], error: null }),
          prescriberIds.length > 0
            ? supabaseServer!.from('profiles').select('id, full_name').in('id', prescriberIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const patientNameMap = new Map(
          (patientResult.data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]),
        );
        const prescriberNameMap = new Map(
          (profileResult.data ?? []).map((row: { id: string; full_name: string }) => [row.id, row.full_name]),
        );

        return data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          rx_number: r.rx_number as string,
          patient_name:
            (typeof r.patient_id === 'string' && patientNameMap.get(r.patient_id)) || 'Unknown Patient',
          prescribed_by:
            (typeof r.prescribed_by === 'string' && prescriberNameMap.get(r.prescribed_by)) || 'Unknown Clinician',
          status: r.status as string,
          priority: (r.priority as string) || 'normal',
          insurance: r.insurance as string | undefined,
          items_count: Array.isArray(r.items) ? r.items.length : 0,
        }));
      }
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No pharmacy queue data returned from Supabase in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Pharmacy queue query failed in strict production mode.');
      }
    }
  }

  if (isStrictProductionMode()) {
    throw new DataSourceUnavailableError('Pharmacy queue data source unavailable in strict production mode.');
  }
  return MOCK_RX_QUEUE;
}

export async function getTopDrugs(hospitalId?: string): Promise<TopDrugRow[]> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const tenant = getTenantPrismaClient(hospitalId);
      const rows = await tenant.pharmacyInventory.findMany({
        orderBy: { stockQuantity: 'desc' },
        take: 5,
      });
      if (rows.length > 0) {
        return rows.map((d) => ({ drug: d.medicationName, qty: d.stockQuantity }));
      }
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No top-drugs data returned from database in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      logger.warn('Prisma top-drugs query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Top-drugs query failed in strict production mode.');
      }
    }
  }

  if (!isSupabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Supabase unavailable for top-drugs in strict production mode.');
    }
    return MOCK_TOP_DRUGS;
  }

  try {
    let query = supabaseServer!
      .from('pharmacy_inventory')
      .select('medication_name, stock_quantity')
      .order('stock_quantity', { ascending: false })
      .limit(5);

    if (hospitalId) query = query.eq('hospital_id', hospitalId);

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data.map((d: Record<string, unknown>) => ({
        drug: d.medication_name as string,
        qty: d.stock_quantity as number,
      }));
    }
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('No top-drugs data returned from Supabase in strict production mode.');
    }
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) throw error;
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Top-drugs query failed in strict production mode.');
    }
  }
  return MOCK_TOP_DRUGS;
}
