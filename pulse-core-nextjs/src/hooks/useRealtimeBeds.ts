/**
 * useRealtimeBeds
 *
 * Subscribes to real-time updates on the hospital_beds table via Supabase
 * Realtime. Returns the full bed grid grouped by ward.
 *
 * IMPORTANT: always call supabase.removeChannel(channel) in cleanup to prevent
 * memory leaks (see AfyaHero fullstack rules).
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import logger from '@/lib/logger';

/* ──────────────────────────────────────── types */
export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';

export interface Bed {
    id: string;
    bed_number: string;
    ward_id: string;
    ward_name: string;
    status: BedStatus;
    patient_id?: string;
    patient_name?: string;
    admitted_at?: string;
    expected_discharge?: string;
    hospital_id: string;
    notes?: string;
}

export type BedsByWard = Record<string, Bed[]>;

export type BedConnectionStatus = 'connecting' | 'connected' | 'error' | 'closed';

interface UseRealtimeBedsReturn {
    beds: Bed[];
    bedsByWard: BedsByWard;
    connectionStatus: BedConnectionStatus;
    stats: {
        total: number;
        available: number;
        occupied: number;
        reserved: number;
        maintenance: number;
        occupancyRate: number;
    };
    refresh: () => Promise<void>;
}

/* ──────────────────────────────────────── helpers */
function groupByWard(beds: Bed[]): BedsByWard {
    return beds.reduce<BedsByWard>((acc, bed) => {
        if (!acc[bed.ward_name]) acc[bed.ward_name] = [];
        acc[bed.ward_name].push(bed);
        return acc;
    }, {});
}

function computeStats(beds: Bed[]) {
    const total       = beds.length;
    const available   = beds.filter(b => b.status === 'available').length;
    const occupied    = beds.filter(b => b.status === 'occupied').length;
    const reserved    = beds.filter(b => b.status === 'reserved').length;
    const maintenance = beds.filter(b => b.status === 'maintenance' || b.status === 'cleaning').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, available, occupied, reserved, maintenance, occupancyRate };
}

/* ──────────────────────────────────────── hook */
export function useRealtimeBeds(hospitalId: string, wardId?: string): UseRealtimeBedsReturn {
    const [beds, setBeds] = useState<Bed[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<BedConnectionStatus>('connecting');
    const channelRef = useRef<RealtimeChannel | null>(null);
    const mountedRef = useRef(true);

    const fetchBeds = useCallback(async () => {
        if (!hospitalId) return;
        let query = supabase
            .from('hospital_beds')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('ward_name', { ascending: true })
            .order('bed_number', { ascending: true });

        if (wardId) query = query.eq('ward_id', wardId);

        const { data, error } = await query;
        if (error) {
            logger.error('[useRealtimeBeds] fetch error', { error: error.message, hospitalId, wardId });
            return;
        }
        if (mountedRef.current) {
            setBeds((data ?? []) as Bed[]);
        }
    }, [hospitalId, wardId]);

    useEffect(() => {
        mountedRef.current = true;
        // Defer fetch to avoid synchronous setState in effect
        setTimeout(() => void fetchBeds(), 0);

        const channelName = wardId
            ? `beds:hospital_id=eq.${hospitalId}:ward_id=eq.${wardId}`
            : `beds:hospital_id=eq.${hospitalId}`;

        const filter = wardId
            ? `hospital_id=eq.${hospitalId}`
            : `hospital_id=eq.${hospitalId}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'hospital_beds', filter },
                (payload) => {
                    if (!mountedRef.current) return;
                    setBeds((prev) => {
                        if (payload.eventType === 'INSERT') {
                            return [...prev, payload.new as Bed];
                        }
                        if (payload.eventType === 'UPDATE') {
                            return prev.map((b) =>
                                b.id === payload.new.id ? (payload.new as Bed) : b
                            );
                        }
                        if (payload.eventType === 'DELETE') {
                            return prev.filter((b) => b.id !== payload.old.id);
                        }
                        return prev;
                    });
                }
            )
            .subscribe((status) => {
                if (!mountedRef.current) return;
                if (status === 'SUBSCRIBED') setConnectionStatus('connected');
                else if (status === 'CHANNEL_ERROR') setConnectionStatus('error');
                else if (status === 'CLOSED') setConnectionStatus('closed');
            });

        channelRef.current = channel;

        return () => {
            mountedRef.current = false;
            /* critical: always remove channel on unmount */
            if (channelRef.current) {
                void supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [hospitalId, wardId, fetchBeds]);

    return {
        beds,
        bedsByWard: groupByWard(beds),
        connectionStatus,
        stats: computeStats(beds),
        refresh: fetchBeds,
    };
}
