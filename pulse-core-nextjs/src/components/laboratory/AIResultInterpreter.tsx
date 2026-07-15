'use client';

import { useState } from 'react';
import {
    Sparkles,
    Activity,
    ChevronRight,
    AlertTriangle,
    BrainCircuit,
    Zap,
    RefreshCcw,
    Microscope,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

export default function AIResultInterpreter() {
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState<any[] | null>(null);

    const performAnalysis = async () => {
        setAnalyzing(true);
        try {
            // In a real scenario, we'd pass actual report data. 
            // For now, we'll pass the current mock results as "data" to get a realistic correlation from Gemini.
            const mockData = [
                { parameter: 'Hemoglobin (Hgb)', value: '11.2 g/dL', normal: '13.5-17.5' },
                { parameter: 'HCT', value: '34 %', normal: '41-53' },
                { parameter: 'WBC Count', value: '4.8 K/uL', normal: '4.5-11.0' },
                { parameter: 'Platelets', value: '142 K/uL', normal: '150-450' }
            ];

            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'lab',
                    data: { results: mockData }
                })
            });

            const data = await response.json();
            if (data.results) {
                setResults(data.results);
            } else {
                throw new Error(data.error || 'Failed to interpret lab results');
            }
        } catch (error) {
            logger.error('Lab AI Error', { error });
            setResults([
                { parameter: 'Analysis Error', value: 'N/A', normal: 'N/A', status: 'Error', clinical: 'Could not connect to interpretation engine.' }
            ]);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="bg-slate-900 rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-full relative">
            {/* Decorative Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
            <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -ml-32 -mt-32 animate-pulse" />

            <div className="p-8 relative z-10 flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                            <BrainCircuit className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white font-outfit tracking-tight">AI Lab Assistant</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Assistant Ready</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={performAnalysis}
                        disabled={analyzing}
                        className={cn(
                            'px-8 py-4 rounded-2xl font-bold text-xs flex items-center gap-3 transition-all active:scale-95 shadow-xl',
                            analyzing
                                ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20'
                        )}
                    >
                        {analyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {analyzing ? 'Interpreting Data...' : 'Start AI Interpretation'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {!results && !analyzing && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[40px]">
                            <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mb-6">
                                <Microscope className="w-10 h-10 text-slate-800" />
                            </div>
                            <h4 className="text-white font-bold text-lg mb-2">Awaiting Data Input</h4>
                            <p className="text-slate-500 text-sm font-medium max-w-[320px]">Upload or select a lab report to get interpretation support and clinical notes.</p>
                        </div>
                    )}

                    {analyzing && (
                        <div className="space-y-6">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4 animate-pulse">
                                <div className="w-10 h-10 rounded-xl bg-white/10" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-32 bg-white/10 rounded" />
                                    <div className="h-3 w-full bg-white/10 rounded" />
                                </div>
                            </div>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-white/5 rounded-2xl border border-white/5 animate-pulse" />
                            ))}
                        </div>
                    )}

                    {results && !analyzing && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="flex items-center justify-between px-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Insights</h4>
                                </div>
                                <p className="text-xs text-emerald-600 font-bold bg-emerald-50/50 px-2 py-1 rounded-full border border-emerald-100/50">POWERED BY GEMINI 3.1 PRO</p>
                            </div>

                            {results.map((res, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'p-6 rounded-[24px] border transition-all hover:bg-white/[0.04] group cursor-default',
                                        res.status === 'Low' ? 'bg-rose-500/5 border-rose-500/20' :
                                            res.status === 'Normal' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                                'bg-amber-500/5 border-amber-500/20'
                                    )}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                'w-10 h-10 rounded-xl flex items-center justify-center border',
                                                res.status === 'Low' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                                    res.status === 'Normal' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                        'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                            )}>
                                                <Activity className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white uppercase tracking-tight">{res.parameter}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Reference: {res.normal}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Value Found</div>
                                                <div className={cn(
                                                    'text-lg font-black font-outfit',
                                                    res.status === 'Low' ? 'text-rose-400' :
                                                        res.status === 'Normal' ? 'text-emerald-400' :
                                                            'text-amber-400'
                                                )}>{res.value}</div>
                                            </div>
                                            <div className={cn(
                                                'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border',
                                                res.status === 'Low' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                    res.status === 'Normal' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                        'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            )}>
                                                {res.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 flex gap-3">
                                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
                                            <span className="text-indigo-400 font-bold not-italic font-outfit text-[10px] uppercase tracking-widest mr-2 underline decoration-indigo-500/30 underline-offset-4">Clinical Note:</span>
                                            {res.clinical}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Powered by Gemini 3.1 Pro</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500/50" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Verify abnormal results manually</span>
                        </div>
                    </div>
                    <button className="flex items-center gap-2 text-[10px] font-bold text-white bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-all uppercase tracking-widest">
                        Export Analysis
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
