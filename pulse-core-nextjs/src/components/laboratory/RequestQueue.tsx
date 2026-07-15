'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search,
    MoreVertical,
    Clock,
    AlertCircle,
    Play,
    ChevronRight,
    Loader2,
    User,
    Wifi,
    WifiOff,
    Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function RequestQueue() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOnline, setIsOnline] = useState(true);
    const [usingCache, setUsingCache] = useState(false);

    // Network status detection
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        setTimeout(() => setIsOnline(navigator.onLine), 0);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchRequests = useCallback(async () => {
        if (!isOnline) {
            // Try to load from cache when offline
            try {
                const cachedData = localStorage.getItem('lab_requests_cache');
                if (cachedData) {
                    const { data, timestamp } = JSON.parse(cachedData);
                    // Use cache if less than 5 minutes old
                    if (Date.now() - timestamp < 5 * 60 * 1000) {
                        setRequests(data);
                        setUsingCache(true);
                        setLoading(false);
                        return;
                    }
                }
            } catch {
                // Cache read failed, continue with empty state
            }
        }

        const { data, error } = await supabase
            .from('lab_requests')
            .select(`
                *,
                patient:patients(name)
            `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setRequests(data);
            // Cache the data
            try {
                localStorage.setItem('lab_requests_cache', JSON.stringify({
                    data,
                    timestamp: Date.now()
                }));
            } catch {
                // Cache write failed, ignore
            }
        }
        setLoading(false);
        setUsingCache(false);
    }, [isOnline]);

    useEffect(() => {
        // Initial load
        const loadRequests = async () => {
            const { data, error } = await supabase
                .from('lab_requests')
                .select(`
                    *,
                    patient:patients(name)
                `)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setRequests(data);
            }
            setLoading(false);
        };

        loadRequests();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('lab_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_requests' }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchRequests]);

    const formatRequestedTime = (createdAt: string) => {
        return new Intl.DateTimeFormat('en-KE', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Nairobi',
        }).format(new Date(createdAt));
    };

    const filteredRequests = useMemo(() => requests.filter(req =>
        req.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.patient?.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [requests, searchTerm]);

    return (
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-slate-900 font-outfit">Diagnostic Queue</h3>
                        {/* Network Status Indicator */}
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <Wifi className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Online</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                    <WifiOff className="w-3 h-3 text-amber-500" />
                                    <span className="text-[10px] font-bold text-amber-500 uppercase">Offline</span>
                                </div>
                            )}
                            {usingCache && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#3282B8]/10 border border-[#3282B8]/20">
                                    <Database className="w-3 h-3 text-[#3282B8]" />
                                    <span className="text-[10px] font-bold text-[#3282B8] uppercase">Cached</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        {usingCache ? 'Cached data from last sync · ' : 'Live requests from clinical departments'}
                        {filteredRequests.length} pending request{filteredRequests.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search requests..."
                            className="bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/10 w-64 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {loading && requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p className="text-sm font-medium">Monitoring clinical nodes...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">Quiet in the Lab</h4>
                        <p className="text-xs text-slate-500 max-w-[200px] mt-1">No pending diagnostic requests at this time.</p>
                    </div>
                ) : (
                    filteredRequests.map((req) => (
                        <div
                            key={req.id}
                            className="group p-5 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between relative z-10">
                                <div className="flex gap-4">
                                    <div className={cn(
                                        'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border',
                                        req.priority === 'Stat' ? 'bg-rose-50 border-rose-100 text-rose-500' :
                                            req.priority === 'Urgent' ? 'bg-amber-50 border-amber-100 text-amber-500' :
                                                'bg-blue-50 border-blue-100 text-blue-500'
                                    )}>
                                        {req.priority === 'Stat' ? <AlertCircle className="w-6 h-6 animate-pulse" /> :
                                            req.status === 'In Progress' ? <Play className="w-5 h-5 fill-current" /> :
                                                <Clock className="w-6 h-6" />}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.id.slice(0, 8)}</span>
                                            <span className={cn(
                                                'px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-tighter',
                                                req.priority === 'Stat' ? 'bg-rose-500 text-white' :
                                                    req.priority === 'Urgent' ? 'bg-amber-500 text-white' :
                                                        'bg-blue-500 text-white'
                                            )}>
                                                {req.priority}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{req.test_name}</h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3.5 h-3.5" />
                                                {req.patient?.name || 'Unknown Patient'}
                                            </span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span>Requested {formatRequestedTime(req.created_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    <div className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold',
                                        req.status === 'In Progress' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    )}>
                                        <div className={cn('w-1.5 h-1.5 rounded-full', req.status === 'In Progress' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                                        {req.status.toUpperCase()}
                                    </div>
                                    <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Action Bar - visible on hover */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                                <div className="flex items-center gap-2">
                                    <button className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 transition-colors uppercase tracking-widest">
                                        Start Processing
                                    </button>
                                    <button className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition-colors uppercase tracking-widest">
                                        View Details
                                    </button>
                                </div>
                                <button className="p-1.5 text-slate-400 hover:text-slate-900">
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-8">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing {filteredRequests.length} active requests</span>
                <button className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-all">
                    Generate Load Report
                </button>
            </div>
        </div>
    );
}
