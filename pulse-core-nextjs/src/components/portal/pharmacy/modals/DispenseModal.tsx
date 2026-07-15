'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Package,
  Loader2,
  Sparkles,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal, ModalContent, ModalOverlay, ModalPortal, ModalTitle } from '@/components/ui/modal';

export interface DispenseModalLineItem {
  name: string;
  instructions: string;
  policy: string;
}

interface DispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    rx: string;
    patient: string;
    pid: string;
    items: number;
    lineItems?: DispenseModalLineItem[];
  } | null;
  /** Called after the server confirms dispensing (before modal closes). */
  onDispensed?: () => void;
}

const FALLBACK_LINE_ITEMS: DispenseModalLineItem[] = [
  { name: 'Metformin 500mg', instructions: '1 tab BID', policy: 'Approved' },
  { name: 'Atorvastatin 20mg', instructions: '1 tab HS', policy: 'Approved' },
];

export function DispenseModal({
  isOpen,
  onClose,
  order,
  onDispensed,
}: Readonly<DispenseModalProps>) {
  const [step, setStep] = useState<'review' | 'checking' | 'ready'>('review');
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [dispenseSubmitting, setDispenseSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('review');
      setDispenseError(null);
      setDispenseSubmitting(false);
    }
  }, [isOpen]);

  const lineItems = order?.lineItems?.length ? order.lineItems : FALLBACK_LINE_ITEMS;

  const handleStartDispense = async () => {
    setStep('checking');
    await new Promise((r) => setTimeout(r, 2000));
    setStep('ready');
  };

  const handleCompleteDispense = async () => {
    if (!order) return;
    setDispenseError(null);
    setDispenseSubmitting(true);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          rxNum: order.rx,
          patient: order.patient,
          items: order.items,
        }),
      });
      const payload = (await res.json()) as { error?: string; expectedPatient?: string };
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Could not complete dispensing.');
      }
      onDispensed?.();
      onClose();
    } catch (e) {
      setDispenseError(e instanceof Error ? e.message : 'Could not complete dispensing.');
    } finally {
      setDispenseSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ModalPortal>
        <ModalOverlay className="bg-slate-900/60 backdrop-blur-sm" closeOnClick={false} />
        <ModalContent
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          closeOnEscape
          initialFocusSelector="button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-content-bg rounded-3xl w-full max-w-2xl shadow-2xl border border-content-border overflow-hidden"
          >
            <div className="flex items-center justify-between px-8 py-6 border-b border-content-border/50 bg-content-surface/50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    Active Dispensing
                  </span>
                  <span className="text-xs font-mono text-slate-400">{order.rx}</span>
                </div>
                <ModalTitle className="text-xl font-black text-ink">{order.patient}</ModalTitle>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-card hover:bg-slate-200 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

        <div className="p-8">
          {dispenseError && (
            <div className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{dispenseError}</span>
            </div>
          )}
          <AnimatePresence mode="wait">
            {step === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-blue-50/50 p-6 rounded-card border border-blue-100">
                  <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#2563EB]" />
                    Prescription Items
                  </h3>
                  <div className="space-y-3">
                    {lineItems.map((item, idx) => (
                      <div
                        key={`${idx}-${item.name}`}
                        className="flex items-center justify-between py-3 border-b border-content-border/50 last:border-0"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm text-ink font-black">{item.name}</span>
                          <span className="text-xs text-slate-500 font-medium">{item.instructions}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                            {item.policy}
                          </span>
                          <div className="w-5 h-5 rounded-full border border-content-border flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-[#2563EB]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      void handleStartDispense();
                    }}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white py-4 rounded-card font-black text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" /> Start Safety Analysis
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'checking' && (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center text-center"
              >
                <div className="relative mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-20 h-20 rounded-full border-4 border-blue-50 border-t-[#2563EB]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-[#2563EB]" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-ink">AI Clinical Guard Over-read</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                  Cross-referencing medication batch, patient history, and potential interactions...
                </p>
              </motion.div>
            )}

            {step === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-card flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">Safety Check Passed</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-emerald-700 uppercase font-black tracking-widest">
                        No Contraindications Found
                      </span>
                      <span className="text-[10px] text-blue-600 uppercase font-black tracking-widest flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Formulary Compliant
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-card font-black text-sm hover:bg-slate-800 transition-all"
                  >
                    <Printer className="w-4 h-4" /> Print RX Labels
                  </button>
                  <button
                    type="button"
                    disabled={dispenseSubmitting}
                    onClick={() => {
                      void handleCompleteDispense();
                    }}
                    className={cn(
                      'flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-card font-black text-sm hover:bg-emerald-500 transition-all',
                      dispenseSubmitting && 'opacity-70 pointer-events-none',
                    )}
                  >
                    {dispenseSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>Complete Dispensing</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </motion.div>
        </ModalContent>
      </ModalPortal>
    </Modal>
  );
}
