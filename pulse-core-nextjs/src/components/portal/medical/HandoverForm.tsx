'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Stethoscope, History, Activity, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface HandoverFormProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  onSuccess?: () => void;
}

export default function HandoverForm({ isOpen, onClose, patientId, patientName, onSuccess }: HandoverFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientId: patientId || '',
    patientName: patientName || '',
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch('/api/medical/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (resp.ok) {
        onSuccess?.();
        onClose();
      } else {
        throw new Error('Failed to submit handover');
      }
    } catch (err: any) {
      logger.error('Handover submission error:', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />

          {/* Slide-over Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-content-bg shadow-[-20px_0_50px_rgba(0,0,0,0.3)] z-[101] flex flex-col border-l border-white/5"
          >
            {/* Header */}
            <div className="p-8 border-b border-content-border bg-content-surface/30">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-card bg-[#2563EB]/10 flex items-center justify-center border border-[#2563EB]/20">
                    <History className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-text-primary font-serif">Shift Handover (SBAR)</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mt-1">Structured Clinical Transition</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-content-surface rounded-card transition-all border border-transparent hover:border-content-border"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="flex items-center gap-4 px-5 py-4 rounded-card bg-content-bg border border-content-border shadow-card">
                <div className="w-10 h-10 rounded-full bg-content-surface flex items-center justify-center border border-content-border shadow-card">
                  <User className="w-5 h-5 text-slate" />
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-mist">Patient Identification</div>
                  <div className="text-sm font-bold text-ink font-serif">{patientName || 'Searching...'} <span className="text-slate ml-2 font-mono text-[10px] font-bold">ID: {patientId || 'TBD'}</span></div>
                </div>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary">Clinical Observation (S-B)</span>
                </div>
                
                <div className="space-y-6">
                  <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">Situation (Current Crisis/Main Issue)</label>
                    <textarea 
                      required
                      value={formData.situation}
                      onChange={(e) => setFormData({...formData, situation: e.target.value})}
                      placeholder="e.g. Acute chest pain, respiratory distress..."
                      className="w-full h-24 bg-content-surface border border-content-border rounded-card p-4 text-sm outline-none focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB]/40 transition-all font-medium placeholder:opacity-30"
                    />
                  </div>

                  <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">Background (History & Labs)</label>
                    <textarea 
                      required
                      value={formData.background}
                      onChange={(e) => setFormData({...formData, background: e.target.value})}
                      placeholder="e.g. Admitted via ER, Hx of CVD, ECG shows ST elevation..."
                      className="w-full h-24 bg-content-surface border border-content-border rounded-card p-4 text-sm outline-none focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB]/40 transition-all font-medium placeholder:opacity-30"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary">Plan & Instruction (A-R)</span>
                </div>

                <div className="space-y-6">
                  <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">Assessment (Your Impression)</label>
                    <textarea 
                      required
                      value={formData.assessment}
                      onChange={(e) => setFormData({...formData, assessment: e.target.value})}
                      placeholder="e.g. Likely MI, patient remains unstable..."
                      className="w-full h-24 bg-content-surface border border-content-border rounded-card p-4 text-sm outline-none focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB]/40 transition-all font-medium placeholder:opacity-30"
                    />
                  </div>

                  <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] mb-2 block">Recommendation (Next Steps)</label>
                    <textarea 
                      required
                      value={formData.recommendation}
                      onChange={(e) => setFormData({...formData, recommendation: e.target.value})}
                      placeholder="e.g. Initiate cardiac stabilization, monitor vitals q15m..."
                      className="w-full h-24 bg-content-surface border border-content-border rounded-card p-4 text-sm outline-none focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB]/40 transition-all font-medium placeholder:opacity-30"
                    />
                  </div>
                </div>
              </section>
            </form>

            {/* Footer Actions */}
            <div className="p-8 border-t border-content-border bg-content-surface/40 flex items-center gap-4">
              <div className="flex-1 flex gap-3 items-center text-text-secondary">
                 <Sparkles className="w-4 h-4 text-[#2563EB] animate-pulse" />
                 <span className="text-[10px] font-bold font-mono tracking-tight leading-tight">Structured handover improves patient safety outcomes by 33%.</span>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-card text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-content-surface transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 rounded-card bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
              >
                <Send className={cn('w-4 h-4', loading && 'animate-pulse')} />
                {loading ? 'Submitting...' : 'Commit Handover'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
