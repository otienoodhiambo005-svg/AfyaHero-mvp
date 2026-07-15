'use client';

import { useMemo, useState } from 'react';
import {
    BrainCircuit,
    Zap,
    Activity,
    Info,
    ShieldPlus,
    ChevronRight,
    FileText,
    History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import VoiceTextInput from '@/components/shared/VoiceTextInput';
import logger from '@/lib/logger';
import { readResponseErrorMessage } from '@/lib/fetch-error';

type Result = {
  name: string;
  confidence: number;
  risk: string;
  recommendation: string;
};

type Citation = {
  id: string;
  title: string;
  source: string;
  url?: string;
};

type DiagnosticApiResponse = {
  results?: Result[];
  citations?: Citation[];
  provider?: string;
  model?: string;
  cached?: boolean;
  error?: string;
};

const QUICK_PROMPTS = [
  {
    label: 'TB screening (adult)',
    text: 'Persistent cough >3 weeks, night sweats, weight loss, low-grade fever, contact with TB case, HIV negative status unknown. Request CXR, sputum GeneXpert, and consider start infection control precautions.',
    context: 'TB screening and respiratory isolation',
  },
  {
    label: 'Sepsis triage',
    text: 'Fever 39°C, HR 110, SBP 90, lactate pending, suspected pneumonia, altered mentation. Need early antibiotics, fluids, lactate, cultures.',
    context: 'Sepsis early warning',
  },
  {
    label: 'Pedi diarrhoea',
    text: 'Child 2yo, acute watery diarrhoea, dry mucosa, sunken eyes, no blood, low urine, cap refill 3s.',
    context: 'Paediatric dehydration assessment',
  },
];

interface AIDiagnosticAssistantProps {
  initialSymptoms?: string;
  activeContext?: string;
}

export default function AIDiagnosticAssistant({ 
  initialSymptoms = '', 
  activeContext: initialContext 
}: Readonly<AIDiagnosticAssistantProps>) {
  const [symptoms, setSymptoms] = useState(initialSymptoms);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [activeContext, setActiveContext] = useState<string | undefined>(initialContext);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [providerMeta, setProviderMeta] = useState<{ provider?: string; model?: string; cached?: boolean }>({});

  const riskPill = useMemo(() => ({
    'Critical': 'bg-rose-500 text-white',
    'High': 'bg-orange-500 text-white',
    'Moderate': 'bg-amber-500 text-white',
    'Medium': 'bg-amber-500 text-white',
    'Low': 'bg-emerald-500 text-white',
  }), []);

  const handleAnalyze = async (textOverride?: string) => {
    const queryText = textOverride ?? symptoms;
    if (!queryText.trim()) return;
    
    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'diagnostic',
          data: {
            symptoms: queryText,
            context: activeContext ?? 'Clinical diagnosis support',
            triage_required: true,
          },
        }),
      });

      if (!response.ok) {
        const message = await readResponseErrorMessage(response);
        throw new Error(message);
      }

      const data = await response.json() as DiagnosticApiResponse;
      if (Array.isArray(data.results)) {
        setResults(data.results);
        setCitations(Array.isArray(data.citations) ? data.citations : []);
        setProviderMeta({
          provider: data.provider,
          model: data.model,
          cached: data.cached === true,
        });
      } else {
        throw new TypeError(data.error || 'Failed to analyze symptoms');
      }
    } catch (error) {
      logger.error('Diagnostic AI analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      setResults([
        { name: 'Analysis Failed', confidence: 0, risk: 'N/A', recommendation: 'Please check connection or retry.' },
      ]);
      setCitations([]);
      setProviderMeta({});
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-content-bg rounded-[2.5rem] border border-content-border shadow-2xl overflow-hidden flex flex-col h-full relative group">
      {/* Dynamic Background Aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[120px] rounded-full group-hover:bg-emerald-500/10 transition-colors duration-1000" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[100px] rounded-full group-hover:bg-emerald-500/10 transition-colors duration-1000" />
      </div>

      <div className="p-10 relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-content-bg border border-content-border rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/5 relative overflow-hidden group/icon">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity" />
              <BrainCircuit className="w-9 h-9 text-emerald-600 relative z-10" />
            </div>
            <div>
              <h3 className="text-2xl font-serif italic text-ink tracking-tight py-0.5">AfyaMedic AI</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate uppercase tracking-widest">Grounded Clinical Insight Engine</span>
              </div>
            </div>
          </div>
          
          {(providerMeta.provider || providerMeta.model || providerMeta.cached) && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-mist uppercase tracking-widest">CASCADE STATUS</span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  {providerMeta.provider} · {providerMeta.model}
                </span>
              </div>
              {providerMeta.cached && (
                <span className="text-[9px] font-bold text-slate bg-content-surface px-2 py-0.5 rounded-full border border-content-border uppercase tracking-widest">
                  Memory Cache Active
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 mb-8">
          <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Symptoms & Clinical Observations</label>
          <VoiceTextInput
            placeholder="e.g. Patient presents with persistent cough, 102°F fever, and shortness of breath for 3 days..."
            initialText={symptoms}
            onSubmit={(text) => {
              setSymptoms(text);
              void handleAnalyze(text);
            }}
            onVoiceResult={(text) => setSymptoms(prev => prev + (prev ? ' ' : '') + text)}
            allowVoice={true}
            allowSpeechOutput={false}
            maxLength={4000}
            variant="compact"
            suggestions={QUICK_PROMPTS.map(qp => qp.label)}
            onSuggestionClick={(suggestion) => {
              const qp = QUICK_PROMPTS.find(q => q.label === suggestion);
              if (qp) {
                setSymptoms(qp.text);
                setActiveContext(qp.context);
              }
            }}
          />
        </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {!results && !analyzing && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-content-border rounded-3xl bg-content-surface/30">
                            <div className="w-16 h-16 bg-emerald-600/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <Info className="w-8 h-8 text-emerald-600/40" />
                            </div>
                            <h4 className="text-ink font-bold text-sm mb-2">Awaiting Input</h4>
                            <p className="text-slate text-xs font-semibold leading-relaxed max-w-[260px] uppercase tracking-tighter">Enter symptoms above to generate AI-assisted clinical suggestions.</p>
                        </div>
                    )}

                    {analyzing && (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={`skeleton-${i}`} className="h-24 bg-content-bg/5 rounded-card border border-white/5 animate-pulse flex items-center p-5 gap-4">
                                    <div className="w-10 h-10 bg-content-bg/5 rounded-card" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-content-bg/10 rounded-full w-1/3" />
                                        <div className="h-2 bg-content-bg/5 rounded-full w-2/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results && !analyzing && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
                        <div className="flex items-center justify-between pl-1 mb-2">
                          <h4 className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Differential Ranking</h4>
                          <span className="text-[10px] font-bold text-mist uppercase tracking-widest">{results.length} Insights Identified</span>
                        </div>
                        
                        {results.map((res) => (
                          <div key={`${res.name}-${res.confidence}`} className="p-8 rounded-[2rem] bg-content-bg border border-content-border hover:border-emerald-500/30 transition-all group/item shadow-xl hover:shadow-2xl hover:scale-[1.01] duration-300">
                            <div className="flex justify-between items-start mb-6">
                              <div className="flex-1">
                                <div className="flex items-center gap-4">
                                  <div className="text-xl font-serif italic text-ink group-hover/item:text-emerald-600 transition-colors tracking-tight">{res.name}</div>
                                  <span className={cn(
                                    'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-card',
                                    riskPill[res.risk as keyof typeof riskPill] ?? 'bg-emerald-500 text-white'
                                  )}>
                                    {res.risk}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                  <div className="text-[10px] font-black text-mist uppercase tracking-widest">Confidence Score</div>
                                  <div className="w-32 h-1.5 bg-content-surface rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-1000"
                                      style={{ width: `${res.confidence}%` }}
                                    />
                                  </div>
                                  <div className="text-[11px] font-black text-emerald-600 font-mono tracking-tighter">{res.confidence}%</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="p-2.5 rounded-card bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover/item:bg-emerald-600 group-hover/item:text-white transition-all">
                                  <Activity className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                             <p className="text-sm text-slate leading-relaxed font-medium mb-6 border-l-3 border-emerald-500/20 pl-6 italic">
                               &ldquo;{res.recommendation}&rdquo;
                             </p>
                            <div className="bg-emerald-50/50 rounded-card p-4 text-[10px] font-black text-emerald-800 uppercase tracking-[0.15em] flex items-center gap-3 border border-emerald-100/50">
                              <ShieldPlus className="w-4 h-4 text-emerald-600" />
                              Clinical orchestration required • Evidence Grade A
                            </div>
                          </div>
                        ))}
                        {citations.length > 0 && (
                          <div className="rounded-card border border-content-border bg-content-bg p-5 relative overflow-hidden group/cit shadow-md">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl -mr-12 -mt-12" />
                            <div className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                              Evidence-Based Sources
                            </div>
                            <ul className="space-y-3 text-[11px]">
                              {citations.map((citation, index) => (
                                <li key={citation.id || `cite-${index}`} className="flex gap-3 group/cite">
                                  <span className="shrink-0 w-5 h-5 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[9px] font-black text-emerald-600">
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                      <p className="font-bold text-ink group-hover/cite:text-emerald-600 transition-colors truncate">{citation.title}</p>
                                      {citation.url && (
                                        <a href={citation.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[9px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1">
                                          View <ChevronRight className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-mist font-semibold uppercase tracking-tighter transition-colors group-hover/cite:text-slate">{citation.source}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-content-border flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                      <p className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Clinical AI Ops</p>
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                      <History className="w-3 h-3" />
                      Evidence Grade A
                    </div>
                </div>
            </div>
        </div>
    );
}
