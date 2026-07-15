'use client';

import { 
  User as UserIcon, 
  Activity, 
  MapPin, 
  Calendar,
  Stethoscope,
  ShieldCheck,
  Zap,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StatusBadge, StatusType } from './StatusBadge';

interface BedTileProps {
  bed: {
    id: string;
    bed_number: string;
    status: string;
    patient_name?: string;
    ward_name: string;
    notes?: string;
    admitted_at?: string;
    priority?: 'low' | 'medium' | 'high';
  };
  isSelected?: boolean;
  onClick: () => void;
}

export function BedTile({ bed, isSelected, onClick }: BedTileProps) {
  const isOccupied = bed.status === 'occupied';
  
  return (
    <motion.button
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col h-[340px] w-full text-left rounded-[4rem] p-10 transition-all duration-150 overflow-hidden",
        isSelected 
          ? "bg-[#080F0C] border-emerald-500/30 shadow-[0_48px_100px_-20px_rgba(0,0,0,0.5)] z-10" 
          : "bg-content-bg border-content-border/50 hover:border-content-border hover:shadow-2xl shadow-card border-2"
      )}
    >
      {/* Visual Depth Layers - removed decorative gradients */}
      
      {/* High-Fidelity Glow */}
      <div className={cn(
        "absolute -inset-px rounded-[4rem] transition-all duration-150 pointer-events-none border-2",
        isSelected ? "border-emerald-500/40 shadow-[inset_0_0_40px_rgba(16,185,129,0.1)]" : "border-transparent"
      )} />

      {/* Header Module */}
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="space-y-1">
          <h3 className={cn(
              "text-4xl font-serif font-black tracking-tighter transition-all duration-150 leading-none",
              isSelected ? "text-emerald-50" : "text-ink group-hover:text-emerald-700 group-hover:tracking-tight"
          )}>
            {bed.bed_number}
          </h3>
          <div className={cn(
              "flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-[0.2em] transition-all",
              isSelected ? "text-emerald-500/50" : "text-slate-400 group-hover:text-slate-600"
          )}>
            <div className={cn("w-1 h-1 rounded-full", isSelected ? 'bg-emerald-500/40' : 'bg-slate-300')} />
            <span>{bed.ward_name} Unit</span>
          </div>
        </div>
        <div className="translate-y-1">
            <StatusBadge status={bed.status as StatusType} />
        </div>
      </div>

      {/* Center Intelligence Module */}
      <div className="flex-1 flex flex-col justify-center relative z-10">
        {isOccupied ? (
          <div className="space-y-8">
            <div className="flex items-center gap-5">
              <div className={cn(
                  "w-14 h-14 rounded-[1.75rem] flex items-center justify-center border-2 transition-all duration-150 group-hover:rotate-6 shadow-2xl shadow-emerald-950/20",
                  isSelected 
                    ? "bg-emerald-500 border-emerald-400 text-ink" 
                    : "bg-slate-900 border-slate-800 text-white"
              )}>
                <UserIcon className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className={cn(
                    "text-[9px] font-black uppercase tracking-[0.2em] mb-1.5 font-mono",
                    isSelected ? "text-emerald-500/40" : "text-slate-400"
                )}>Observed Occupant</p>
                <h4 className={cn(
                    "text-xl font-bold truncate tracking-tight font-serif",
                    isSelected ? "text-white" : "text-ink"
                )}>{bed.patient_name || 'Anonymous Registry'}</h4>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className={cn(
                  "flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500",
                  isSelected ? "bg-content-bg/5 border-white/10 group-hover:bg-content-bg/10" : "bg-content-surface border-content-border/50 group-hover:bg-emerald-50 group-hover:border-emerald-100"
              )}>
                <Stethoscope className={cn("w-4 h-4 shrink-0 transition-colors", isSelected ? "text-emerald-500" : "text-slate-400 group-hover:text-emerald-500")} />
                <span className={cn(
                    "text-xs font-bold truncate tracking-tight leading-none",
                    isSelected ? "text-emerald-50/80" : "text-slate-600"
                )}>{bed.notes || 'Clinical Intake: Pending Rounds'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-6 opacity-20 group-hover:opacity-100 group-hover:translate-y-[-4px] transition-all duration-150">
            <div className={cn(
                "w-20 h-20 rounded-[2.5rem] border-2 border-dashed flex items-center justify-center transition-colors shadow-card",
                isSelected ? "border-emerald-500/20 bg-emerald-500/5" : "border-content-border bg-content-surface"
            )}>
                <Activity className={cn("w-10 h-10 transition-colors", isSelected ? "text-emerald-500" : "text-slate-200 group-hover:text-emerald-300")} />
            </div>
            <p className={cn(
                "text-[10px] font-black uppercase tracking-[0.4em] text-center font-mono transition-colors",
                isSelected ? "text-emerald-500" : "text-slate-300 group-hover:text-emerald-500"
            )}>Module Available</p>
          </div>
        )}
      </div>

      {/* Telemetry Footer */}
      <div className={cn(
          "mt-10 flex items-center justify-between border-t pt-8 relative z-10",
          isSelected ? "border-white/5" : "border-slate-50"
      )}>
        <div className="flex items-center gap-3">
            {isSelected ? (
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Live Telemetry</span>
                </div>
            ) : (
                <div className={cn(
                    "flex items-center gap-2 group/time transition-opacity",
                    isOccupied ? "opacity-100" : "opacity-0"
                )}>
                    <Clock className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[9px] font-black font-mono tracking-widest uppercase text-slate-300 group-hover:text-slate-500 transition-colors">
                        {bed.admitted_at ? new Date(bed.admitted_at).toLocaleDateString('en-GB') : 'Ready'}
                    </span>
                </div>
            )}
        </div>
        
        <div className="flex items-center gap-2">
            {isOccupied && bed.priority === 'high' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-600 rounded-[1.25rem] shadow-xl shadow-rose-950/40 border border-rose-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-content-bg animate-pulse" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest font-mono leading-none">CRITICAL</span>
                </div>
            )}
            <div className={cn(
                "w-10 h-10 rounded-card flex items-center justify-center transition-all duration-500 border group-hover:border-emerald-500/20 group-hover:bg-emerald-500/5",
                isSelected ? "border-white/10 bg-content-bg/5 text-emerald-500" : "border-content-border/50 bg-content-surface text-slate-300 group-hover:text-emerald-500"
            )}>
                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
        </div>
      </div>
    </motion.button>
  );
}
