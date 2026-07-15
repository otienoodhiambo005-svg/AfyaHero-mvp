'use client';

import { X, BrainCircuit } from 'lucide-react';

interface ClinicalAlertProps {
  acknowledged: boolean;
  onAcknowledge: () => void;
}

export function ClinicalAlert({ acknowledged, onAcknowledge }: ClinicalAlertProps) {
  if (acknowledged) return null;

  return (
    <div 
      className="bg-content-bg p-6 flex gap-6 shadow-card staggered-fade-in [--delay:300ms] border-l-4 border-l-red-500 rounded-r-2xl border border-content-border/60" 
    >
      <div className="w-14 h-14 rounded-card flex items-center justify-center shrink-0 shadow-lg bg-charcoal text-red-400 border border-white/5">
        <BrainCircuit className="w-8 h-8" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] font-mono text-charcoal opacity-40">Clinical Decision Support</span>
          <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-100 shadow-card">Critical Alert</span>
        </div>
        <p className="text-lg text-charcoal leading-relaxed font-serif tracking-tight">
          <strong className="font-bold">Emergency Lab Signal:</strong> Hassan Ali (ID: T-042) presents <span className="text-red-600 font-bold underline decoration-red-600/20 underline-offset-4">Hyperkalemia (K⁺ 6.8 mEq/L)</span>. 
          Cardiac stabilization protocol required. Bedside review initiated.
        </p>
      </div>
      <button
        onClick={onAcknowledge}
        className="shrink-0 h-fit p-2.5 hover:bg-content-surface rounded-card transition-all border border-transparent hover:border-content-border/50"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
