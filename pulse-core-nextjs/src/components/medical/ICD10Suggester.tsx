'use client';

import { useState } from 'react';
import { Search, BrainCircuit, Loader2, Copy, CheckCircle2, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface ICD10Suggestion {
    code: string;
    description: string;
    confidence: number;
    notes: string;
}

interface ICD10SuggesterProps {
    initialText?: string;
    onSelect?: (code: string, description: string) => void;
}

export default function ICD10Suggester({ initialText = '', onSelect }: ICD10SuggesterProps) {
    const [clinicalText, setClinicalText] = useState(initialText);
    const [suggestions, setSuggestions] = useState<ICD10Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getSuggestions = async () => {
        if (!clinicalText.trim()) return;
        setLoading(true);
        setSuggestions([]);
        setError(null);

        try {
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'icd10', data: { clinical_text: clinicalText } }),
            });
            const data = await res.json();
            if (Array.isArray(data.results)) {
                setSuggestions(data.results);
            }
        } catch (err) {
            logger.warn('ICD10 suggestion fetch failed', { error: err instanceof Error ? err.message : String(err) });
            setError('Could not fetch ICD-10 suggestions right now. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code).catch((err) => {
            logger.warn('Clipboard copy failed', { error: err instanceof Error ? err.message : String(err) });
        });
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
    };

    const confidenceColor = (c: number) => {
        if (c >= 80) return 'text-emerald-600 bg-emerald-50';
        if (c >= 60) return 'text-amber-600 bg-amber-50';
        return 'text-slate-500 bg-slate-100';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-800">ICD-10 Code Suggester</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Enter clinical notes or a diagnosis to get ICD-10-CM code suggestions</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 rounded-card">
                    <BrainCircuit className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">AI Coding</span>
                </div>
            </div>

            <div className="space-y-2">
                <textarea
                    value={clinicalText}
                    onChange={e => setClinicalText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) getSuggestions(); }}
                    rows={4}
                    placeholder="e.g. 'Patient presents with community-acquired pneumonia, productive cough, fever 38.9°C, CXR shows right lower lobe consolidation...'"
                    className="w-full px-4 py-3 bg-content-surface border border-content-border rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 resize-none leading-relaxed"
                />
                <button
                    onClick={getSuggestions}
                    disabled={loading || !clinicalText.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-card text-sm font-bold transition-all disabled:opacity-60 shadow-lg shadow-violet-500/20">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {loading ? 'Analysing clinical notes…' : 'Suggest ICD-10 Codes'}
                </button>
            </div>

            {error && (
                <div className="rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {error}
                </div>
            )}

            {suggestions.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Suggestions</p>
                    {suggestions.map((s, i) => (
                        <div key={i} className="bg-content-bg border border-content-border rounded-card p-4 shadow-card">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-base font-bold text-ink bg-slate-100 px-3 py-1.5 rounded-card">
                                        {s.code}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{s.description}</p>
                                        {s.notes && <p className="text-xs text-slate-400 mt-0.5">{s.notes}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={cn('px-2 py-1 rounded-lg text-[10px] font-bold', confidenceColor(s.confidence))}>
                                        {s.confidence}% match
                                    </span>
                                    <button onClick={() => copyCode(s.code)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Copy code">
                                        {copied === s.code ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    {onSelect && (
                                        <button onClick={() => onSelect(s.code, s.description)}
                                            className="px-3 py-1.5 bg-violet-500 text-white text-xs font-bold rounded-card hover:bg-violet-600 transition-all flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> Use
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <p className="text-[10px] text-slate-400 text-center">AI suggestions only. Final coding must be verified by a certified medical coder.</p>
                </div>
            )}
        </div>
    );
}
