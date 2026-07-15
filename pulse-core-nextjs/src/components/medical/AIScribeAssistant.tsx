'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Activity,
  Info,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ClipboardCopy,
  File,
  X,
  Mic,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragAndDropUploader } from '@/components/shared/DragAndDropUploader';

type ScribeResult = {
  summary: string;
  nextSteps: string[];
};

type AnalyzeCitation = {
  id: string;
  title: string;
  source: string;
  url?: string;
};

type ScribeAnalyzeResponse = {
  results?: ScribeResult;
  citations?: AnalyzeCitation[];
  provider?: string;
  model?: string;
  cached?: boolean;
  error?: string;
};

const QUICK_PROMPTS = [
  {
    label: 'Outpatient follow-up',
    chat: 'Doctor: Good morning, how are you feeling today?\nPatient: Much better doctor, the fever went down after starting the antibiotics.\nDoctor: That\'s good. Any cough remaining?\nPatient: Yes, still coughing but not as bad. No blood.\nDoctor: Let me listen to your chest... Right, sounds are much clearer. I\'ll continue the Amoxicillin for 3 more days. Come back if fever returns or cough worsens.\nPatient: Okay doctor, thank you.',
  },
  {
    label: 'ANC first visit',
    chat: 'Doctor: Welcome. I see this is your first antenatal visit. How far along are you?\nPatient: I think about 3 months, my last period was 12 weeks ago.\nDoctor: Any complications with previous pregnancies?\nPatient: No, this is my first pregnancy.\nDoctor: We\'ll do a full workup today — blood group, Hb, HIV, VDRL, urinalysis, and an ultrasound to confirm dates. I\'ll also start you on folic acid and iron supplements.\nPatient: Is everything okay so far?\nDoctor: So far so good. We\'ll know more after the tests. Next visit in 4 weeks.',
  },
  {
    label: 'Paedi acute visit',
    chat: 'Parent: Doctor, my son has had diarrhoea since yesterday, about 6 times. He\'s not eating.\nDoctor: How old is he?\nParent: 18 months.\nDoctor: Is he drinking fluids? Any vomiting?\nParent: He\'s drinking a little ORS but vomited once.\nDoctor: Let me examine him... He has mild dehydration — dry lips, slightly sunken eyes, but still active. I\'ll give him zinc for 10 days and continue ORS. If he stops drinking or gets drowsy, bring him back immediately.\nParent: Should I stop breastfeeding?\nDoctor: No, continue breastfeeding. It\'s very important right now.',
  },
];

interface AIScribeAssistantProps {
  isEmbedded?: boolean;
  transcript?: string;
  onAnalyze?: (result: ScribeResult) => void;
}

export default function AIScribeAssistant({ isEmbedded, transcript, onAnalyze }: AIScribeAssistantProps = {}) {
  const [chatText, setChatText] = useState(transcript || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScribeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync transcript if provided by parent
  useEffect(() => {
    if (transcript !== undefined) {
      setChatText(transcript);
    }
  }, [transcript]);
  const [copied, setCopied] = useState(false);
  const [citations, setCitations] = useState<AnalyzeCitation[]>([]);
  const [meta, setMeta] = useState<{ provider?: string; model?: string; cached?: boolean }>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
    // Auto-fill chat text from first file name if empty
    if (files.length > 0 && !chatText.trim()) {
      setChatText(`Transcribing uploaded file: ${files[0].name}`);
    }
  }, [chatText]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => 
      f.type.startsWith('audio/') || 
      f.type.startsWith('video/') ||
      f.name.endsWith('.txt') ||
      f.name.endsWith('.doc') ||
      f.name.endsWith('.docx') ||
      f.type === 'application/pdf'
    );
    if (validFiles.length > 0) {
      handleFilesSelected(validFiles);
    }
  }, [handleFilesSelected]);

  const handleAnalyze = async () => {
    if (!chatText.trim() && uploadedFiles.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      // If we have uploaded files, create FormData for multipart upload
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        formData.append('type', 'teleconsultation');
        formData.append('data', JSON.stringify({
          chatHistory: chatText ? chatText.split('\n').filter(Boolean).map((line) => {
            const [speaker, ...rest] = line.split(':');
            return { role: speaker?.trim() || 'Unknown', content: rest.join(':').trim() || line };
          }) : [],
          hasAttachments: true,
          fileCount: uploadedFiles.length,
        }));
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json() as ScribeAnalyzeResponse;
        if (data.results) {
          setResult(data.results);
          setCitations(Array.isArray(data.citations) ? data.citations : []);
          setMeta({ provider: data.provider, model: data.model, cached: data.cached === true });
        } else {
          throw new Error(data.error || 'Failed to generate notes');
        }
      } else {
        const chatLines = chatText.split('\n').filter(Boolean).map((line) => {
          const [speaker, ...rest] = line.split(':');
          return { role: speaker?.trim() || 'Unknown', content: rest.join(':').trim() || line };
        });
        const res = await fetch('/api/teleconsultation/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: chatText,
            patientContext: '',
          }),
        });
        const data = await res.json() as ScribeAnalyzeResponse;
        if (data.results) {
          setResult(data.results);
          setCitations(Array.isArray(data.citations) ? data.citations : []);
          setMeta({ provider: data.provider, model: data.model, cached: data.cached === true });
        } else {
          throw new Error(data.error || 'Failed to generate notes');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scribe failed');
      setResult(null);
      setCitations([]);
      setMeta({});
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `CLINICAL SUMMARY\n${result.summary}\n\nNEXT STEPS\n${result.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-content-bg rounded-3xl border border-content-border shadow-xl overflow-hidden flex flex-col h-full relative group">
      {/* Background Glows */}
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#3282B8]/5 blur-[100px] -mr-32 -mb-32" />
      
      <div className="p-8 relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-[#3282B8]/10 to-[#0F4C75]/10 rounded-card flex items-center justify-center border border-[#3282B8]/20 shadow-lg shadow-[#3282B8]/5">
            <FileText className="w-8 h-8 text-[#3282B8]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-ink tracking-tight">AI Clinical Scribe</h3>
            <p className="text-slate text-[11px] font-semibold tracking-wide flex items-center gap-1.5 mt-0.5 uppercase tracking-widest">
              <Activity className="w-3 h-3 text-[#3282B8]" />
              Auto-generate clinical notes from consultations
            </p>
            {(meta.provider || meta.model || meta.cached) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {meta.provider && meta.model && (
                  <span className="rounded-full border border-[#3282B8]/20 bg-[#3282B8]/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#3282B8]">
                    {meta.provider} · {meta.model}
                  </span>
                )}
                {meta.cached && (
                  <span className="rounded-full border border-content-border bg-content-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate">
                    Cached
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* File Upload Zone with Drag & Drop */}
        <div 
          className={cn(
            "mb-6 transition-all duration-300 rounded-3xl border border-dashed p-1",
            isDragging ? "border-[#3282B8] bg-[#3282B8]/5 scale-[1.01]" : "border-content-border bg-content-surface"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <DragAndDropUploader
            onFilesSelected={handleFilesSelected}
            accept="audio/*,video/*,.txt,.doc,.docx,.pdf"
            multiple={true}
            maxSizeMB={100}
            className="rounded-card"
          />
          
          {/* Uploaded Files Preview */}
          {uploadedFiles.length > 0 && (
            <div className="mt-3 p-4 space-y-2 border-t border-content-border">
              <p className="text-[10px] font-bold text-[#3282B8] uppercase tracking-widest pl-1">
                Attached Files ({uploadedFiles.length})
              </p>
              {uploadedFiles.map((file, index) => (
                <div 
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 bg-content-bg border border-content-border rounded-card px-4 py-3 group/file transition-all hover:border-[#3282B8]/30 shadow-card"
                >
                  <div className="w-10 h-10 rounded-card bg-[#3282B8]/10 flex items-center justify-center shrink-0">
                    {file.type.startsWith('audio/') || file.type.startsWith('video/') ? (
                      <Mic className="w-5 h-5 text-[#3282B8]" />
                    ) : (
                      <File className="w-5 h-5 text-[#3282B8]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink font-bold truncate tracking-tight">{file.name}</p>
                    <p className="text-[10px] text-slate/60 font-semibold uppercase">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-2 text-slate hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="space-y-2 mb-6">
          <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Consultation Transcript</label>
          <textarea
            placeholder={"Doctor: How are you feeling today?\nPatient: I've had a headache for 3 days..."}
            className="w-full bg-content-surface border border-content-border rounded-card px-5 py-4 text-ink focus:border-[#3282B8] outline-none transition-all placeholder:text-slate/40 min-h-[160px] text-sm leading-relaxed font-mono shadow-inner"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => setChatText(qp.chat)}
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-card border bg-content-bg text-slate border-content-border hover:border-[#3282B8]/40 hover:text-ink transition-all shadow-card"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !chatText.trim()}
          className={cn(
            'w-full py-4 rounded-card font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all relative overflow-hidden group/btn mb-8 shadow-xl',
            (analyzing || !chatText.trim()) 
              ? 'bg-content-surface text-slate cursor-not-allowed border border-content-border' 
              : 'bg-gradient-to-r from-[#3282B8] to-[#0F4C75] text-white hover:from-[#0F4C75] hover:to-[#3282B8] active:scale-[0.98] shadow-[#3282B8]/20'
          )}
        >
          {analyzing ? (
            <><Activity className="w-4 h-4 animate-spin" /> Generating notes...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate Clinical Notes</>
          )}
        </button>

        {/* Results */}
        <div className="flex-1 overflow-y-auto pr-2">
          {error && (
            <div className="p-4 rounded-card bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {!result && !analyzing && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-content-border rounded-3xl bg-content-surface/30">
              <div className="w-16 h-16 bg-[#3282B8]/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Info className="w-8 h-8 text-[#3282B8]/40" />
              </div>
              <h4 className="text-ink font-bold text-sm mb-2 uppercase tracking-tight">Awaiting Input</h4>
              <p className="text-slate text-xs font-semibold leading-relaxed max-w-[260px] uppercase tracking-tighter">Enter a consultation transcript above to generate structured clinical notes.</p>
            </div>
          )}
          {analyzing && (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={`skeleton-${i}`} className="h-24 bg-content-surface rounded-card border border-content-border animate-pulse flex items-center p-6 gap-4">
                  <div className="w-12 h-12 bg-[#3282B8]/10 rounded-card" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[#3282B8]/10 rounded-full w-1/3" />
                    <div className="h-2 bg-[#3282B8]/5 rounded-full w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {result && !analyzing && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* Copy button */}
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-card bg-content-bg border border-content-border text-xs font-bold text-slate hover:text-ink hover:border-amber-500/30 transition-all shadow-md group/exp"
              >
                <ClipboardCopy className="w-4 h-4 group-hover/exp:translate-y-0.5 transition-transform" />
                {copied ? 'Copied!' : 'Copy notes to clipboard'}
              </button>
              {/* Summary */}
              <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 shadow-md">
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  Clinical Summary
                </div>
                <p className="text-sm text-ink leading-relaxed font-semibold">{result.summary}</p>
              </div>
              {/* Next Steps */}
              {result.nextSteps?.length > 0 && (
                <div className="p-6 rounded-3xl bg-content-bg border border-content-border shadow-md">
                  <div className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                    Next Steps / Plan
                  </div>
                  <ol className="space-y-3">
                    {result.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-4 p-3 rounded-card bg-content-surface/50 border border-content-border transition-all hover:border-amber-500/20">
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-card">{i + 1}</span>
                        <span className="text-[11px] text-slate leading-relaxed font-medium">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {citations.length > 0 && (
                <div className="rounded-3xl border border-content-border bg-content-bg p-6 shadow-md overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl -mr-12 -mt-12" />
                  <div className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    Evidence-Based Sources
                  </div>
                  <ul className="space-y-3 text-[11px]">
                    {citations.map((citation, index) => (
                      <li key={citation.id || `cite-${index}`} className="flex gap-3 group/cite">
                        <span className="shrink-0 w-6 h-6 rounded bg-amber-50 border border-amber-100 flex items-center justify-center text-[10px] font-black text-amber-600 shadow-card">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-bold text-ink group-hover/cite:text-amber-600 transition-colors truncate">{citation.title}</p>
                            {citation.url && (
                              <a href={citation.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest flex items-center gap-1">
                                View <ChevronRight className="w-3 h-3" />
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
              <div className="bg-amber-50 rounded-card p-4 text-[9px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-3 border border-amber-100 shadow-card">
                <Info className="w-5 h-5 text-amber-600" />
                AI-generated notes — review and edit before signing off
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-content-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
            <p className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Clinical AI Scribe</p>
          </div>
          <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest flex items-center gap-1.5 transition-all hover:gap-2.5 cursor-pointer">
            Fast Clinical Ops <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
