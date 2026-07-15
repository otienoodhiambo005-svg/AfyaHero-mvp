'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Stethoscope, BedDouble, Calendar, 
  Activity, DollarSign, Clock, ShieldCheck, 
  Sparkles, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface KPIItemData {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}

interface KPIHeroStripProps {
  role: 'medical' | 'reception' | 'pharmacy' | 'lab' | 'admin';
  accentColor?: string;
}

export function KPIHeroStrip({ role, accentColor = '#2563EB' }: KPIHeroStripProps) {
  const [liveData, setLiveData] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchKPI = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/kpi', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === 'object') setLiveData(data as Record<string, number>);
    } catch (err) {
      logger.error('KPI fetch error', { error: err });
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  useEffect(() => {
    void fetchKPI();
    const interval = setInterval(fetchKPI, 15000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    const medicalSet: KPIItemData[] = [
      { label: 'Clinic Queue', value: liveData.queue ?? 0, icon: <Users className="w-4 h-4" />, accent: accentColor },
      { label: 'Active Dx', value: liveData.active_consults ?? 0, icon: <Stethoscope className="w-4 h-4" />, accent: 'var(--ai-confirmed-text)' },
      { label: 'Beds Open', value: liveData.beds ?? 0, icon: <BedDouble className="w-4 h-4" />, accent: 'var(--portal-primary)' },
      { label: 'Today Apps', value: liveData.appointments ?? 0, icon: <Calendar className="w-4 h-4" />, accent: accentColor },
    ];

    const receptionSet: KPIItemData[] = [
      { label: 'Current Arrivals', value: liveData.queue ?? 0, icon: <Users className="w-4 h-4" />, accent: 'var(--portal-reception)' },
      { label: 'Avg TAT', value: `${liveData.tat ?? 0}m`, icon: <Clock className="w-4 h-4" />, accent: 'var(--amber-500)' },
      { label: 'Collections', value: `KES ${(liveData.collections ?? 0).toLocaleString()}`, icon: <DollarSign className="w-4 h-4" />, accent: 'var(--emerald)' },
      { label: 'Urgent Alert', value: liveData.triage_urgency ?? 0, icon: <Activity className="w-4 h-4" />, accent: 'var(--severity-high)' },
    ];

    if (role === 'reception') return receptionSet;
    return medicalSet; // Default to medical for now
  }, [role, liveData, accentColor]);

  return (
    <div className="sticky top-0 z-40 bg-[#080F0C] border-l border-b border-white/5 px-6 py-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-12">
        {metrics.map((m, idx) => (
          <KPIItem 
            key={m.label}
            {...m}
            delay={idx * 0.1}
            isSyncing={isSyncing}
          />
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-4 pr-4 border-r border-white/10 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <ShieldCheck className="w-3 h-3 text-emerald/60" />
            <span className="text-[9px] font-bold text-emerald/60 uppercase tracking-widest font-mono">Vault Protocol Active</span>
          </div>
          <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-mono mt-0.5 whitespace-nowrap">Encrypted Sync</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-content-bg/5 border border-white/10">
          <AnimatePresence mode="wait">
            <motion.div 
              key={isSyncing ? 'sync' : 'live'}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                isSyncing ? "bg-emerald animate-pulse" : "bg-emerald/40"
              )} />
              <span className="text-[10px] font-bold text-mist/60 uppercase tracking-widest font-mono">
                {isSyncing ? 'Sync Intelligence' : 'Live Stream'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function KPIItem({ label, value, icon, accent, delay, isSyncing }: KPIItemData & { delay: number; isSyncing: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
      className="flex items-center gap-4 group"
    >
      <div 
        className="w-10 h-10 rounded-card bg-content-bg/5 border border-white/10 flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-content-bg/10"
        style={{ color: accent }}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-bold text-mist/30 uppercase tracking-[0.2em] font-mono mb-0.5">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <AnimatePresence mode="wait">
            <motion.span
              key={value}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "text-xl font-black tracking-tighter text-white font-mono",
                isSyncing && "text-emerald/80"
              )}
            >
              {value}
            </motion.span>
          </AnimatePresence>
          {isSyncing && (
            <Zap className="w-3 h-3 text-emerald/40 animate-pulse" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
