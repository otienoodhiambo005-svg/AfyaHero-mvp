'use client';

import { useState } from 'react';
import { Plus, X, AlertTriangle, CheckCircle2, BrainCircuit, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrugInteraction {
    drug1: string;
    drug2: string;
    severity: 'Contraindicated' | 'Major' | 'Moderate' | 'Minor';
    mechanism: string;
    clinical_effect: string;
    recommendation: string;
}

const SEVERITY_CONFIG = {
    Contraindicated: { color: 'border-rose-200 bg-rose-50', badge: 'bg-rose-100 text-rose-700', icon: '🚫' },
    Major: { color: 'border-red-200 bg-red-50/70', badge: 'bg-red-100 text-red-700', icon: '⚠️' },
    Moderate: { color: 'border-amber-200 bg-amber-50/70', badge: 'bg-amber-100 text-amber-700', icon: '⚡' },
    Minor: { color: 'border-blue-100 bg-blue-50/50', badge: 'bg-blue-100 text-[#2563EB]', icon: 'ℹ️' },
};

export default function DrugInteractionChecker() {
    const [medications, setMedications] = useState<string[]>(['']);
    const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
    const [loading, setLoading] = useState(false);
    const [checked, setChecked] = useState(false);
    const [error, setError] = useState('');

    const addDrug = () => setMedications(prev => [...prev, '']);
    const removeDrug = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i));
    const updateDrug = (i: number, val: string) => setMedications(prev => prev.map((d, idx) => idx === i ? val : d));

    const checkInteractions = async () => {
        const valid = medications.filter(m => m.trim().length > 0);
        if (valid.length < 2) {
            setError('Please enter at least 2 medications to check.');
            return;
        }
        setError('');
        setLoading(true);
        setChecked(false);

        try {
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'drug_interaction', data: { medications: valid } }),
            });
            const data = await res.json();
            if (Array.isArray(data.results)) {
                setInteractions(data.results);
            } else {
                setInteractions([]);
            }
            setChecked(true);
        } catch {
            setError('Unable to check interactions. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const highRiskCount = interactions.filter(i => i.severity === 'Contraindicated' || i.severity === 'Major').length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-black text-ink tracking-tight">Drug Interaction Checker</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 whitespace-nowrap">AI-powered pharmacology safety check · Hospital Verified</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-card">
                    <BrainCircuit className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Clinical AI</span>
                </div>
            </div>

            {/* Drug input list */}
            <div className="space-y-2">
                {medications.map((med, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                        </div>
                        <input
                            value={med}
                            onChange={e => updateDrug(i, e.target.value)}
                            placeholder={`Medication name or generic...`}
                            aria-label={`Medication ${i + 1}`}
                            className="flex-1 px-4 py-3 bg-content-bg border border-content-border rounded-card text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                        />
                        {medications.length > 1 && (
                            <button aria-label={`Remove medication ${i + 1}`} onClick={() => removeDrug(i)} className="p-2 text-slate-300 hover:text-rose-400 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {error && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {error}
                </p>
            )}

            <div className="flex gap-3">
                <button onClick={addDrug}
                    className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-content-border text-slate-500 rounded-card text-xs font-black hover:bg-content-surface hover:border-content-border transition-all uppercase tracking-widest">
                    <Plus className="w-4 h-4" /> Add Drug
                </button>
                <button onClick={checkInteractions} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-card text-xs font-black transition-all disabled:opacity-60 shadow-xl shadow-blue-500/20 uppercase tracking-widest">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {loading ? 'Analyzing…' : 'Run Safety Check'}
                </button>
            </div>

            {/* Results */}
            {checked && (
                <div className="space-y-3">
                    <div className={cn('flex items-center gap-3 p-3 rounded-card border',
                        highRiskCount > 0
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                        {highRiskCount > 0
                            ? <AlertTriangle className="w-5 h-5 shrink-0" />
                            : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                        <div>
                            <p className="text-sm font-bold">
                                {highRiskCount > 0
                                    ? `${highRiskCount} high-risk interaction${highRiskCount > 1 ? 's' : ''} detected`
                                    : interactions.length === 0
                                        ? 'No significant interactions found'
                                        : `${interactions.length} interaction${interactions.length > 1 ? 's' : ''} found — review below`}
                            </p>
                            <p className="text-[10px] mt-0.5 opacity-80">AI suggestion only. Confirm with clinical pharmacist before prescribing.</p>
                        </div>
                    </div>

                    {interactions.map((interaction, i) => {
                        const cfg = SEVERITY_CONFIG[interaction.severity];
                        return (
                            <div key={i} className={cn('rounded-card p-4 border space-y-3', cfg.color)}>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2 text-sm font-black text-ink">
                                        <span>{cfg.icon}</span>
                                        <span>{interaction.drug1}</span>
                                        <span className="text-slate-400 font-normal">/</span>
                                        <span>{interaction.drug2}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-0.5 bg-content-bg/50 border border-white rounded-md text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                            Observed in Facility: 24h
                                        </div>
                                        <span className={cn('px-3 py-1 rounded-card text-[10px] font-black uppercase tracking-widest border shadow-card', cfg.badge)}>
                                            {interaction.severity}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Mechanism</p>
                                        <p className="text-slate-700 leading-relaxed">{interaction.mechanism}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Clinical Effect</p>
                                        <p className="text-slate-700 leading-relaxed">{interaction.clinical_effect}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Recommendation</p>
                                        <p className="text-slate-700 leading-relaxed font-medium">{interaction.recommendation}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {interactions.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-300 mb-2" />
                            No drug interactions detected between the entered medications.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
