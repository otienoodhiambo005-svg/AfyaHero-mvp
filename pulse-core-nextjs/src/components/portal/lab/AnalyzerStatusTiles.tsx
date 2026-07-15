'use client';

import { useState, useEffect } from 'react';
import { 
  Microscope, 
  Activity, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Zap,
  Clock,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EquipmentStatus = 'idle' | 'running' | 'calibrating' | 'error' | 'offline';

interface Analyzer {
  id: string;
  name: string;
  type: string;
  status: EquipmentStatus;
  load: number; // Percentage
  uptime: string;
  lastMaintenance: string;
  errorCount: number;
}

const ANALYZERS: Analyzer[] = [
  {
    id: 'SYS-XN-1000',
    name: 'Sysmex XN-1000',
    type: 'Hematology',
    status: 'running',
    load: 78,
    uptime: '99.2%',
    lastMaintenance: '2d ago',
    errorCount: 0,
  },
  {
    id: 'COBAS-C311',
    name: 'Cobas C311',
    type: 'Chemistry',
    status: 'idle',
    load: 0,
    uptime: '98.5%',
    lastMaintenance: '12d ago',
    errorCount: 2,
  },
  {
    id: 'FINE-FIA-1',
    name: 'Finecare FIA',
    type: 'Immunoassay',
    status: 'calibrating',
    load: 100,
    uptime: '99.9%',
    lastMaintenance: '5h ago',
    errorCount: 0,
  },
];

const STATUS_CONFIG: Record<EquipmentStatus, { label: string; color: string; icon: any }> = {
  idle: { label: 'Ready', color: 'text-slate-400', icon: Clock },
  running: { label: 'Active', color: 'text-emerald-500', icon: Activity },
  calibrating: { label: 'Calibrating', color: 'text-violet-500', icon: Settings },
  error: { label: 'Attention', color: 'text-rose-500', icon: AlertCircle },
  offline: { label: 'Offline', color: 'text-slate-300', icon: Zap },
};

export function AnalyzerStatusTiles() {
  const [analyzers, setAnalyzers] = useState<Analyzer[]>(ANALYZERS);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {analyzers.map((analyzer) => {
        const Config = STATUS_CONFIG[analyzer.status];
        return (
          <div 
            key={analyzer.id}
            className="group relative bg-content-bg border border-content-border rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 overflow-hidden"
          >
            {/* Background Accent */}
            <div className={cn(
              "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-110",
              analyzer.status === 'running' ? "bg-emerald-500" : "bg-violet-500"
            )} />

            <div className="flex items-start justify-between mb-8">
              <div className="w-16 h-16 rounded-3xl bg-content-surface flex items-center justify-center border border-content-border/50 transition-colors group-hover:bg-violet-50 group-hover:border-violet-100">
                <Microscope className="w-8 h-8 text-violet-600" />
              </div>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-card text-[10px] font-black uppercase tracking-widest bg-content-surface border border-content-border/50",
                Config.color
              )}>
                <Config.icon className="w-3.5 h-3.5" />
                {Config.label}
              </div>
            </div>

            <div className="space-y-1 mb-8">
              <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{analyzer.type}</p>
              <h3 className="text-xl font-serif text-charcoal font-bold">{analyzer.name}</h3>
              <p className="text-xs text-slate-500 font-medium">{analyzer.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-content-border/50">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 font-mono">Integration</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-charcoal tracking-tight font-serif">HL7 Active</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 font-mono">Load</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-violet-600 rounded-full transition-all duration-1000" 
                      style={{ width: `${analyzer.load}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-ink font-mono">{analyzer.load}%</span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between p-4 bg-content-surface rounded-card border border-content-border/50">
                <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Uptime</p>
                    <p className="text-xs font-bold text-charcoal">{analyzer.uptime}</p>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Errors</p>
                    <p className={cn("text-xs font-bold", analyzer.errorCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                        {analyzer.errorCount}
                    </p>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Maint.</p>
                    <p className="text-xs font-bold text-charcoal">{analyzer.lastMaintenance}</p>
                </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
