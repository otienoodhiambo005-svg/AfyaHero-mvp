'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  BrainCircuit, ArrowRight, CheckCircle2, Clock, 
  Sparkles, PackagePlus, Zap 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInventoryIntelligence, InventoryInsight } from '@/hooks/useInventoryIntelligence';

export function AutoReorderPanel() {
  const { insights, isAnalyzing, runAnalysis } = useInventoryIntelligence();

  return (
    <div className="bg-content-bg rounded-card border border-content-border overflow-hidden shadow-card">
      <div className="bg-content-surface/80 px-6 py-4 border-b border-content-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Inventory Intelligence</h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Active AI Optimization</p>
          </div>
        </div>
        <button 
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 text-xs font-bold hover:bg-cyan-100 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Zap className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {isAnalyzing ? 'Analyzing...' : 'Refresh AI'}
        </button>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {insights.map((insight, idx) => (
              <InsightCard key={insight.drugName} insight={insight} index={idx} />
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-6 pt-6 border-t border-content-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Integration</span>
            </div>
            <button className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-700">
              Go to Full Insights <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ insight, index }: Readonly<{ insight: InventoryInsight; index: number }>) {
  const colors = {
    high: 'border-rose-200 bg-rose-50/50 text-rose-700',
    medium: 'border-amber-200 bg-amber-50/50 text-amber-700',
    low: 'border-cyan-200 bg-cyan-50/50 text-cyan-700',
  };

  const priorityStyles = {
    high: 'bg-rose-100 border-rose-200',
    medium: 'bg-amber-100 border-amber-200',
    low: 'bg-cyan-100 border-cyan-200',
  };

  const icons = {
    reorder: <PackagePlus className="w-4 h-4" />,
    expiry: <Clock className="w-4 h-4" />,
    optimization: <Zap className="w-4 h-4" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "group relative p-4 rounded-card border transition-all hover:shadow-md",
        colors[insight.severity]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {icons[insight.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-bold truncate tracking-tight">{insight.drugName}</h4>
            <span className={cn(
              "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border",
              priorityStyles[insight.severity]
            )}>
              {insight.severity} Priority
            </span>
          </div>
          <p className="text-xs font-semibold opacity-90">{insight.reason}</p>
          <p className="text-[11px] mt-2 opacity-70 leading-relaxed italic">
            Recommendation: {insight.recommendation}
          </p>
          
          <div className="mt-4 flex items-center gap-2">
            <button className="flex-1 py-1.5 rounded-lg bg-content-bg/80 border border-current font-bold text-[11px] shadow-card hover:bg-content-bg transition-colors flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {insight.actionLabel}
            </button>
            <button className="p-1.5 rounded-lg bg-content-bg/50 hover:bg-content-bg/80 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
