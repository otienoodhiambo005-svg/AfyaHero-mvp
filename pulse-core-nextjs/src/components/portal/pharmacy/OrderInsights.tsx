'use client';

import { motion } from 'framer-motion';
import { Sparkles, PackagePlus, ArrowRight, CheckCircle2, ShoppingCart, Truck } from 'lucide-react';
import { useInventoryIntelligence } from '@/hooks/useInventoryIntelligence';
import { cn } from '@/lib/utils';

export function OrderInsights() {
  const { insights } = useInventoryIntelligence();
  const reorderItems = insights.filter(i => i.type === 'reorder' || i.type === 'optimization');

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-card p-6 text-white overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="w-24 h-24" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-black uppercase tracking-widest text-cyan-400">
              AI Supply Chain
            </div>
            <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              84% Efficiency
            </div>
          </div>
          
          <h2 className="text-xl font-black tracking-tight mb-2">Smart Replenishment Suggestions</h2>
          <p className="text-slate-400 text-sm max-w-md">
            AI has analyzed clinic consumption and regional disease trends. 
            <span className="text-white font-semibold"> {reorderItems.length} essential reorders</span> are staged for your approval.
          </p>
          
          <div className="mt-6 flex items-center gap-3">
            <button className="px-4 py-2 rounded-card bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-600/20">
              <CheckCircle2 className="w-4 h-4" /> Approve All & Create POs
            </button>
            <button className="px-4 py-2 rounded-card bg-content-bg/10 hover:bg-content-bg/20 text-white text-xs font-bold transition-all flex items-center gap-2">
              View Detailed Projections <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reorderItems.map((item, idx) => (
          <motion.div
            key={item.drugName}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group bg-content-bg rounded-card border border-content-border p-4 hover:border-cyan-500/40 hover:shadow-md transition-all cursor-default"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-content-surface group-hover:bg-cyan-50 transition-colors">
                <Truck className="w-4 h-4 text-slate-400 group-hover:text-cyan-600" />
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                item.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-cyan-100 text-cyan-700'
              )}>
                {item.severity} Priority
              </span>
            </div>
            
            <h4 className="font-bold text-ink mb-1">{item.drugName}</h4>
            <p className="text-[11px] text-slate-500 mb-4 line-clamp-2">{item.recommendation}</p>
            
            <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Est. Lead Time: 24h</span>
              <button className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-700">
                Generate <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
