'use client';

import { Sparkles, BrainCircuit } from 'lucide-react';

export function DAWAInsightCard() {
  return (
    <div className="bg-content-bg p-8 text-ink shadow-2xl space-y-5 rounded-[2.5rem] border border-content-border relative overflow-hidden group">
       <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-1000">
          <BrainCircuit className="w-48 h-48 text-blue-600" />
       </div>
       <div className="flex items-center gap-3 text-blue-600 relative z-10">
          <div className="w-10 h-10 rounded-card bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] font-mono">DAWA Clinical AI</span>
       </div>
       <p className="text-lg font-serif italic text-ink/90 leading-relaxed relative z-10">
          &ldquo;Dr. Amina, based on clinical review, <strong className="text-blue-600">Grace Abuya</strong> is optimized for discharge. All post-op markers are normal.&rdquo;
       </p>
       <div className="pt-4 relative z-10">
          <button className="premium-button-primary w-full shadow-blue-600/20 uppercase tracking-widest text-xs font-black py-4 rounded-card">
             Generate Ward Discharge Orders
          </button>
       </div>
    </div>
  );
}
