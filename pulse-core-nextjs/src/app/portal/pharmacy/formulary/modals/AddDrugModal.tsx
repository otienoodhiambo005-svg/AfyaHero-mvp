'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Beaker, ShieldCheck, DollarSign, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddDrugModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function AddDrugModal({ isOpen, onClose }: AddDrugModalProps) {
  const [step, setStep] = useState(1);

  const steps = [
    { id: 1, name: 'Basic Info', icon: <Beaker className="w-4 h-4" /> },
    { id: 2, name: 'Clinical Specs', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 3, name: 'Governance', icon: <Globe2 className="w-4 h-4" /> }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#080F0C]/80"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-content-bg rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-content-border/50 flex items-center justify-between bg-content-bg">
              <div>
                <h2 className="text-xl font-black text-ink leading-tight">Add to Digital Formulary</h2>
                <p className="text-sm text-slate-500 font-medium">Provision new medication for hospital use</p>
              </div>
              <button onClick={onClose} className="p-2.5 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Stepper */}
            <div className="px-8 py-4 bg-content-surface/50 border-b border-content-border/50 flex items-center gap-8">
              {steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                    step === s.id && "bg-[#2563EB] text-white shadow-lg shadow-blue-200",
                    step > s.id && "bg-emerald-500 text-white",
                    step < s.id && "bg-content-bg border border-content-border text-slate-400"
                  )}>
                    {step > s.id ? "✓" : s.id}
                  </div>
                  <span className={cn("text-xs font-bold whitespace-nowrap", step === s.id ? "text-[#2563EB]" : "text-slate-400")}>
                    {s.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="brandName" className="text-xs font-black uppercase tracking-widest text-[#2563EB]">Brand Name</label>
                      <input id="brandName" className="w-full px-4 py-3 rounded-card border border-content-border focus:border-[#2563EB] outline-none text-sm font-medium transition-all" placeholder="e.g. Augmentin" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="genericName" className="text-xs font-black uppercase tracking-widest text-slate-400">Generic Name</label>
                      <input id="genericName" className="w-full px-4 py-3 rounded-card border border-content-border focus:border-[#2563EB] outline-none text-sm font-medium transition-all" placeholder="e.g. Amoxicillin/Clav" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="drugCategory" className="text-xs font-black uppercase tracking-widest text-slate-400">Drug Category</label>
                    <select id="drugCategory" className="w-full px-4 py-3 rounded-card border border-content-border focus:border-[#2563EB] outline-none text-sm font-medium transition-all appearance-none bg-content-bg">
                      <option>Antibiotics</option>
                      <option>Analgesics</option>
                      <option>Antidiabetics</option>
                    </select>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="indications" className="text-xs font-black uppercase tracking-widest text-[#2563EB]">Primary Indications</label>
                    <textarea id="indications" className="w-full px-4 py-3 rounded-card border border-content-border focus:border-[#2563EB] outline-none text-sm font-medium transition-all min-h-[100px]" placeholder="Clinical conditions this drug is approved for..." />
                  </div>
                  <div className="bg-rose-50/50 border border-rose-100 rounded-card p-4 space-y-3">
                    <label htmlFor="contraindications" className="text-xs font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" /> High-Risk Contraindications
                    </label>
                    <input id="contraindications" className="w-full px-4 py-2.5 rounded-card border border-rose-200 focus:border-rose-400 outline-none text-sm font-medium transition-all" placeholder="Add contraindication..." />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="lifecycle" className="text-xs font-black uppercase tracking-widest text-[#2563EB]">Lifecycle State</label>
                      <select id="lifecycle" className="w-full px-4 py-3 rounded-card border border-content-border focus:border-[#2563EB] outline-none text-sm font-medium transition-all appearance-none bg-content-bg">
                        <option>Approved</option>
                        <option>Restricted</option>
                        <option>Deferred</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="procurement" className="text-xs font-black uppercase tracking-widest text-slate-400">Procurement Policy</label>
                      <select id="procurement" className="w-full px-4 py-3 rounded-card border border-content-border focus:border-[#2563EB] outline-none text-sm font-medium transition-all appearance-none bg-content-bg">
                        <option>Contracted</option>
                        <option>Local Purchase</option>
                        <option>Donation</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-card bg-blue-50/50 border border-blue-100">
                    <div className="w-10 h-10 rounded-full bg-content-bg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-ink">Cost Containment Check</p>
                      <p className="text-xs text-slate-500">AI will automatically analyze warehouse prices vs manual entry.</p>
                    </div>
                    <div className="w-12 h-6 rounded-full bg-[#2563EB] flex items-center justify-end px-1">
                      <div className="w-4 h-4 rounded-full bg-content-bg" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-content-surface border-t border-content-border/50 flex items-center justify-between">
              <button 
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-6 py-3 rounded-card border border-content-border text-slate-600 text-sm font-black disabled:opacity-0 transition-all"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                {step < 3 ? (
                  <button 
                    onClick={() => setStep(s => s + 1)}
                    className="px-8 py-3 rounded-card bg-[#2563EB] text-white text-sm font-black shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Continue
                  </button>
                ) : (
                  <button 
                    onClick={onClose}
                    className="px-8 py-3 rounded-card bg-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Commit to Formulary
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
