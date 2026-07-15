'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Bell, CheckCheck, Clock, UserPlus,
    AlertTriangle, Stethoscope, FlaskConical,
    CreditCard, FileText, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

/* ────────────────────────────────────────────────── types */
type NotificationType = 'queue' | 'lab' | 'payment' | 'alert' | 'consultation' | 'general';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    time: string;
    read: boolean;
    actionUrl?: string;
}


const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
    alert:        { icon: AlertTriangle, color: 'text-red-500',       bg: 'bg-red-500/10' },
    queue:        { icon: UserPlus,      color: 'text-amber-500',     bg: 'bg-amber-500/10' },
    lab:          { icon: FlaskConical,  color: 'text-purple-500',    bg: 'bg-purple-500/10' },
    payment:      { icon: CreditCard,    color: 'text-emerald',       bg: 'bg-emerald/10' },
    consultation: { icon: Stethoscope,   color: 'text-portal-primary', bg: 'bg-portal-primary/10' },
    general:      { icon: FileText,      color: 'text-slate',         bg: 'bg-content-surface' },
};

/* ────────────────────────────────────────────────── component */
export function NotificationPanel() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        void (async () => {
            try {
                const res = await fetch('/api/notifications', { cache: 'no-store', credentials: 'same-origin' });
                if (!res.ok) return;
                const data = await res.json();
                if (active && Array.isArray(data.items)) setNotifications(data.items);
            } catch (err) {
                logger.error('Failed to load notifications', { error: err });
            }
        })();
        return () => { active = false; };
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Subscribe to real-time clinical alerts
    useEffect(() => {
        const hospitalId = 'demo-hospital'; // Replace with actual context
        
        const channel = supabase.channel(`hospital:${hospitalId}`)
            .on('broadcast', { event: 'EMERGENCY_TRIAGE' }, (payload) => {
                const newNotif: Notification = {
                    id: Math.random().toString(36).substring(7),
                    type: 'alert',
                    title: '🚨 EMERGENCY TRIAGE ALERT',
                    message: payload.payload.message || 'High severity patient detected.',
                    time: 'Just now',
                    read: false
                };
                setNotifications(prev => [newNotif, ...prev]);
                
                // Audio alert for emergencies
                if (typeof window !== 'undefined') {
                    const audio = new Audio('/sounds/alert.mp3');
                    audio.play().catch(() => {
                        // Autoplay can be blocked by browser policy; notification remains visible.
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // close on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const markRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Trigger */}
            <button
                onClick={() => setOpen(!open)}
                className="p-2 text-mist hover:text-white hover:bg-forest/30 rounded-card transition-all relative"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-ink">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <div
                className={cn(
                    'absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-content-bg rounded-card border border-content-border shadow-2xl z-50 transition-all duration-200',
                    open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-content-border">
                    <h3 className="text-sm font-bold text-ink">Notifications</h3>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="flex items-center gap-1 text-[11px] font-semibold text-portal-primary hover:text-portal-primary-hover transition-colors"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="overflow-y-auto max-h-[380px]">
                    {notifications.map(notif => {
                        const tc = typeConfig[notif.type];
                        const Icon = tc.icon;
                        return (
                            <div
                                key={notif.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => markRead(notif.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markRead(notif.id); } }}
                                className={cn(
                                    'flex items-start gap-3 px-5 py-4 border-b border-content-border/50 cursor-pointer transition-all hover:bg-content-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35',
                                    !notif.read && 'bg-portal-primary-light/20'
                                )}
                            >
                                <div className={cn('w-9 h-9 rounded-card flex items-center justify-center flex-shrink-0', tc.bg)}>
                                    <Icon className={cn('w-4 h-4', tc.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={cn('text-sm font-semibold truncate', notif.read ? 'text-charcoal' : 'text-ink')}>{notif.title}</p>
                                        {!notif.read && <span className="w-2 h-2 bg-portal-primary rounded-full flex-shrink-0" />}
                                    </div>
                                    <p className="text-xs text-slate mt-0.5 line-clamp-2">{notif.message}</p>
                                    <p className="text-[10px] text-mist mt-1 font-mono flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {notif.time}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-content-border text-center">
                    <button className="text-xs font-semibold text-portal-primary hover:text-portal-primary-hover transition-colors">
                        View All Notifications
                    </button>
                </div>
            </div>
        </div>
    );
}
