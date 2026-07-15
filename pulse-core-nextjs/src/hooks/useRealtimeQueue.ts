/**
 * useRealtimeQueue
 *
 * Subscribes to real-time updates on the hospital_queue table via Supabase
 * Realtime. Provides the sorted queue list and a connection-status flag.
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
export type QueueStatus =
    | 'waiting'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'transferred';

export interface QueueEntry {
    id: string;
    /** Patient display name — PII is NOT sent to external LLMs */
    patient_name: string;
    patient_id: string;
    ticket_number: string;
    priority: 'emergency' | 'urgent' | 'normal' | 'low';
    status: QueueStatus;
    triage_severity?: 'high' | 'medium' | 'low';
    chief_complaint: string;
    assigned_to?: string;
    room?: string;
    wait_minutes: number;
    arrived_at: string;
    hospital_id: string;
}

export type QueueConnectionStatus = 'connecting' | 'connected' | 'error' | 'closed';

interface UseRealtimeQueueReturn {
    queue: QueueEntry[];
    connectionStatus: QueueConnectionStatus;
    refresh: () => Promise<void>;
}

/* ──────────────────────────────────────── hook */
export function useRealtimeQueue(hospitalId: string): UseRealtimeQueueReturn {
    const [queue, setQueue] = useState<QueueEntry[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<QueueConnectionStatus>('connecting');
    const channelRef = useRef<RealtimeChannel | null>(null);
    const mountedRef = useRef(true);

    /* initial load */
    const fetchQueue = useCallback(async () => {
        if (!hospitalId) return;
        const { data, error } = await supabase
            .from('hospital_queue')
            .select('*')
            .eq('hospital_id', hospitalId)
            .not('status', 'in', '("completed","cancelled")')
            .order('arrived_at', { ascending: true });

        if (error) {
            logger.error('[useRealtimeQueue] fetch error', { error: error.message, hospitalId });
            return;
        }
        if (mountedRef.current) {
            setQueue((data ?? []) as QueueEntry[]);
        }
    }, [hospitalId]);

    useEffect(() => {
        mountedRef.current = true;
        // Defer fetch to avoid synchronous setState in effect
        setTimeout(() => void fetchQueue(), 0);

        /* subscribe */
        const channel = supabase
            .channel(`queue:hospital_id=eq.${hospitalId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_queue',
                    filter: `hospital_id=eq.${hospitalId}`,
                },
                (payload) => {
                    if (!mountedRef.current) return;
                    setQueue((prev) => {
                        if (payload.eventType === 'INSERT') {
                            return [...prev, payload.new as QueueEntry].sort(
                                (a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime()
                            );
                        }
                        if (payload.eventType === 'UPDATE') {
                            return prev.map((e) =>
                                e.id === payload.new.id ? (payload.new as QueueEntry) : e
                            );
                        }
                        if (payload.eventType === 'DELETE') {
                            return prev.filter((e) => e.id !== payload.old.id);
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
    }, [hospitalId, fetchQueue]);

    return { queue, connectionStatus, refresh: fetchQueue };
}
