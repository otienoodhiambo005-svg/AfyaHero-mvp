'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Send, Clock, CheckCircle2, AlertCircle, 
  ChevronRight, ExternalLink, Activity, Info 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SHIFClaim {
  id: string;
  patientName: string;
  idNumber: string;
  benefitType: string;
  amount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'APPROVED' | 'REJECTED';
  submissionDate?: string;
}

interface SHIFClaimsPanelProps {
  patientName: string;
  totalAmount: number;
  onClose: () => void;
}

const SHIF_STATUS_COLORS = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

export default function SHIFClaimsPanel({ patientName, totalAmount, onClose }: SHIFClaimsPanelProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimResponse, setClaimResponse] = useState<any>(null);

  const simulateSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStep(3);
      setClaimResponse({
        claimId: 'SHIF-2026-X881',
        ackTimestamp: new Date().toISOString(),
        adjudicationStatus: 'PENDING_REVIEW'
      });
    }, 2500);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-content-bg shadow-2xl z-50 flex flex-col border-l border-content-border">
      {/* Header */}
      <div className="px-6 py-5 bg-[#080F0C] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-none">SHIF Claims Portal</h2>
            <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase mt-1">Social Health Insurance Fund</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-content-bg/10 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Patient Context */}
        <div className="bg-content-surface rounded-card p-4 border border-content-border">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">In-Patient / Out-Patient</p>
              <h3 className="font-bold text-ink">{patientName}</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Charge</p>
              <p className="font-bold text-emerald-600">KES {totalAmount.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-content-border italic text-xs text-slate-500">
            <Info className="w-3 h-3" />
            SHIF pre-authorization required for surgery/specialized care.
          </div>
        </div>

        {/* Claim Progression */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
              step >= 1 ? "bg-emerald-500 border-emerald-500 text-white" : "border-content-border text-slate-400"
            )}>1</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">Verify Eligibility</p>
              <p className="text-xs text-slate-500">Check current SHIF balance & coverage</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
              step >= 2 ? "bg-emerald-500 border-emerald-500 text-white" : "border-content-border text-slate-400"
            )}>2</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">Submit Claim Details</p>
              <p className="text-xs text-slate-500">Send the patient visit and billing details for review</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
              step >= 3 ? "bg-emerald-500 border-emerald-500 text-white" : "border-content-border text-slate-400"
            )}>3</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">Approval Tracking</p>
              <p className="text-xs text-slate-500">Follow status until approval and payment confirmation</p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <div className="bg-content-bg border border-content-border rounded-card p-5 shadow-card space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Insurance / ID Number</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  defaultValue="28981022"
                  className="flex-1 bg-content-surface border border-content-border rounded-card px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
                <button className="bg-slate-900 text-white px-4 py-2 rounded-card text-xs font-bold hover:bg-slate-800 transition-colors">Verify</button>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900 uppercase">Status: ACTIVE</p>
                <p className="text-[10px] text-emerald-700">SHA Benefit: Outpatient Limit KES 15,000</p>
              </div>
            </div>
            <button 
              onClick={() => setStep(2)}
              className="w-full bg-[#2563EB] text-white font-bold py-3 rounded-card shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
            >
              Prepare Claim <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-content-bg border border-content-border rounded-card p-5 shadow-card space-y-4">
            <h4 className="font-bold text-sm text-ink border-b border-content-border/50 pb-2">Claim Summary</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {[
                { label: 'Outpatient Consultation', fee: 1500, code: '71001' },
                { label: 'CBC Blood Test', fee: 1200, code: '85025' },
                { label: 'Urinalysis', fee: 600, code: '81000' }
              ].map(item => (
                <div key={item.code} className="flex justify-between items-center text-xs p-2 bg-content-surface rounded-lg">
                  <div>
                    <p className="font-bold text-slate-700">{item.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono italic">CPT: {item.code}</p>
                  </div>
                  <p className="font-bold text-ink">KES {item.fee}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center py-2 border-t border-content-border/50">
              <p className="text-sm font-bold text-ink">Subtotal</p>
              <p className="text-sm font-bold text-emerald-600">KES 3,300</p>
            </div>
            <button 
              onClick={simulateSubmit}
              disabled={isSubmitting}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-card shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:grayscale transition-all"
            >
              {isSubmitting ? <Activity className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
              {isSubmitting ? 'Submitting claim...' : 'Submit Claim to SHIF'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-ink">Claim Acknowledged</h3>
            <p className="text-sm text-slate-500 px-4">
              Your claim <span className="font-mono text-blue-600 font-bold">{claimResponse?.claimId}</span> has been received by SHIF portal.
            </p>
            
            <div className="bg-content-surface border border-content-border rounded-card p-4 text-left mt-6">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Submission Details</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ACK Code</span>
                  <span className="font-mono text-ink">SHA_ACK_2910X</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Submission Type</span>
                  <span className="text-ink">Electronic claim</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Hospital Code</span>
                  <span className="text-ink">AFH-HOSP-044</span>
                </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-card mt-6"
            >
              Return to Billing
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-content-border/50 bg-content-surface text-center">
        <p className="text-[10px] text-slate-400">Claims are processed under Kenya Data Protection Act 2019.</p>
        <div className="flex items-center justify-center gap-2 mt-1">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Live SHIF connection</span>
        </div>
      </div>
    </div>
  );
}
