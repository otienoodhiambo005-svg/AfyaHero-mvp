'use client';

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck,
  ChevronRight,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMpesaPayment } from '@/hooks/useMpesaPayment';
import { Modal, ModalContent, ModalOverlay, ModalPortal, ModalTitle, ModalDescription } from '@/components/ui/modal';

interface MpesaCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  patientName: string;
  onSuccess?: () => void;
}

export default function MpesaCheckoutModal({ 
  open, 
  onClose, 
  amount, 
  patientName,
  onSuccess 
}: MpesaCheckoutModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('254');
  const { status, attempts, initiatePayment, reset } = useMpesaPayment();

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, onClose, onSuccess]);

  const canDismiss = status === 'idle' || status === 'failed' || status === 'timeout';

  const handleInitiate = () => {
    // Basic validation: must start with 254 and have 12 digits
    if (phoneNumber.length === 12 && phoneNumber.startsWith('254')) {
      initiatePayment(phoneNumber, amount);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setPhoneNumber('254');
          onClose();
        }
      }}
    >
      <ModalPortal>
        <ModalOverlay
          closeOnClick={canDismiss}
          className="bg-[#080F0C]/90 backdrop-blur-md"
        />

        <ModalContent
          closeOnEscape={canDismiss}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md bg-[#0F1715] border border-blue-500/20 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-8 py-8 border-b border-white/5 bg-gradient-to-b from-blue-500/5 to-transparent text-center">
          <div className="mx-auto w-16 h-16 rounded-card bg-[#2563EB] flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <ModalTitle className="text-xl font-bold text-white">M-Pesa Express</ModalTitle>
          <ModalDescription className="text-xs text-sage mt-1 font-medium tracking-wide uppercase">
            Safe & Encrypted Payment
          </ModalDescription>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          
          {status === 'idle' || status === 'failed' || status === 'timeout' ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <p className="text-3xl font-bold text-white">KES {amount.toLocaleString()}</p>
                <p className="text-xs text-sage">Payment for {patientName}</p>
              </div>

              <div>
                <label 
                  htmlFor="mpesa-phone"
                  className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3 block"
                >
                  M-Pesa Phone Number
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center gap-2 pr-3 border-r border-white/10">
                    <span className="text-sm font-bold text-white">🇰🇪</span>
                  </div>
                  <input 
                    id="mpesa-phone"
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full h-14 bg-content-bg/5 border border-white/10 rounded-card pl-16 pr-4 text-base font-bold text-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="2547XXXXXXXX"
                    maxLength={12}
                  />
                  {phoneNumber.length === 12 && phoneNumber.startsWith('254') && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-5 h-5 text-emerald" />
                    </div>
                  )}
                </div>
              </div>

              {status === 'failed' && (
                <div className="p-4 rounded-card bg-red-500/5 border border-red-500/20 flex gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-300">Transaction failed. Please check your phone or try a different number.</p>
                </div>
              )}

              {status === 'timeout' && (
                <div className="p-4 rounded-card bg-amber-500/5 border border-amber-500/20 flex gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-300">Request timed out. Please check your M-Pesa menu or try again.</p>
                </div>
              )}

              <button
                onClick={handleInitiate}
                className="w-full h-14 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-card font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Send STK Push <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-8 py-4">
              {/* Tracker UI */}
              <div className="relative flex flex-col items-center justify-center">
                
                {/* Visual Status Ring */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className={cn(
                    "absolute inset-0 rounded-full border-4 border-white/5 transition-all duration-1000",
                    status === 'pending' && "border-t-[#2563EB] animate-spin"
                  )} />
                  
                  {status === 'pending' && (
                    <div className="text-center animate-pulse">
                      <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Polling</p>
                    </div>
                  )}

                  {status === 'success' && (
                    <div className="text-center animate-in zoom-in-50 duration-150">
                      <CheckCircle2 className="w-12 h-12 text-emerald mx-auto" />
                    </div>
                  )}
                </div>

                <div className="mt-8 text-center space-y-2">
                  <h3 className="text-lg font-bold text-white">
                    {status === 'requested' && 'Requesting STK Push...'}
                    {status === 'pending' && 'Waiting for PIN...'}
                    {status === 'success' && 'Payment Received!'}
                  </h3>
                  <p className="text-sm text-sage max-w-[240px]">
                    {status === 'requested' && 'Preparing your secure checkout.'}
                    {status === 'pending' && `Check your phone for the PIN request. (Attempt ${attempts}/20)`}
                    {status === 'success' && 'Transaction completed successfully. Dispensing medication...'}
                  </p>
                </div>

                {status === 'pending' && (
                  <div className="mt-8 w-full bg-content-bg/5 rounded-card p-4 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    <p className="text-[10px] uppercase font-bold text-white tracking-widest">Awaiting Callback...</p>
                    <div className="flex-1 h-1 bg-content-bg/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(attempts / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-white/5 bg-content-bg/[0.02] flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 opacity-40">
            <Lock className="w-3.5 h-3.5 text-sage" />
            <span className="text-[10px] font-bold text-sage uppercase tracking-wider">SSL Secure</span>
          </div>
          <div className="w-px h-3 bg-content-bg/10" />
          <div className="flex items-center gap-2 opacity-40">
            <ShieldCheck className="w-3.5 h-3.5 text-sage" />
            <span className="text-[10px] font-bold text-sage uppercase tracking-wider">KYC Verified</span>
          </div>
        </div>
          </div>
        </ModalContent>
      </ModalPortal>
    </Modal>
  );
}
