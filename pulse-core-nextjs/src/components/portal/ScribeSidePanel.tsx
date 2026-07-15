'use client';

import { useEffect } from 'react';
import { X, Sparkles, BrainCircuit, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import AIScribeAssistant from '@/components/medical/AIScribeAssistant';

interface ScribeSidePanelProps {
  open: boolean;
  onClose: () => void;
  patientName?: string;
  consultationId?: string;
  transcript?: string;
  onAnalyze?: (result: any) => void;
}

export function ScribeSidePanel({
  open,
  onClose,
  patientName,
  consultationId,
  transcript,
  onAnalyze
}: ScribeSidePanelProps) {
  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-[520px] max-w-[95vw] bg-content-bg z-50 shadow-2xl transition-transform duration-150 ease-out flex flex-col border-l border-content-border',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-content-border bg-content-bg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-blue-600 rounded-card flex items-center justify-center text-white shadow-xl shadow-blue-600/20 border border-blue-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight uppercase">AfyaScribe AI</h2>
              <p className="text-[10px] text-slate font-black uppercase tracking-widest mt-0.5 opacity-60">Documentation for {patientName || 'Consultation'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate hover:text-ink hover:bg-content-surface rounded-card transition-all relative z-10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Strip */}
        <div className="bg-content-surface/50 border-b border-content-border px-8 py-3 flex items-center justify-between">
           <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Real-time Transcription
           </div>
           <div className="flex items-center gap-2 text-[10px] font-mono text-slate font-bold">
              <Activity className="w-3.5 h-3.5 text-emerald-600" /> SESSION: {consultationId || 'TC-PENDING'}
           </div>
        </div>

        {/* Assistant View */}
        <div className="flex-1 overflow-hidden bg-content-bg">
          <AIScribeAssistant 
            isEmbedded={true}
            transcript={transcript}
            onAnalyze={onAnalyze}
          />
        </div>

        {/* Footer / Status */}
        <div className="px-8 py-5 border-t border-content-border bg-content-surface flex items-center justify-between">
            <p className="text-[9px] font-black text-mist uppercase tracking-[0.3em]">
                AfyaHero Ambient Intelligence v1.0
            </p>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.3)] animate-pulse" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Secure Link</span>
            </div>
        </div>
      </div>
    </>
  );
}
