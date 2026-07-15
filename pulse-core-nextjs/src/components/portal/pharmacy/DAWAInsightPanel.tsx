'use client';

import { 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  ArrowRight,
  TrendingDown,
  Activity,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DAWAInsightPanel() {
  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-emerald-900/40 relative overflow-hidden group h-full flex flex-col">
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-emerald-400/10 transition-all duration-1000" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full -ml-32 -mb-32 blur-2xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 bg-emerald-900/60 rounded-card flex items-center justify-center border border-emerald-500/20 shadow-inner">
            <Sparkles className="w-7 h-7 text-emerald-100" />
          </div>
          <div>
            <h3 className="font-serif text-2xl tracking-tight font-bold">DAWA Intelligence</h3>
            <p className="text-emerald-100/70 text-[10px] font-black uppercase tracking-[0.2em] font-mono">Predictive Supply Logic</p>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          <div className="bg-emerald-900/50 rounded-3xl p-6 border border-emerald-500/10 hover:bg-emerald-900/60 transition-all cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100">Stock Optimization</span>
              </div>
              <span className="text-[10px] font-black text-emerald-400 font-mono">+18% Efficiency</span>
            </div>
            <p className="text-sm text-emerald-50 leading-relaxed font-serif">
                Usage patterns suggest increasing <span className="text-white font-bold border-b border-white/30 pb-0.5">Metformin 500mg</span> stock by 200 units before the weekend outpatient spike.
            </p>
          </div>

          <div className="bg-emerald-900/50 rounded-3xl p-6 border border-emerald-500/10 hover:bg-emerald-900/60 transition-all cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100">Waste Mitigation</span>
              </div>
              <span className="text-[10px] font-black text-amber-400 font-mono">Critical Alert</span>
            </div>
            <p className="text-sm text-emerald-50 leading-relaxed font-serif">
                Batch <span className="text-white font-bold font-mono">#BN-2024-X</span> of Artemether/Lumefantrine expires in 12 days. Suggesting priority dispensing for pediatric ward.
            </p>
          </div>

          <div className="bg-emerald-900/50 rounded-3xl p-6 border border-emerald-500/10 hover:bg-emerald-900/60 transition-all cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100">Revenue Analysis</span>
              </div>
              <span className="text-[10px] font-black text-blue-400 font-mono">Stable</span>
            </div>
            <p className="text-sm text-emerald-50 leading-relaxed font-serif">
                M-Pesa transaction velocity has increased by 14.2% since 09:00 AM. Digital queue conversion is high.
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-4">
            <button className="w-full group/btn bg-content-bg text-emerald-900 px-8 py-5 rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-50 transition-all shadow-2xl active:scale-95">
              Generate Logic Report
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center justify-center gap-2 py-4">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span className="text-[8px] font-black text-emerald-100/50 uppercase tracking-widest">Compliant with Pharm. Clinical Guidelines V4.2</span>
            </div>
        </div>
      </div>
    </div>
  );
}
