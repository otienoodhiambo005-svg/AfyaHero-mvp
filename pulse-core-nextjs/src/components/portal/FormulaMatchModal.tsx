'use client';

import React, { useState, useEffect } from 'react';
import { 
  Beaker, 
  ChevronRight, 
  AlertCircle, 
  Calculator, 
  FileText, 
  Trash2, 
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormulaMatchModalProps {
  open: boolean;
  onClose: () => void;
}

interface CalculatedDose {
  tabletCount: number;
  diluentVolume: number;
  totalVolume: number;
  concentration: string;
  shelfLife: string;
  storage: string;
}

export default function FormulaMatchModal({ open, onClose }: FormulaMatchModalProps) {
  const [step, setStep] = useState(1);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [targetConc, setTargetConc] = useState('100'); // mg
  const [targetVol, setTargetVol] = useState('5'); // mL
  const [calculation, setCalculation] = useState<CalculatedDose | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Prevention of body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [open]);

  if (!open) return null;

  const handleCalculate = () => {
    setIsCalculating(true);
    // Simulate AI clinical calculation
    setTimeout(() => {
      setCalculation({
        tabletCount: 2,
        diluentVolume: 40,
        totalVolume: 50,
        concentration: '100mg / 5mL',
        shelfLife: '7 Days',
        storage: 'Refrigerate (2-8°C)'
      });
      setIsCalculating(false);
      setStep(2);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#080F0C]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-[#0F1715] border border-emerald/20 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-emerald/10 flex items-center justify-between bg-gradient-to-b from-emerald/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-card bg-emerald/10 border border-emerald/20 flex items-center justify-center">
              <Beaker className="w-6 h-6 text-emerald" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">FormulaMatch AI</h2>
              <p className="text-xs text-sage font-medium uppercase tracking-wider">Clinical Compounding Assistant</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-card hover:bg-content-bg/5 text-mist transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {step === 1 ? (
            <div className="space-y-6">
              <div className="p-4 rounded-card bg-emerald/5 border border-emerald/10 flex gap-4">
                <Info className="w-5 h-5 text-emerald shrink-0 mt-0.5" />
                <p className="text-sm text-sage leading-relaxed">
                  FormulaMatch helps you safely convert adult solid dosage forms into pediatric liquid formulations when standard syrups are unavailable.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-emerald uppercase tracking-widest mb-2 block">Source Medication</label>
                  <div className="relative">
                    <select 
                      value={selectedDrug}
                      onChange={(e) => setSelectedDrug(e.target.value)}
                      className="w-full h-12 bg-forest/20 border border-emerald/20 rounded-card px-4 text-sm text-white focus:ring-2 focus:ring-emerald/20 outline-none appearance-none"
                    >
                      <option value="">Select Tablet...</option>
                      <option value="Metformin 500mg">Metformin 500mg</option>
                      <option value="Amoxicillin 500mg">Amoxicillin 500mg</option>
                      <option value="Ciprofloxacin 500mg">Ciprofloxacin 500mg</option>
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sage rotate-90" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-emerald uppercase tracking-widest mb-2 block">Target Concentration</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      value={targetConc}
                      onChange={(e) => setTargetConc(e.target.value)}
                      className="flex-1 h-12 bg-forest/20 border border-emerald/20 rounded-card px-4 text-sm text-white focus:ring-2 focus:ring-emerald/20 outline-none"
                      placeholder="mg"
                    />
                    <span className="text-sage text-sm font-bold">mg /</span>
                    <input 
                      type="number"
                      value={targetVol}
                      onChange={(e) => setTargetVol(e.target.value)}
                      className="w-20 h-12 bg-forest/20 border border-emerald/20 rounded-card px-4 text-sm text-white focus:ring-2 focus:ring-emerald/20 outline-none text-center"
                      placeholder="mL"
                    />
                    <span className="text-sage text-sm font-bold">mL</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-card bg-amber-500/5 border border-amber-500/20 flex gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-400">Stability Notice</p>
                  <p className="text-xs text-amber-200/70">
                    Compounding Metformin into an aqueous solution requires immediate use or specific suspension agents to maintain stability.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Results View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-3xl bg-forest/10 border border-emerald/10 space-y-4">
                  <p className="text-[10px] font-bold text-emerald uppercase tracking-widest">Ingredients Needed</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald/5 pb-2">
                      <span className="text-sm text-sage">Source Tablets</span>
                      <span className="text-lg font-bold text-white">{calculation?.tabletCount} Units</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-emerald/5 pb-2">
                      <span className="text-sm text-sage">Diluent (Water/Syrup)</span>
                      <span className="text-lg font-bold text-white">{calculation?.diluentVolume} mL</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-sage font-bold">Final Volume</span>
                      <span className="text-lg font-bold text-emerald">{calculation?.totalVolume} mL</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-forest/10 border border-emerald/10 space-y-4">
                  <p className="text-[10px] font-bold text-emerald uppercase tracking-widest">Clinical specs</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald/5 pb-2">
                      <span className="text-sm text-sage">Concentration</span>
                      <span className="text-sm font-bold text-white">{calculation?.concentration}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-emerald/5 pb-2">
                      <span className="text-sm text-sage">Shelf Life</span>
                      <span className="text-sm font-bold text-white">{calculation?.shelfLife}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-sage font-bold">Storage</span>
                      <span className="text-sm font-bold text-white">{calculation?.storage}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-emerald/5 border border-emerald/20 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-8 h-8 text-ink" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Calculation Success</h3>
                  <p className="text-sm text-sage mt-1 max-w-xs mx-auto">
                    Final solution: <span className="text-emerald font-bold">Metformin 20mg/mL</span>. 
                    Ensure thorough triturating before mixing with diluent.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-emerald/10 bg-forest/5 flex items-center justify-between">
          <p className="text-[10px] text-sage/60 max-w-[240px]">
            AI-generated calculations. Final clinical responsibility lies with the dispensing pharmacist.
          </p>
          <div className="flex items-center gap-4">
            {step === 2 && (
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-card text-sm font-bold text-sage hover:text-white transition-colors"
              >
                Recalculate
              </button>
            )}
            <button
              onClick={step === 1 ? handleCalculate : onClose}
              disabled={isCalculating || (step === 1 && !selectedDrug)}
              className={cn(
                "px-8 py-3 rounded-card text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                step === 1 
                  ? "bg-emerald text-ink hover:bg-emerald/90 shadow-emerald/20" 
                  : "bg-content-bg/10 text-white border border-white/10 hover:bg-content-bg/20"
              )}
            >
              {isCalculating ? (
                <>
                  <Calculator className="w-4 h-4 animate-bounce" />
                  Running AI Math...
                </>
              ) : step === 1 ? (
                <>
                  <Calculator className="w-4 h-4" />
                  Run AI Calculation
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Print Compound Label & Close
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
