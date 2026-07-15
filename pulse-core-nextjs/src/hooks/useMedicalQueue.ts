/**
 * useMedicalQueue
 *
 * Fetches the medical queue via REST API with auto-refresh.
 * For realtime subscriptions, use useRealtimeQueue instead.
 *
 * Provides: queue entries, loading state, error state, refresh callback.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import logger from '@/lib/logger';

export interface MedicalQueueItem {
  id: string;
  patientId?: string;
  patient?: { name: string; age?: string; pid?: string; gender?: string };
  priority: 'emergency' | 'urgent' | 'normal' | 'low' | 'critical';
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'transferred';
  complaint: string;
  waitMinutes?: number;
  arrivedAt?: string;
  room?: string;
  assignedTo?: string;
  hospitalId?: string;
}

interface UseMedicalQueueReturn {
  queue: MedicalQueueItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const API_ENDPOINT = '/api/hospital/queue';
const REFRESH_INTERVAL_MS = 30_000;

function calculateAge(dob: unknown): string | undefined {
  if (typeof dob !== 'string' && !(dob instanceof Date)) return undefined;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return undefined;
  const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(age) ? String(age) : undefined;
}

export function useMedicalQueue(autoRefresh = true): UseMedicalQueueReturn {
  const [queue, setQueue] = useState<MedicalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINT, { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load queue (${res.status})`);
      const data = await res.json();
      const items: MedicalQueueItem[] = (data.queue ?? []).map((item: Record<string, unknown>, index: number) => {
        const patient = item.patient && typeof item.patient === 'object'
          ? item.patient as Record<string, unknown>
          : undefined;
        const patientId = (item.patientId as string | undefined)
          ?? (item.patient_id as string | undefined)
          ?? (patient?.id as string | undefined);
        const arrivedAt = (item.arrivedAt as string | undefined) ?? (item.arrived_at as string | undefined);
        const waitMinutes = typeof item.timeInQueue === 'number'
          ? item.timeInQueue
          : item.wait_minutes as number | undefined;

        return {
          id: (item.id as string) ?? String(index),
          patientId,
          patient: patient || item.patient_name
            ? {
                name: (patient?.name as string | undefined) ?? (item.patient_name as string | undefined) ?? 'Unknown patient',
                age: (item.age as string | undefined) ?? calculateAge(patient?.dob),
                pid: patientId,
                gender: patient?.gender as string | undefined,
              }
            : undefined,
          priority: (item.priority as MedicalQueueItem['priority']) ?? 'normal',
          status: (item.status as MedicalQueueItem['status']) ?? 'waiting',
          complaint: (item.chiefComplaint as string | undefined)
            ?? (item.chief_complaint as string | undefined)
            ?? (item.complaint as string | undefined)
            ?? '',
          waitMinutes,
          arrivedAt,
          room: item.room as string | undefined,
          assignedTo: (item.assignedTo as string | undefined) ?? (item.assigned_to as string | undefined),
          hospitalId: (item.hospitalId as string | undefined) ?? (item.hospital_id as string | undefined),
        };
      });
      if (mountedRef.current) setQueue(items);
    } catch (err) {
      logger.error('useMedicalQueue: fetch failed', { error: err });
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Could not load queue.');
        setQueue([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    if (!autoRefresh) return;
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh, autoRefresh]);

  return { queue, loading, error, refresh };
}
