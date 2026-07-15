'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import type { HandoverRecord } from '@/types';
import { toast } from 'sonner';

export type HandoverConnectionStatus = 'connecting' | 'connected' | 'error' | 'closed';

interface UseRealtimeHandoverReturn {
    handovers: HandoverRecord[];
    connectionStatus: HandoverConnectionStatus;
    refresh: () => Promise<void>;
}

export function useRealtimeHandover(hospitalId: string, currentUserId: string): UseRealtimeHandoverReturn {
    const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<HandoverConnectionStatus>('connecting');
    const channelRef = useRef<RealtimeChannel | null>(null);
    const mountedRef = useRef(true);

    const fetchHandovers = useCallback(async () => {
        if (!hospitalId) return;
        
        try {
            const resp = await fetch('/api/medical/handover');
            if (resp.ok) {
                const data = await resp.json();
                if (mountedRef.current) {
                    setHandovers(data.items || []);
                }
            }
        } catch (err) {
            logger.error('[useRealtimeHandover] fetch error', { err });
        }
    }, [hospitalId]);

    useEffect(() => {
        mountedRef.current = true;
        // Defer fetch to avoid synchronous setState in effect
        setTimeout(() => void fetchHandovers(), 0);

        if (!hospitalId) return;

        /* subscribe */
        const channel = supabase
            .channel(`handover:hospital_id=eq.${hospitalId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_handover',
                    filter: `hospital_id=eq.${hospitalId}`,
                },
                (payload) => {
                    if (!mountedRef.current) return;
                    
                    if (payload.eventType === 'INSERT') {
                        const newHandover = payload.new as HandoverRecord;
                        setHandovers((prev) => [newHandover, ...prev]);
                        
                        if (newHandover.senderId !== currentUserId) {
                           toast.success(`New Clinical Handover for ${newHandover.patientName}`, {
                               description: 'Please review the handover details.',
                               duration: 6000,
                            });
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedHandover = payload.new as HandoverRecord;
                        setHandovers((prev) => 
                            prev.map((h) => h.id === updatedHandover.id ? updatedHandover : h)
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setHandovers((prev) => prev.filter((h) => h.id !== payload.old.id));
                    }
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
            if (channelRef.current) {
                void supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [hospitalId, currentUserId, fetchHandovers]);

    return { handovers, connectionStatus, refresh: fetchHandovers };
}
