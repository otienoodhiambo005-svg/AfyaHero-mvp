'use client';

import { useState, useCallback } from 'react';
import {
  Sparkles,
  Microscope,
  Activity,
  Info,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  File,
  X,
  Image,
  Download,
  Printer,
  Zap,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragAndDropUploader } from '@/components/shared/DragAndDropUploader';
import VoiceTextInput from '@/components/shared/VoiceTextInput';

type PathologyResult = {
  diagnosis: string;
  microscopic: string;
  markers: { marker: string; result: string; interpretation: string }[];
  grade_stage: string;
  differentials: { name: string; confidence: number }[];
  recommendation: string;
};

type AnalyzeCitation = {
  id: string;
  title: string;
  source: string;
  url?: string;
};

type PathologyAnalyzeResponse = {
  results?: PathologyResult;
  citations?: AnalyzeCitation[];
  provider?: string;
  model?: string;
  cached?: boolean;
  error?: string;
};

const STAIN_TYPES = ['H&E', 'PAS', 'Ziehl-Neelsen', 'Giemsa', 'Gram', 'IHC Panel', 'Silver', 'Trichrome'] as const;

const QUICK_PROMPTS = [
  {
    label: 'Breast FNA — Suspicious',
    specimen: 'FNA breast mass right upper outer quadrant. Cellular smears showing clusters of atypical ductal epithelial cells with nuclear enlargement, irregular chromatin, prominent nucleoli. Background shows necrotic debris. Some cells show loss of cohesion. Myoepithelial cells not identified in several clusters.',
    stain: 'H&E',
    history: 'F/45, palpable breast mass 2.5cm, rapid growth over 3 months',
  },
  {
    label: 'Cervical biopsy — HSIL',
    specimen: 'Cervical punch biopsy showing squamous epithelium with full-thickness dysplastic changes. Basal cell-like cells with high nuclear-to-cytoplasmic ratio extending through all layers. Mitotic figures present in upper third. Loss of maturation pattern. Underlying stroma shows mild chronic inflammatory infiltrate.',
    stain: 'H&E',
    history: 'F/32, abnormal Pap smear HPV+, colposcopy shows acetowhite area',
  },
  {
    label: 'Lymph node — TB',
    specimen: 'Lymph node excision biopsy showing multiple well-formed caseating granulomas with central necrosis. Epithelioid histiocytes, Langhans-type multinucleated giant cells, and rim of lymphocytes. AFB stain shows occasional acid-fast bacilli. No evidence of malignancy.',
    stain: 'Ziehl-Neelsen',
    history: 'M/28, cervical lymphadenopathy, weight loss, night sweats',
  },
];

export default function AIPathologyAssistant() {
  const [specimen, setSpecimen] = useState('');
  const [stain, setStain] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PathologyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<AnalyzeCitation[]>([]);
  const [meta, setMeta] = useState<{ provider?: string; model?: string; cached?: boolean }>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
    // Auto-fill specimen description from first file name if empty
    if (files.length > 0 && !specimen.trim()) {
      setSpecimen(`Analyzing uploaded file: ${files[0].name}`);
    }
  }, [specimen]);

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
      f.type.startsWith('image/') || 
      f.type === 'application/pdf' ||
      f.name.endsWith('.txt') ||
      f.name.endsWith('.doc') ||
      f.name.endsWith('.docx')
    );
    if (validFiles.length > 0) {
      handleFilesSelected(validFiles);
    }
  }, [handleFilesSelected]);

  const handleAnalyze = async () => {
    if (!specimen.trim() && uploadedFiles.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      // If we have uploaded files, create FormData for multipart upload
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        formData.append('type', 'pathology');
        formData.append('data', JSON.stringify({
          specimen: specimen || `Analysis of ${uploadedFiles.map(f => f.name).join(', ')}`,
          stain_type: stain || undefined,
          clinical_history: clinicalHistory || undefined,
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
        const data = await res.json() as PathologyAnalyzeResponse;
        if (data.results) {
          setResult(data.results);
          setCitations(Array.isArray(data.citations) ? data.citations : []);
          setMeta({ provider: data.provider, model: data.model, cached: data.cached === true });
        } else {
          throw new Error(data.error || 'Failed to analyse specimen');
        }
      } else {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pathology',
            data: {
              specimen,
              stain_type: stain || undefined,
              clinical_history: clinicalHistory || undefined,
            },
          }),
        });
        const data = await res.json() as PathologyAnalyzeResponse;
        if (data.results) {
          setResult(data.results);
          setCitations(Array.isArray(data.citations) ? data.citations : []);
          setMeta({ provider: data.provider, model: data.model, cached: data.cached === true });
        } else {
          throw new Error(data.error || 'Failed to analyse specimen');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
      setCitations([]);
      setMeta({});
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-content-bg rounded-[2.5rem] border border-content-border shadow-2xl overflow-hidden flex flex-col h-full relative group">
      {/* Dynamic Background Graphics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/5 blur-[120px] rounded-full group-hover:bg-violet-500/10 transition-colors duration-1000" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/5 blur-[100px] rounded-full group-hover:bg-violet-500/10 transition-colors duration-1000" />
      </div>

      <div className="p-10 relative z-10 flex flex-col h-full">
        {/* Header with Antigravity Flair */}
        <div className="flex items-start justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-content-bg border border-content-border rounded-3xl flex items-center justify-center shadow-2xl shadow-violet-500/10 relative overflow-hidden group/icon">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity" />
              <Microscope className="w-9 h-9 text-violet-600 relative z-10" />
            </div>
            <div>
              <h3 className="text-2xl font-serif italic text-ink tracking-tight py-0.5 uppercase tracking-tighter">AfyaMedic AI</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Histopathology & Specimen Assistant</span>
              </div>
            </div>
          </div>
          
          {(meta.provider || meta.model || meta.cached) && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-mist uppercase tracking-widest">DIAGNOSTIC NODE</span>
                <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-600">
                  {meta.provider} · {meta.model}
                </span>
              </div>
              {meta.cached && (
                <span className="text-[9px] font-bold text-slate bg-content-surface px-2 py-0.5 rounded-full border border-content-border uppercase tracking-widest">
                  Memory Cache Active
                </span>
              )}
            </div>
          )}
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Stain Type</label>
            <select
              value={stain}
              onChange={(e) => setStain(e.target.value)}
              className="w-full bg-content-surface border border-content-border rounded-card px-4 py-3 text-sm text-ink focus:border-violet-500 outline-none transition-all hover:bg-content-bg"
            >
              <option value="" className="bg-content-bg">Select stain...</option>
              {STAIN_TYPES.map((s) => <option key={s} value={s} className="bg-content-bg">{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Clinical Context</label>
            <input
              value={clinicalHistory}
              onChange={(e) => setClinicalHistory(e.target.value)}
              placeholder="e.g. F/45, right breast mass"
              className="w-full bg-content-surface border border-content-border rounded-card px-4 py-3 text-sm text-ink placeholder:text-slate/40 focus:border-violet-500 outline-none transition-all hover:bg-content-bg"
            />
          </div>
        </div>

        {/* Uploader Section */}
        <div 
          className={cn(
            "mb-6 transition-all duration-300 rounded-3xl border border-dashed p-1",
            isDragging ? "border-violet-500 bg-violet-500/5 scale-[1.01]" : "border-content-border bg-content-surface/50"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <DragAndDropUploader
            onFilesSelected={handleFilesSelected}
            accept="image/*,.pdf,.txt,.doc,.docx"
            multiple={true}
            maxSizeMB={25}
            className="rounded-card border-none bg-transparent"
          />
          
          {uploadedFiles.length > 0 && (
            <div className="p-4 space-y-2 border-t border-content-border">
              <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest pl-1">
                Attached Specimens ({uploadedFiles.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 bg-content-bg border border-content-border rounded-card px-4 py-3 group/file hover:border-violet-500/30 transition-all"
                  >
                    <div className="w-10 h-10 rounded-card bg-violet-500/10 flex items-center justify-center shrink-0 group-hover/file:scale-105 transition-transform">
                      {file.type.startsWith('image/') ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image className="w-5 h-5 text-violet-600" aria-hidden="true" />
                      ) : (
                        <File className="w-5 h-5 text-violet-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink font-bold truncate tracking-tight">{file.name}</p>
                      <p className="text-[10px] text-slate font-semibold uppercase">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-2 text-slate hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Microscopic Description */}
        <div className="space-y-2 mb-8">
          <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Microscopic Findings & Observations</label>
          <VoiceTextInput
            placeholder="Describe microscopic features, cellular morphology, architectural patterns..."
            initialText={specimen}
            onSubmit={(text) => {
              setSpecimen(text);
              handleAnalyze();
            }}
            onVoiceResult={(text) => setSpecimen(prev => prev + (prev ? ' ' : '') + text)}
            allowVoice={true}
            allowSpeechOutput={false}
            maxLength={8000}
            variant="compact"
            suggestions={QUICK_PROMPTS.map(qp => qp.label)}
            onSuggestionClick={(suggestion) => {
              const qp = QUICK_PROMPTS.find(q => q.label === suggestion);
              if (qp) {
                setSpecimen(qp.specimen);
                setStain(qp.stain);
                setClinicalHistory(qp.history);
              }
            }}
          />
        </div>

        {/* Action Button */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing || (!specimen.trim() && uploadedFiles.length === 0)}
          className={cn(
            'w-full py-4 rounded-card font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all relative overflow-hidden group/btn mb-8 shadow-xl',
            (analyzing || (!specimen.trim() && uploadedFiles.length === 0)) 
              ? 'bg-content-surface text-slate cursor-not-allowed border border-content-border' 
              : 'bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.98] shadow-violet-500/20'
          )}
        >
          {analyzing ? (
            <><Activity className="w-4 h-4 animate-spin" /> Analyzing Specimen...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Run Pathology Analysis</>
          )}
        </button>

        {/* Results Flow */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
          {error && (
            <div className="p-5 rounded-card bg-rose-500/5 border border-rose-500/20 text-rose-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3 animate-in shake-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" /> {error}
            </div>
          )}
          
          {!result && !analyzing && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-content-border rounded-3xl bg-content-surface/30">
              <div className="w-16 h-16 bg-violet-600/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Info className="w-8 h-8 text-violet-600/40" />
              </div>
              <h4 className="text-ink font-bold text-sm mb-2 uppercase tracking-tight">Awaiting Specimen Data</h4>
              <p className="text-slate text-xs font-semibold leading-relaxed max-w-[260px] uppercase tracking-tighter">
                Enter microscopic findings or upload slide images for AI interpretation.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-content-bg/5 rounded-card border border-white/5 animate-pulse flex items-center p-5 gap-4">
                  <div className="w-10 h-10 bg-content-bg/5 rounded-card" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-content-bg/10 rounded-full w-1/3" />
                    <div className="h-2 bg-content-bg/5 rounded-full w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {result && !analyzing && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
              {/* Primary Diagnosis Card */}
              <div className="p-8 rounded-[2rem] bg-content-bg border border-violet-500/20 relative overflow-hidden group/card shadow-2xl transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 blur-[80px] -mr-24 -mt-24 group-hover/card:bg-violet-500/10 transition-all" />
                <div className="text-[10px] font-black text-violet-600 uppercase tracking-[0.25em] mb-4 flex items-center gap-3">
                  <Activity className="w-4 h-4" />
                  Pathological Diagnosis
                </div>
                <p className="text-xl font-serif italic text-ink leading-tight tracking-tight uppercase border-l-4 border-violet-500 pl-6 py-2">
                  {result.diagnosis}
                </p>
              </div>

              {/* Microscopic Breakdown */}
              {result.microscopic && (
                <div className="p-8 rounded-[2rem] bg-content-bg border border-content-border shadow-xl group/micro">
                  <div className="text-[10px] font-black text-slate uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-violet-600" />
                    Microscopic Features Analysis
                  </div>
                  <p className="text-sm text-slate leading-relaxed font-medium pl-2 italic">
                    &ldquo;{result.microscopic}&rdquo;
                  </p>
                </div>
              )}

              {/* Biomarkers / Markers */}
              {result.markers?.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pl-1">
                    <h4 className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Biomarker Grid</h4>
                    <span className="text-[10px] font-bold text-mist uppercase tracking-widest">{result.markers.length} Panels Mapped</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {result.markers.map((m, i) => (
                      <div key={i} className="p-6 rounded-[1.5rem] bg-content-bg border border-content-border flex items-center justify-between group/marker hover:border-violet-500/30 transition-all shadow-md hover:shadow-xl">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-card bg-violet-500/10 flex items-center justify-center text-sm font-black text-violet-600 border border-violet-500/10 group-hover/marker:scale-110 transition-transform">
                            {m.marker.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-ink uppercase tracking-widest mb-0.5">{m.marker}</div>
                            <div className="text-[9px] text-mist font-black uppercase tracking-[0.15em] leading-none">{m.interpretation}</div>
                          </div>
                        </div>
                        <span className={cn(
                          "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-card transition-all group-hover/marker:shadow-lg",
                          m.result.toLowerCase().includes('positive') ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-content-surface text-slate border-content-border"
                        )}>
                          {m.result}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.grade_stage && (
                  <div className="p-5 rounded-card bg-amber-50 border border-amber-200 shadow-card">
                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Grade / Stage</div>
                    <p className="text-sm text-ink font-bold uppercase tracking-tight">{result.grade_stage}</p>
                  </div>
                )}
                <div className="p-5 rounded-card bg-emerald-50 border border-emerald-200 shadow-card">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Integrity</div>
                  <p className="text-sm text-ink font-bold uppercase tracking-tight flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verified Analysis
                  </p>
                </div>
              </div>

              {/* Differentials */}
              {result.differentials?.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-slate uppercase tracking-widest pl-1 mb-1">Key Differentials</div>
                  <div className="flex flex-wrap gap-2">
                    {result.differentials.map((d, i) => (
                      <div key={i} className="px-4 py-3 rounded-card bg-content-bg border border-content-border flex items-center gap-4 group/diff hover:border-violet-500/30 transition-all shadow-card">
                        <span className="text-[11px] font-bold text-slate uppercase group-hover/diff:text-violet-600 transition-colors tracking-tight">{d.name}</span>
                        <div className="w-16 h-1 bg-content-surface rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]" style={{ width: `${d.confidence}%` }} />
                        </div>
                        <span className="text-[9px] font-black text-violet-600 tracking-widest">{d.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div className="p-6 rounded-3xl bg-content-bg border border-content-border relative group/rec shadow-md overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/40" />
                <div className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-violet-600" />
                  Pathology Advisory
                </div>
                <p className="text-[13px] text-slate leading-relaxed font-semibold italic">{result.recommendation}</p>
              </div>

              {/* Disclaimer */}
              <div className="bg-violet-50 rounded-card p-4 text-[9px] font-bold text-violet-700 uppercase tracking-widest flex items-center gap-3 border border-violet-100 shadow-card">
                <Info className="w-5 h-5 text-violet-600" />
                Clinical Decision Support: Interpretation must be correlated with clinical findings and confirmed by a consultant pathologist.
              </div>
              
              {/* Final Actions */}
              <div className="flex flex-wrap sm:flex-nowrap gap-3">
                <button
                  onClick={() => {
                    const report = `AFYAMEDIC AI ANALYSIS\nGENERATED: ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\nDIAGNOSIS:\n${result.diagnosis}\n\nMICROSCOPIC:\n${result.microscopic}\n\nMARKERS:\n${result.markers?.map(m => `- ${m.marker}: ${m.result}`).join('\n')}\n\nDIFFERENTIALS:\n${result.differentials?.map(d => `- ${d.name} (${d.confidence}%)`).join('\n')}\n\nADVISORY:\n${result.recommendation}`;
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pathology-ai-${Date.now()}.txt`;
                    a.click();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-card bg-content-surface border border-content-border text-[10px] font-black uppercase tracking-widest text-slate hover:bg-content-bg hover:text-ink transition-all shadow-md group/exp"
                >
                  <Download className="w-4 h-4 group-hover/exp:translate-y-0.5 transition-transform" />
                  Export Insights
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-card bg-content-surface border border-content-border text-[10px] font-black uppercase tracking-widest text-slate hover:bg-content-bg hover:text-ink transition-all shadow-md group/print"
                >
                  <Printer className="w-4 h-4 group-hover/print:scale-110 transition-transform" />
                  Print Report
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-content-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
            <p className="text-[10px] font-black text-slate uppercase tracking-[0.3em]">Precision Medicine</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-bold text-mist uppercase tracking-[0.2em]">Verified AI Core v1.4</span>
            <div className="h-4 w-[1px] bg-content-border" />
            <span className="text-[11px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-1.5 transition-all hover:gap-2.5 cursor-pointer">
              Secure Analysis <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
