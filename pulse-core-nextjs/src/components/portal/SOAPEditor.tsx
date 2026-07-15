'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    Stethoscope, FileText, ClipboardCheck, ListChecks,
    Sparkles, Save, RotateCcw, Copy, Mic, MicOff,
    ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';

/* ── types ─────────────────────────────────────────── */
export interface SOAPData {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
}

interface SOAPEditorProps {
    patientName?: string;
    consultationId?: string;
    initialData?: Partial<SOAPData>;
    onSave?: (data: SOAPData) => Promise<void> | void;
    className?: string;
}

/* ── section config ────────────────────────────────── */
const SECTIONS = [
    {
        key: 'subjective' as const,
        label: 'Subjective',
        abbr: 'S',
        icon: Stethoscope,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        placeholder: 'Chief complaint, history of present illness, review of systems, past history, social history, family history...',
    },
    {
        key: 'objective' as const,
        label: 'Objective',
        abbr: 'O',
        icon: FileText,
        color: 'text-emerald',
        bgColor: 'bg-emerald/10',
        borderColor: 'border-emerald/20',
        placeholder: 'Vital signs, physical examination findings, lab results, imaging results...',
    },
    {
        key: 'assessment' as const,
        label: 'Assessment',
        abbr: 'A',
        icon: ClipboardCheck,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        placeholder: 'Clinical impressions, differential diagnoses, ICD-10 codes...',
    },
    {
        key: 'plan' as const,
        label: 'Plan',
        abbr: 'P',
        icon: ListChecks,
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/10',
        borderColor: 'border-violet-500/20',
        placeholder: 'Treatment plan, medications, referrals, follow-up, patient education...',
    },
] as const;

/* ── AI badge ──────────────────────────────────────── */
function AIBadge() {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-[10px] font-bold uppercase tracking-wider border border-violet-500/20">
            <Sparkles className="w-3 h-3" />
            AI Generated
        </span>
    );
}

/* ── component ─────────────────────────────────────── */
export function SOAPEditor({ patientName, consultationId, initialData, onSave, className = '' }: SOAPEditorProps) {
    const [data, setData] = useState<SOAPData>({
        subjective: initialData?.subjective ?? '',
        objective: initialData?.objective ?? '',
        assessment: initialData?.assessment ?? '',
        plan: initialData?.plan ?? '',
    });
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        subjective: true, objective: true, assessment: true, plan: true,
    });
    const [isRecording, setIsRecording] = useState(false);
    const [aiGenerated, setAiGenerated] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    /* Sync state when initialData changes (e.g. from AI import) */
    useEffect(() => {
        if (!initialData) {
            return;
        }

        void Promise.resolve().then(() => {
            setData(prev => ({
                subjective: initialData.subjective ?? prev.subjective,
                objective: initialData.objective ?? prev.objective,
                assessment: initialData.assessment ?? prev.assessment,
                plan: initialData.plan ?? prev.plan,
            }));

            setAiGenerated(prev => {
                const next = { ...prev };
                if (initialData.subjective) next.subjective = true;
                if (initialData.objective) next.objective = true;
                if (initialData.assessment) next.assessment = true;
                if (initialData.plan) next.plan = true;
                return next;
            });

            setDirty(true);
        });
    }, [initialData]);

    const updateField = useCallback((key: keyof SOAPData, value: string) => {
        setData(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    }, []);

    const toggleSection = useCallback((key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 800));
        await Promise.resolve(onSave?.(data));
        setSaving(false);
        setDirty(false);
    }, [data, onSave]);

    const handleAIGenerate = useCallback(async (key: keyof SOAPData) => {
        /* placeholder — would call /v1/ai/soap/generate */
        const mockAI: Record<string, string> = {
            subjective: '34-year-old female presents with 3-day history of productive cough, low-grade fever (37.8°C), and mild chest discomfort. No shortness of breath. No known allergies. Non-smoker. SHIF insured.',
            objective: 'T: 37.8°C, HR: 88bpm, RR: 18/min, BP: 118/72mmHg, SpO2: 97% RA. Chest: bilateral rhonchi, no wheezing. Pharynx mildly erythematous. Tympanic membranes clear bilaterally.',
            assessment: '1. Acute bronchitis (J20.9)\n2. Rule out community-acquired pneumonia',
            plan: '1. Amoxicillin 500mg PO TID × 7 days\n2. Paracetamol 1g PO PRN (max 4g/day)\n3. Increase oral fluids\n4. Chest X-ray if no improvement in 48h\n5. Follow-up in 1 week\n6. Return immediately if SOB, hemoptysis, or high fever',
        };
        updateField(key, mockAI[key] ?? '');
        setAiGenerated(prev => ({ ...prev, [key]: true }));
    }, [updateField]);

    const handleReset = useCallback(() => {
        setData({ subjective: '', objective: '', assessment: '', plan: '' });
        setAiGenerated({});
        setDirty(false);
    }, []);

    const wordCount = Object.values(data).join(' ').split(/\s+/).filter(Boolean).length;

    return (
        <div className={`bg-[#0C1A14] border border-forest/30 rounded-card overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-forest/30 flex items-center justify-between">
                <div>
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-emerald" />
                        SOAP Notes
                    </h3>
                    <p className="text-[11px] text-sage mt-0.5 font-mono">
                        {patientName && <span>{patientName} · </span>}
                        {consultationId && <span>{consultationId} · </span>}
                        {wordCount} words
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* AI Scribe toggle */}
                    <button
                        onClick={() => setIsRecording(!isRecording)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            isRecording
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                                : 'bg-forest/30 text-sage hover:text-white border border-forest/20 hover:border-forest/40'
                        }`}
                    >
                        {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        {isRecording ? 'Stop' : 'AI Scribe'}
                    </button>
                    <button
                        onClick={handleReset}
                        className="p-1.5 text-mist hover:text-white hover:bg-forest/30 rounded-lg transition-all"
                        title="Reset all"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigator.clipboard.writeText(
                            SECTIONS.map(s => `[${s.abbr}] ${s.label}\n${data[s.key]}`).join('\n\n')
                        )}
                        className="p-1.5 text-mist hover:text-white hover:bg-forest/30 rounded-lg transition-all"
                        title="Copy all"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Sections */}
            <div className="divide-y divide-forest/20">
                {SECTIONS.map(section => {
                    const _Icon = section.icon;
                    const expanded = expandedSections[section.key];
                    return (
                        <div key={section.key}>
                            {/* Section header */}
                            <button
                                onClick={() => toggleSection(section.key)}
                                className="w-full px-5 py-3 flex items-center justify-between hover:bg-forest/10 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${section.bgColor} ${section.borderColor} border`}>
                                        <span className={`text-xs font-bold font-mono ${section.color}`}>{section.abbr}</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">{section.label}</span>
                                    {aiGenerated[section.key] && <AIBadge />}
                                    {data[section.key].length > 0 && (
                                        <span className="text-[10px] text-sage bg-forest/30 rounded-full px-2 py-0.5 font-mono">
                                            {data[section.key].split(/\s+/).filter(Boolean).length}w
                                        </span>
                                    )}
                                </div>
                                {expanded ? (
                                    <ChevronUp className="w-4 h-4 text-mist" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-mist" />
                                )}
                            </button>

                            {/* Section body */}
                            {expanded && (
                                <div className="px-5 pb-4">
                                    <textarea
                                        value={data[section.key]}
                                        onChange={e => updateField(section.key, e.target.value)}
                                        placeholder={section.placeholder}
                                        rows={4}
                                        className={`w-full bg-forest/20 border ${section.borderColor} rounded-card px-4 py-3 text-sm text-white placeholder:text-mist/40 outline-none focus:ring-2 focus:ring-emerald/20 resize-y font-sans transition-all`}
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            onClick={() => handleAIGenerate(section.key)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 text-[11px] font-bold hover:bg-violet-500/20 transition-colors border border-violet-500/15"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            AI Generate
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* AI disclaimer — non-negotiable per spec */}
            <div className="mx-5 mb-4 flex items-start gap-2 p-3 rounded-card bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    AI-generated content is marked with an AI badge and is <strong>never committed as permanent record</strong> without explicit clinician approval. Always review before saving.
                </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-forest/30 flex items-center justify-between">
                <p className="text-[11px] text-sage">
                    {dirty ? (
                        <span className="text-amber-400">● Unsaved changes</span>
                    ) : (
                        <span className="text-emerald">✓ All changes saved</span>
                    )}
                </p>
                <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald text-ink text-sm font-bold hover:bg-emerald/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Notes'}
                </button>
            </div>
        </div>
    );
}
