'use client';

import { useState, useCallback } from 'react';
import {
  Sparkles,
  ScanLine,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragAndDropUploader } from '@/components/shared/DragAndDropUploader';
import VoiceTextInput from '@/components/shared/VoiceTextInput';

type RadiologyResult = {
  impression: string;
  findings: { area: string; observation: string; significance: string }[];
  differentials: { name: string; confidence: number; recommendation: string }[];
  follow_up: string;
};

type AnalyzeCitation = {
  id: string;
  title: string;
  source: string;
  url?: string;
};

type RadiologyAnalyzeResponse = {
  results?: RadiologyResult;
  citations?: AnalyzeCitation[];
  provider?: string;
  model?: string;
  cached?: boolean;
  error?: string;
};

const MODALITIES = ['X-ray', 'CT', 'MRI', 'Ultrasound', 'PET-CT', 'Mammography'] as const;

const QUICK_PROMPTS = [
  {
    label: 'CXR — Pneumonia',
    findings: 'PA chest radiograph shows bilateral patchy airspace opacities predominantly in the lower lobes with air bronchograms. No pleural effusion. Heart size normal. No pneumothorax.',
    modality: 'X-ray',
    region: 'Chest',
  },
  {
    label: 'CT Head — Stroke',
    findings: 'Non-contrast CT head: hyperdense area in the left MCA territory involving the insular cortex and adjacent temporal lobe. Loss of grey-white differentiation. No midline shift. No hydrocephalus.',
    modality: 'CT',
    region: 'Head',
  },
  {
    label: 'CXR — TB screening',
    findings: 'PA chest radiograph shows bilateral upper lobe fibronodular opacities with possible cavitation in the right apex. Tracheal deviation to the right. Volume loss in right upper lobe. No pleural effusion.',
    modality: 'X-ray',
    region: 'Chest',
  },
];

const SIG_COLORS: Record<string, string> = {
  'Normal': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Incidental': 'bg-blue-100 text-blue-700 border-blue-200',
  'Clinically Significant': 'bg-amber-100 text-amber-700 border-amber-200',
  'Urgent': 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function AIRadiologyAssistant() {
  const [findings, setFindings] = useState('');
  const [modality, setModality] = useState('');
  const [bodyRegion, setBodyRegion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RadiologyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<AnalyzeCitation[]>([]);
  const [meta, setMeta] = useState<{ provider?: string; model?: string; cached?: boolean }>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
    if (files.length > 0 && !findings.trim()) {
      setFindings(`Analyzing uploaded imaging file: ${files[0].name}`);
    }
  }, [findings]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => 
      f.type.startsWith('image/') || 
      f.type === 'application/dicom' ||
      f.name.endsWith('.dcm') ||
      f.name.endsWith('.nii') ||
      f.name.endsWith('.nii.gz') ||
      f.type === 'application/pdf'
    );
    if (validFiles.length > 0) handleFilesSelected(validFiles);
  }, [handleFilesSelected]);

  const handleAnalyze = async () => {
    if (!findings.trim() && uploadedFiles.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        formData.append('type', 'radiology');
        formData.append('data', JSON.stringify({
          findings: findings || `Analysis of ${uploadedFiles.map(f => f.name).join(', ')}`,
          modality: modality || undefined,
          body_region: bodyRegion || undefined,
          hasAttachments: true,
          fileCount: uploadedFiles.length,
        }));
        uploadedFiles.forEach(file => formData.append('files', file));
        
        const res = await fetch('/api/ai/analyze', { method: 'POST', body: formData });
        const data = await res.json() as RadiologyAnalyzeResponse;
        if (data.results) {
          setResult(data.results);
          setCitations(Array.isArray(data.citations) ? data.citations : []);
          setMeta({ provider: data.provider, model: data.model, cached: data.cached === true });
        } else {
          throw new Error(data.error || 'Failed to analyse imaging');
        }
      } else {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'radiology',
            data: { findings, modality: modality || undefined, body_region: bodyRegion || undefined },
          }),
        });
        const data = await res.json() as RadiologyAnalyzeResponse;
        if (data.results) {
          setResult(data.results);
          setCitations(Array.isArray(data.citations) ? data.citations : []);
          setMeta({ provider: data.provider, model: data.model, cached: data.cached === true });
        } else {
          throw new Error(data.error || 'Failed to analyse imaging');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null); setCitations([]); setMeta({});
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-content-bg rounded-[2.5rem] border border-content-border shadow-2xl overflow-hidden flex flex-col h-full relative group">
      {/* Dynamic Background Aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-portal-primary/5 blur-[120px] rounded-full group-hover:bg-portal-primary/10 transition-colors duration-1000" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-portal-primary/5 blur-[100px] rounded-full group-hover:bg-portal-primary/10 transition-colors duration-1000" />
      </div>

      <div className="p-10 relative z-10 flex flex-col h-full">
        {/* Header with Antigravity Flair */}
        <div className="flex items-start justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-content-bg border border-content-border rounded-3xl flex items-center justify-center shadow-2xl shadow-portal-primary/5 relative overflow-hidden group/icon">
              <div className="absolute inset-0 bg-gradient-to-br from-portal-primary/10 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity" />
              <ScanLine className="w-9 h-9 text-portal-primary relative z-10" />
            </div>
            <div>
              <h3 className="text-2xl font-serif italic text-ink tracking-tight py-0.5 uppercase tracking-tighter">AfyaMedic AI</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-portal-primary animate-pulse" />
                <span className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Imaging Interpretation Assistant</span>
              </div>
            </div>
          </div>
          
          {(meta.provider || meta.model || meta.cached) && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-mist uppercase tracking-widest">ANALYSIS NODE</span>
                <span className="rounded-full border border-portal-primary/20 bg-portal-primary/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-portal-primary">
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

        {/* Modality & Region selectors */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Modality</label>
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="w-full bg-content-surface border border-content-border rounded-card px-4 py-3 text-sm text-ink focus:border-portal-primary outline-none transition-all hover:bg-content-bg"
            >
              <option value="" className="bg-content-bg">Select modality</option>
              {MODALITIES.map((m) => <option key={m} value={m} className="bg-content-bg">{m}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Body Region</label>
            <input
              value={bodyRegion}
              onChange={(e) => setBodyRegion(e.target.value)}
              placeholder="e.g. Chest, Head, Abdomen"
              className="w-full bg-content-surface border border-content-border rounded-card px-4 py-3 text-sm text-ink placeholder:text-slate/40 focus:border-portal-primary outline-none transition-all hover:bg-content-bg"
            />
          </div>
        </div>

        {/* File Upload Zone */}
        <div 
          className={cn(
            "mb-6 transition-all duration-300 rounded-3xl border border-dashed p-1",
            isDragging ? "border-portal-primary bg-portal-primary/5 scale-[1.01]" : "border-content-border bg-content-surface/50"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <DragAndDropUploader
            onFilesSelected={handleFilesSelected}
            accept="image/*,.dcm,.nii,.nii.gz,.pdf"
            multiple={true}
            maxSizeMB={50}
            className="rounded-card border-none bg-transparent"
          />
          
          {uploadedFiles.length > 0 && (
            <div className="p-4 space-y-2 border-t border-content-border">
              <p className="text-[10px] font-bold text-portal-primary uppercase tracking-widest pl-1">
                Attached Imaging Files ({uploadedFiles.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 bg-content-bg border border-content-border rounded-card px-4 py-3 group/file hover:border-portal-primary/30 transition-all"
                  >
                    <div className="w-10 h-10 rounded-card bg-portal-primary/10 flex items-center justify-center shrink-0 group-hover/file:scale-105 transition-transform">
                      {file.type.startsWith('image/') ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image className="w-5 h-5 text-portal-primary" aria-hidden="true" />
                      ) : (
                        <File className="w-5 h-5 text-portal-primary" />
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

        {/* Findings input */}
        <div className="space-y-2 mb-8">
          <label className="text-[10px] font-bold text-slate uppercase tracking-[0.2em] pl-1">Radiological Findings / Report</label>
          <VoiceTextInput
            placeholder="Paste radiologist findings, describe imaging observations, or use the microphone..."
            initialText={findings}
            onSubmit={(text) => {
              setFindings(text);
              handleAnalyze();
            }}
            onVoiceResult={(text) => setFindings(prev => prev + (prev ? ' ' : '') + text)}
            allowVoice={true}
            allowSpeechOutput={false}
            maxLength={8000}
            variant="compact"
            suggestions={QUICK_PROMPTS.map(qp => qp.label)}
            onSuggestionClick={(suggestion) => {
              const qp = QUICK_PROMPTS.find(q => q.label === suggestion);
              if (qp) {
                setFindings(qp.findings);
                setModality(qp.modality);
                setBodyRegion(qp.region);
              }
            }}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !findings.trim()}
          className={cn(
            'w-full py-4 rounded-card font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all relative overflow-hidden group/btn mb-8 shadow-xl',
            (analyzing || !findings.trim())
              ? 'bg-content-surface text-slate cursor-not-allowed border border-content-border'
              : 'bg-portal-primary text-white hover:bg-portal-primary/90 active:scale-[0.98] shadow-portal-primary/20'
          )}
        >
          {analyzing ? <><Activity className="w-4 h-4 animate-spin" /> Analysing imaging...</> : <><Sparkles className="w-4 h-4" /> Interpret Imaging</>}
        </button>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
          {error && (
            <div className="p-5 rounded-card bg-rose-500/5 border border-rose-500/20 text-rose-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-3 animate-in shake-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" /> {error}
            </div>
          )}
          {!result && !analyzing && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-content-border rounded-3xl bg-content-surface/30">
              <div className="w-16 h-16 bg-portal-primary/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Info className="w-8 h-8 text-portal-primary/40" />
              </div>
              <h4 className="text-ink font-bold text-sm mb-2 uppercase tracking-tighter">Awaiting Imaging Data</h4>
              <p className="text-slate text-xs font-semibold leading-relaxed max-w-[260px] uppercase tracking-tighter">Enter findings above or upload imaging files for AI interpretation.</p>
            </div>
          )}
          {analyzing && (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-content-bg/5 rounded-card border border-white/5 flex items-center p-5 gap-4">
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
              {/* Impression - High Impact */}
              <div className="p-8 rounded-[2rem] bg-content-bg border border-portal-primary/20 relative overflow-hidden group/card shadow-2xl transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-portal-primary/5 blur-[80px] -mr-24 -mt-24 group-hover/card:bg-portal-primary/10 transition-all" />
                <div className="text-[10px] font-black text-portal-primary uppercase tracking-[0.25em] mb-4 flex items-center gap-3">
                  <Activity className="w-4 h-4" />
                  Primary Impression
                </div>
                <p className="text-lg text-ink font-serif italic leading-relaxed font-bold border-l-4 border-portal-primary pl-6 py-2">
                  {result.impression}
                </p>
              </div>
              
              {/* Findings */}
              {result.findings?.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pl-1">
                    <h4 className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Structural Analysis Findings</h4>
                    <span className="text-[10px] font-bold text-mist uppercase tracking-widest">{result.findings.length} Anomalies Mapped</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {result.findings.map((f, i) => (
                      <div key={i} className="p-6 rounded-[1.5rem] bg-content-bg border border-content-border flex items-center justify-between group/marker hover:border-portal-primary/30 transition-all shadow-md hover:shadow-xl">
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="text-sm font-serif italic text-ink tracking-tight mb-1.5 group-hover/marker:text-portal-primary transition-colors">{f.area}</div>
                          <p className="text-xs text-slate font-medium leading-relaxed">{f.observation}</p>
                        </div>
                        <span className={cn(
                          'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 shadow-card transition-all group-hover/marker:scale-105',
                          SIG_COLORS[f.significance] ?? SIG_COLORS.Normal
                        )}>
                          {f.significance.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Differentials */}
              {result.differentials?.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate uppercase tracking-[0.2em] pl-1">Clinical Differentials</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {result.differentials.map((d, i) => (
                      <div key={i} className="p-6 rounded-[1.5rem] bg-content-bg border border-content-border flex items-center gap-6 group/item hover:border-portal-primary/30 transition-all shadow-md">
                        <div className="flex-1">
                          <div className="text-sm font-bold text-ink uppercase tracking-widest mb-2 group-hover/item:text-portal-primary">{d.name}</div>
                          <div className="flex items-center gap-3">
                            <div className="text-[10px] font-black text-mist uppercase tracking-widest">Confidence</div>
                            <div className="w-32 h-1.5 bg-content-surface rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-portal-primary shadow-[0_0_12px_rgba(37,99,235,0.4)] transition-all duration-1000" 
                                style={{ width: `${d.confidence}%` }} 
                              />
                            </div>
                            <span className="text-[11px] font-black text-portal-primary font-mono">{d.confidence}%</span>
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-card bg-portal-primary/10 flex items-center justify-center text-portal-primary border border-portal-primary/20">
                           <Info className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up */}
              {result.follow_up && (
                <div className="p-5 rounded-3xl bg-content-surface/50 border border-content-border shadow-lg">
                  <div className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Recommended Follow-up
                  </div>
                  <p className="text-[12px] text-ink leading-relaxed font-semibold italic">{result.follow_up}</p>
                </div>
              )}

              {citations.length > 0 && (
                <div className="p-5 rounded-3xl bg-content-bg border border-content-border shadow-lg overflow-hidden relative">
                  <div className="text-[10px] font-bold text-slate uppercase tracking-widest mb-4">Supporting Literature</div>
                  <ul className="space-y-3">
                    {citations.map((citation, index) => (
                      <li key={citation.id || `${index}-${citation.title}`} className="flex gap-3 group/cite">
                        <span className="shrink-0 w-6 h-6 rounded bg-portal-primary/5 border border-portal-primary/10 flex items-center justify-center text-[10px] font-black text-portal-primary">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[11px] font-bold text-slate group-hover/cite:text-ink transition-colors truncate uppercase tracking-tighter">{citation.title}</p>
                            {citation.url && (
                              <a href={citation.url} target="_blank" rel="noreferrer" className="text-[9px] font-black text-portal-primary hover:text-blue-600 uppercase tracking-widest whitespace-nowrap">
                                View Paper
                              </a>
                            )}
                          </div>
                          <p className="text-[9px] text-mist font-bold uppercase tracking-widest">{citation.source}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-portal-primary/5 rounded-card p-4 text-[9px] font-bold text-slate uppercase tracking-widest flex items-center gap-3 border border-portal-primary/10">
                <Info className="w-4 h-4 text-portal-primary" />
                AI-assisted interpretation — always correlate with clinical findings and radiologist report.
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const report = `RADIOLOGY AI ANALYSIS REPORT\n${'='.repeat(50)}\n\nIMPRESSION\n${result.impression}\n\nFINDINGS\n${result.findings?.map(f => `${f.area}: ${f.observation} (${f.significance})`).join('\n') || 'No findings'}\n\nDIFFERENTIALS\n${result.differentials?.map(d => `${d.name} (${d.confidence}% confidence)`).join('\n') || 'No differentials'}\n\nFOLLOW-UP\n${result.follow_up || 'No follow-up required'}\n\n${'='.repeat(50)}\nGenerated: ${new Date().toLocaleString()}\nAfyaHero Medical AI`;
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `radiology-report-${Date.now()}.txt`;
                    a.click();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-card bg-content-surface border border-content-border text-[10px] font-black uppercase tracking-widest text-slate hover:bg-content-bg hover:text-ink transition-all shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-card bg-content-surface border border-content-border text-[10px] font-black uppercase tracking-widest text-slate hover:bg-content-bg hover:text-ink transition-all shadow-lg"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-content-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-portal-primary shadow-[0_0_8px_rgba(50,130,184,0.3)]" />
            <p className="text-[10px] font-black text-slate uppercase tracking-[0.2em]">Imaging Intelligence</p>
          </div>
          <div className="text-[10px] font-black text-portal-primary uppercase tracking-widest flex items-center gap-1.5">
            Verified Analysis <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
