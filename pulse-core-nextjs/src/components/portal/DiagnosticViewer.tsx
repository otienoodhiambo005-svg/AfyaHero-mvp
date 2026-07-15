'use client';

import React, { useMemo } from 'react';
import { 
  X, BrainCircuit, ShieldCheck, Activity, 
  AlertCircle, CheckCircle2, FlaskConical, 
  Eye, CornerDownRight, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { RadiologyResult, PathologyResult } from '@/types/clinical_ai';

interface DiagnosticViewerProps {
  open: boolean;
  onClose: () => void;
  type: 'radiology' | 'pathology';
  result: RadiologyResult | PathologyResult | null;
  isAnalyzing: boolean;
  patientName: string;
  /** Shown when analysis finished without a result (e.g. network/API failure). */
  error?: string | null;
  onRetry?: () => void;
}

/**
 * DiagnosticViewer: Professional-grade AI insight display.
 * Focused on non-technical terminology (AfyaInsight) to build clinician trust.
 */
export function DiagnosticViewer({ 
  open, 
  onClose, 
  type, 
  result, 
  isAnalyzing, 
  patientName,
  error = null,
  onRetry,
}: DiagnosticViewerProps) {
  
  const findings = useMemo(() => {
    if (!result) return [];
    if (type === 'radiology') return (result as RadiologyResult).findings || [];
    const path = result as PathologyResult;
    return path.path_findings ? [path.primary_recommendation] : [];
  }, [result, type]);

  const recommendations = useMemo(() => {
    if (!result || type !== 'radiology') return [];
    return (result as RadiologyResult).recommendations || [];
  }, [result, type]);

  const confidence = result?.confidence || 0;
  // Non-technical abstraction of consensus logic
  const isHighAgreement = confidence > 0.85;
  const showArbitration = type === 'radiology' && (result as RadiologyResult)?.final_arbitration;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-content-bg rounded-3xl shadow-2xl overflow-hidden border border-content-border flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-content-border flex items-center justify-between bg-content-surface/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-portal-primary/10 rounded-card">
                  {type === 'radiology' ? <Eye className="w-5 h-5 text-portal-primary" /> : <FlaskConical className="w-5 h-5 text-portal-primary" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">
                    {type === 'radiology' ? 'Radiology Scan Insight' : 'Pathology Specimen Analysis'}
                  </h3>
                  <p className="text-xs text-slate font-medium">{patientName} · Diagnostic Review</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-content-surface rounded-card transition-colors">
                <X className="w-5 h-5 text-mist" />
              </button>
            </div>

            {/* Analysis Progress */}
            {isAnalyzing && (
              <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-portal-primary/10 border-t-portal-primary rounded-full animate-spin" />
                  <BrainCircuit className="absolute inset-0 m-auto w-8 h-8 text-portal-primary animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-ink">Executing AfyaInsight™ Analysis</h4>
                  <p className="text-sm text-slate mt-1 max-w-[280px]">Synthesizing multi-modal clinical data for high-integrity identification...</p>
                </div>
              </div>
            )}

            {/* Content */}
            {!isAnalyzing && !result && error && (
              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-3 rounded-card bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-8 h-8 text-rose-600" aria-hidden />
                </div>
                <div className="space-y-2 max-w-md">
                  <h4 className="text-sm font-bold text-ink">Analysis could not complete</h4>
                  <p className="text-xs text-slate leading-relaxed">{error}</p>
                </div>
                {onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-5 py-2.5 rounded-card bg-portal-primary text-white text-xs font-bold hover:shadow-lg hover:shadow-portal-primary/20 transition-all active:scale-95"
                  >
                    Retry analysis
                  </button>
                ) : null}
              </div>
            )}

            {!isAnalyzing && result && (
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Integration Status / Consensus */}
                <div className="p-5 rounded-card bg-portal-primary/[0.03] border border-portal-primary/10 flex items-start gap-4">
                  <div className={cn(
                    "p-2.5 rounded-card shrink-0",
                    isHighAgreement ? "bg-emerald/10 text-emerald" : "bg-amber-500/10 text-amber-600"
                  )}>
                    {isHighAgreement ? <ShieldCheck className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                       Consensus Status: {isHighAgreement ? 'High Integrity Agreement' : 'Advanced Verification Active'}
                    </h4>
                    <p className="text-xs text-slate mt-1 leading-relaxed">
                      {isHighAgreement 
                        ? 'AfyaInsight layers have reached a unified conclusion with high confidence across specialized clinical sub-nets.'
                        : 'Ambiguity detected in initial layers. Advanced clinical arbitration has been triggered to ensure diagnostic safety.'}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-content-border rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${confidence * 100}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            confidence > 0.8 ? "bg-emerald" : "bg-amber-500"
                          )}
                        />
                      </div>
                      <span className="text-[10px] font-bold font-mono text-slate">{Math.round(confidence * 100)}% Confidence</span>
                    </div>
                  </div>
                </div>

                {/* Primary Findings */}
                <section>
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-mist mb-4 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Key Findings
                  </h5>
                  <div className="space-y-3">
                    {findings.map((finding, idx) => (
                      <div key={idx} className="flex gap-3 p-4 bg-content-surface rounded-card border border-content-border">
                        <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
                        <p className="text-sm text-ink font-medium leading-relaxed">{finding}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <section>
                    <h5 className="text-[11px] font-black uppercase tracking-widest text-mist mb-4 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> Clinical Recommendations
                    </h5>
                    <div className="space-y-2">
                      {recommendations.map((rec, idx) => (
                        <div key={idx} className="flex gap-3 pl-1">
                          <CornerDownRight className="w-4 h-4 text-portal-primary shrink-0 opacity-50" />
                          <p className="text-sm text-slate leading-relaxed italic">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Emergency Flag */}
                {(type === 'radiology' && (result as RadiologyResult)?.is_emergency) && (
                  <div className="p-4 rounded-card bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-[11px] font-black text-red-600 uppercase tracking-tighter">Urgent Escalation Required</p>
                      <p className="text-xs text-red-600/80 font-medium">Automatic high-severity detection triggered. Ensure immediate clinical review.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-content-border flex items-center justify-between bg-content-surface/10">
              <span className="text-[10px] font-bold text-slate uppercase tracking-widest">
                AfyaInsight™ Diagnostic Support
              </span>
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-portal-primary text-white text-xs font-bold rounded-card hover:shadow-lg hover:shadow-portal-primary/20 transition-all active:scale-95"
              >
                Close Insight
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
