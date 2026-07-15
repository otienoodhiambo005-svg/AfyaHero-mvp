'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  Activity, 
  Heart, 
  Thermometer, 
  Droplet, 
  Wind,
  Plus,
  AlertCircle,
  TrendingUp,
  History,
  Timer,
  ChevronRight,
  ChevronDown,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import type { PatientVitals, VitalTrend } from './types';


function generateTrend(min: number, max: number): VitalTrend[] {
  return Array.from({ length: 6 }).map((_, i) => ({
    time: `${10 + i}:00`,
    value: Math.floor(Math.random() * (max - min + 1)) + min
  }));
}

export function VitalsMonitor() {
  const [patients, setPatients] = useState<PatientVitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEntryMode, setIsEntryMode] = useState(false);

  const loadVitals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/medical/nurse/vitals', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load vitals (${res.status})`);
      const data = await res.json();
      setPatients(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      logger.error('Failed to load vitals', { error: err });
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadVitals(); }, [loadVitals]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-content-border/50 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Real-time Telemetry Buffer</span>
            </div>
          </div>
          <h1 className="text-5xl font-serif text-ink font-black tracking-tighter leading-none grayscale hover:grayscale-0 transition-all duration-700">
            Vital Signs <span className="text-slate-300 italic font-medium">& Trends</span>
          </h1>
        </div>

        <button 
          onClick={() => setIsEntryMode(true)}
          className="bg-slate-900 px-10 py-5 rounded-full text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 hover:bg-emerald-700 transition-all shadow-2xl shadow-slate-900/30 active:scale-95 group"
        >
          <div className="w-6 h-6 rounded-lg bg-content-bg/10 flex items-center justify-center border border-white/10 group-hover:rotate-90 transition-transform duration-500">
            <Plus className="w-4 h-4" />
          </div>
          Rapid Entry Capture
        </button>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {patients.map((patient) => (
          <motion.div 
            key={patient.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-content-bg rounded-[4rem] border border-content-border/50 p-12 hover:shadow-[0_64px_120px_-30px_rgba(0,0,0,0.1)] transition-all duration-700 relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-64 h-64 bg-content-surface rounded-full blur-[80px] -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
             
             <div className="flex flex-col xl:flex-row items-center gap-12 relative z-10">
                <div className="space-y-6 min-w-[300px] xl:pr-12 xl:border-r border-content-border/50">
                   <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-20 h-20 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black font-serif shadow-2xl border-4 border-white",
                        patient.status === 'critical' ? 'bg-rose-500 shadow-rose-500/30' : 'bg-blue-600 shadow-blue-500/30'
                      )}>
                        {patient.patientName[0]}
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono italic">Unit {patient.bed}</p>
                         <h3 className="text-3xl font-serif font-black text-ink tracking-tight leading-none mt-1">{patient.patientName}</h3>
                         <div className="flex items-center gap-2 mt-2">
                           <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", patient.status === 'critical' ? 'bg-rose-500' : 'bg-emerald-500')} />
                           <span className={cn("text-[9px] font-black uppercase tracking-widest", patient.status === 'critical' ? 'text-rose-500' : 'text-emerald-500')}>{patient.status} status</span>
                         </div>
                      </div>
                   </div>

                   <div className="p-6 rounded-[2rem] bg-content-surface border border-content-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Stability Index</span>
                         <span className="text-[10px] font-bold text-ink font-mono">92.4%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: '92.4%' }} />
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-content-border/50">
                         <Clock className="w-3.5 h-3.5 text-slate-300" />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Last capture: {patient.lastUpdated}</span>
                      </div>
                   </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
                   <MetricCard 
                     icon={<Heart className="w-5 h-5 text-rose-500" />}
                     label="Heart Rate"
                     value={patient.metrics.hr.value}
                     unit="BPM"
                     trend={patient.metrics.hr.trend}
                     color="rose"
                   />
                   <MetricCard 
                     icon={<Activity className="w-5 h-5 text-blue-500" />}
                     label="Blood Pressure"
                     value={`${patient.metrics.bp.sys}/${patient.metrics.bp.dia}`}
                     unit="mmHg"
                     trend={patient.metrics.bp.trend}
                     color="blue"
                   />
                   <MetricCard 
                     icon={<Wind className="w-5 h-5 text-emerald-500" />}
                     label="SpO2"
                     value={patient.metrics.spo2.value}
                     unit="%"
                     trend={patient.metrics.spo2.trend}
                     color="emerald"
                   />
                   <MetricCard 
                     icon={<Thermometer className="w-5 h-5 text-amber-500" />}
                     label="Temperature"
                     value={patient.metrics.temp.value}
                     unit="°C"
                     trend={patient.metrics.temp.trend}
                     color="amber"
                   />
                </div>
             </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  unit, 
  trend, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  unit: string; 
  trend: VitalTrend[];
  color: 'rose' | 'blue' | 'emerald' | 'amber';
}) {
  const colors = {
    rose: 'bg-rose-50 border-rose-100 text-rose-500',
    blue: 'bg-blue-50 border-blue-100 text-blue-500',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-500',
    amber: 'bg-amber-50 border-amber-100 text-amber-500'
  };

  return (
    <div className={cn("p-8 rounded-[3rem] border transition-all hover:scale-105 duration-500", colors[color])}>
       <div className="flex items-center justify-between mb-6">
          <div className="w-10 h-10 rounded-card bg-content-bg flex items-center justify-center border shadow-card">
             {icon}
          </div>
          <TrendingUp className="w-4 h-4 opacity-20" />
       </div>
       <div className="space-y-1">
          <p className="text-3xl font-black font-serif tracking-tight leading-none text-ink">{value}</p>
          <p className="text-[10px] font-black opacity-60 uppercase tracking-widest font-mono">{unit} {label}</p>
       </div>
       <div className="mt-8 flex items-end gap-1 h-8">
          {trend.map((t, i) => (
            <div 
              key={i} 
              className={cn("w-full rounded-full bg-current opacity-20")} 
              style={{ height: `${(t.value / 150) * 100}%` }}
            />
          ))}
       </div>
    </div>
  );
}
