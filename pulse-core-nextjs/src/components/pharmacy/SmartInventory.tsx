'use client';

import { useState, useEffect } from 'react';
import {
    Sparkles,
    TrendingUp,
    Package,
    RefreshCcw,
    Zap,
    BarChart3,
    Calendar,
    Layers,
    ArrowUpRight,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

export default function SmartInventory() {
    const [analyzing, setAnalyzing] = useState(false);
    const [predictions, setPredictions] = useState<any[] | null>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pharmacy_inventory')
            .select('*')
            .order('medication_name', { ascending: true });

        if (!error && data) {
            setInventory(data);
        }
        setLoading(false);
    };

    const runAnalysis = async () => {
        if (inventory.length === 0) return;

        setAnalyzing(true);
        try {
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'inventory',
                    data: inventory
                })
            });

            const data = await response.json();
            if (data.results) {
                setPredictions(data.results);
            } else {
                throw new Error(data.error || 'Failed to get AI insights');
            }
        } catch (error) {
            logger.error('AI Analysis Error', { error });
            // Fallback mock predictions if API fails
            setPredictions([
                { item: 'Analysis failed', usage: 'N/A', prediction: 'Check API connectivity', suggestion: 'Retry in a few moments' }
            ]);
        } finally {
            setAnalyzing(false);
        }
    };

    const growthTrend = '+24%';
    const efficiency = '94%';
    const turnover = '18.2x';

    return (
        <div className="bg-[#0C1510] rounded-[48px] border border-emerald-500/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full relative group">
            {/* Dynamic Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald/10 blur-[140px] -mr-48 -mt-48 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-forest-light/10 blur-[120px] -ml-40 -mb-40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0,transparent_70%)]" />

            <div className="p-10 relative z-10 flex flex-col h-full font-sans">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-emerald/10 rounded-2xl flex items-center justify-center border border-emerald/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                            <Sparkles className="w-9 h-9 text-emerald" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-semibold text-white tracking-tight font-serif">AI Inventory Intelligence</h3>
                            <div className="flex items-center gap-2.5 mt-1">
                                <span className="flex h-2 w-2 rounded-full bg-emerald animate-pulse" />
                                <p className="text-sage text-[10px] font-bold uppercase tracking-[0.2em] font-mono">Predictive Neural Engine • Active</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={runAnalysis}
                        disabled={analyzing || loading}
                        className={cn(
                            'px-8 py-4 rounded-2xl font-bold text-xs flex items-center gap-3 transition-all active:scale-95 shadow-2xl uppercase tracking-widest',
                            analyzing || loading
                                ? 'bg-white/5 text-sage cursor-not-allowed border border-white/5'
                                : 'bg-emerald text-white hover:bg-emerald/90 shadow-emerald/20 border border-white/10'
                        )}
                    >
                        {analyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {analyzing ? 'Synthesizing...' : 'Run Intelligence Forecast'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="p-6 rounded-[32px] bg-ink/40 border border-white/5 flex flex-col gap-3 transition-all hover:bg-forest/40 hover:border-emerald/20 shadow-xl group/card">
                        <div className="flex items-center gap-2 text-sage">
                            <TrendingUp className="w-4 h-4 text-emerald" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono">Velocity Vector</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight font-sans">{growthTrend} <span className="text-xs text-emerald font-medium ml-1">Positive Shift</span></div>
                    </div>
                    <div className="p-6 rounded-[32px] bg-ink/40 border border-white/5 flex flex-col gap-3 transition-all hover:bg-forest/40 hover:border-emerald/20 shadow-xl group/card">
                        <div className="flex items-center gap-2 text-sage">
                            <BarChart3 className="w-4 h-4 text-emerald" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono">Node Turnover</span>
                            <ArrowUpRight className="w-4 h-4 text-emerald ml-auto opacity-40 group-hover/card:opacity-100" />
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight font-sans">{turnover}</div>
                    </div>
                    <div className="p-6 rounded-[32px] bg-ink/40 border border-white/5 flex flex-col gap-3 transition-all hover:bg-forest/40 hover:border-emerald/20 shadow-xl group/card">
                        <div className="flex items-center gap-2 text-sage">
                            <Layers className="w-4 h-4 text-emerald" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono">Supply Precision</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight font-sans">{efficiency}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-ink/20 rounded-[40px] border border-white/5">
                            <Loader2 className="w-12 h-12 animate-spin text-emerald mb-6 shadow-emerald/20" />
                            <p className="text-sage text-[10px] font-bold uppercase tracking-[0.3em] font-mono opacity-60">Synchronizing Global Supply Matrix...</p>
                        </div>
                    ) : !predictions && !analyzing ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-ink/20 border-2 border-dashed border-white/10 rounded-[40px] hover:border-emerald/30 transition-all duration-700">
                            <div className="w-20 h-20 bg-forest/40 rounded-full flex items-center justify-center mb-8 border border-white/5 shadow-inner">
                                <Package className="w-10 h-10 text-forest-light opacity-40 group-hover:text-emerald group-hover:opacity-100 transition-all" />
                            </div>
                            <p className="text-sage text-sm font-medium max-w-[320px] leading-relaxed">Initiate the neural forecast engine to synthesize predictive restocking matrices and usage drift analysis across {inventory.length} active supply nodes.</p>
                        </div>
                    ) : analyzing ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-28 bg-white/5 rounded-2xl border border-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : predictions && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="flex items-center justify-between px-4 mb-4">
                                <h4 className="text-[10px] font-bold text-sage uppercase tracking-[0.25em] font-mono">Intelligence Output</h4>
                                <p className="text-[10px] text-emerald font-bold bg-emerald/10 px-3 py-1 rounded-full border border-emerald/20 tracking-widest uppercase">POWERED BY GEMINI 3.1 PRO</p>
                            </div>
                            {predictions.map((p, i) => (
                                <div key={i} className="p-8 rounded-[36px] bg-ink/40 border border-white/5 hover:bg-forest/40 hover:border-emerald/30 transition-all duration-500 group/item shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald/5 blur-3xl -mr-16 -mt-16 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-forest/50 rounded-2xl flex items-center justify-center text-emerald border border-white/5 shadow-inner">
                                                <Package className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-white tracking-tight">{p.item}</div>
                                                <div className="text-[10px] font-bold text-sage uppercase tracking-[0.15em] font-mono mt-1">Audit Flux: <span className="text-emerald">{p.usage}</span></div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-2 font-mono">Neural Forecast</div>
                                            <div className={cn(
                                                'text-[10px] font-extrabold px-3 py-1 rounded-xl border tracking-widest',
                                                p.prediction.includes('shortage')
                                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    : 'bg-emerald/10 text-emerald border-emerald/20'
                                            )}>
                                                {p.prediction.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
                                        <div className="flex items-center gap-3 text-xs text-mist font-medium italic">
                                            <Zap className="w-4 h-4 text-emerald" />
                                            {p.suggestion}
                                        </div>
                                        <button className="text-[10px] font-bold text-white bg-emerald px-5 py-2.5 rounded-xl shadow-lg shadow-emerald/20 hover:bg-emerald/90 transition-all opacity-0 group-hover/item:opacity-100 uppercase tracking-widest active:scale-95">
                                            Execute Protocol
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between text-sage relative z-10">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 bg-emerald rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono opacity-60">Model: Gemini 3.1 Pro Node</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-emerald/40" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono opacity-60">Cycle: Next Retrain 03.2026</span>
                        </div>
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.5em] font-mono opacity-20">Secure Intelligence Framework</div>
                </div>
            </div>
        </div>
    );
}
