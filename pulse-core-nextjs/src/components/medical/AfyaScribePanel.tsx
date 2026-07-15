'use client';

import { useState } from 'react';
import { Mic, MicOff, Send, Loader2, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useEnhancedAfyaScribe } from '@/hooks/useEnhancedAfyaScribe';
import { cn } from '@/lib/utils';

interface AfyaScribePanelProps {
  consultationId: string;
  className?: string;
}

export default function AfyaScribePanel({ consultationId, className }: AfyaScribePanelProps) {
  const [anonymityEnabled, setAnonymityEnabled] = useState(true);
  
  const {
    status,
    transcript,
    soap,
    isGeneratingSOAP,
    isConnected,
    startRecording,
    stopRecording,
    generateSOAP,
    clearTranscript,
    reconnect
  } = useEnhancedAfyaScribe({
    consultationId,
  });

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'connecting';

  return (
    <div className={cn('flex flex-col h-full border border-content-border rounded-card bg-content-bg shadow-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-content-border bg-content-surface/30">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-ink font-serif tracking-tight">AI Clinical Scribe</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full shadow-card',
            isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate/30'
          )} />
          <span className="text-[10px] font-black uppercase tracking-widest text-mist">
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Anonymity Notice */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 shadow-inner">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-blue-800 uppercase tracking-tight">
            ✅ Patient anonymity active. Personal identifiers redacted.
          </p>
          <button
            onClick={() => setAnonymityEnabled(!anonymityEnabled)}
            className={cn(
              'text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border',
              anonymityEnabled
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                : 'bg-content-bg text-slate border-content-border hover:bg-content-surface'
            )}
          >
            {anonymityEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcript.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[11px] text-slate font-bold uppercase tracking-[0.2em] opacity-40">
              Station Ready. Waiting for audio input...
            </p>
            <p className="text-[10px] text-mist mt-3 font-mono font-bold tracking-tighter uppercase">
              Patient ID Code: {anonymityEnabled ? '********' : consultationId}
            </p>
          </div>
        ) : (
          transcript.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                'flex',
                segment.speaker === 'doctor' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-card px-4 py-3 text-sm shadow-card border border-content-border',
                  segment.speaker === 'doctor'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-content-surface text-ink'
                )}
              >
                <div className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">
                  {segment.speaker === 'doctor' ? 'Clinician' : 'Patient'}
                </div>
                <p className="leading-relaxed font-bold tracking-tight uppercase text-[12px]">{anonymityEnabled ? segment.text.replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, '[REDACTED]').replace(/\d{3}-\d{2}-\d{4}/g, '[ID REDACTED]') : segment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SOAP Note Preview */}
      {soap && (
        <div className="border-t border-content-border p-5 bg-content-surface/40">
          <h4 className="text-[10px] font-black text-ink uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <RefreshCw className="w-3 h-3 text-blue-600" /> Draft SOAP Context
          </h4>
          <div className="text-[11px] space-y-3 text-slate font-bold uppercase tracking-tight">
            <div>
              <span className="font-semibold">S:</span> {soap.subjective}
            </div>
            <div>
              <span className="font-semibold">O:</span> {soap.objective}
            </div>
            <div>
              <span className="font-semibold">A:</span> {soap.assessment}
            </div>
            <div>
              <span className="font-semibold">P:</span> {soap.plan}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-content-border/50 text-[9px] font-black uppercase tracking-[0.2em] text-mist flex justify-between">
            <span>Accuracy: {(soap.confidenceScore * 100).toFixed(0)}%</span>
            <span>Engine: {soap.aiModel}</span>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="border-t border-content-border p-4 bg-content-bg rounded-b-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Microphone Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={cn(
                'p-4 rounded-card transition-all flex items-center justify-center min-w-[56px] min-h-[56px] shadow-card border',
                isRecording
                  ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-red-200 shadow-xl'
                  : 'bg-content-bg text-ink border-content-border hover:bg-content-surface hover:shadow-md'
              )}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Clear Button */}
            <button
              onClick={clearTranscript}
              disabled={transcript.length === 0}
              className="p-4 rounded-card bg-content-bg text-slate border border-content-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed group shadow-card"
              title="Clear transcript"
            >
              <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>

            {/* Reconnect Button */}
            <button
              onClick={reconnect}
              className="p-4 rounded-card bg-content-bg text-slate border border-content-border hover:bg-content-surface transition-all shadow-card"
              title="Reconnect"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Indicator */}
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-mist">
              {status === 'idle' && 'Ready'}
              {status === 'recording' && 'Live Transcribing'}
              {status === 'processing' && 'Processing'}
              {status === 'connecting' && 'Connecting...'}
              {status === 'error' && 'Offline'}
            </span>

            {/* Generate SOAP / Send Button */}
            <button
              onClick={generateSOAP}
              disabled={isGeneratingSOAP || transcript.length < 3}
              className={cn(
                'p-4 rounded-card flex items-center justify-center min-w-[56px] min-h-[56px] transition-all shadow-lg',
                transcript.length >= 3 && !isGeneratingSOAP
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-content-surface text-mist border border-content-border opacity-50 cursor-not-allowed'
              )}
              title="Generate SOAP note"
            >
              {isGeneratingSOAP ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}