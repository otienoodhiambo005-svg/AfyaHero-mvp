'use client';

import { useState, useCallback, useRef } from 'react';
import logger from '@/lib/logger';

export type PaymentStatus = 'idle' | 'requested' | 'pending' | 'success' | 'failed' | 'timeout';

interface MpesaPaymentState {
  status: PaymentStatus;
  checkoutRequestId?: string;
  error?: string;
  attempts: number;
}

export function useMpesaPayment() {
  const [state, setState] = useState<MpesaPaymentState>({
    status: 'idle',
    attempts: 0,
  });

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const pollStatus = useCallback(async (checkoutRequestId: string) => {
    let currentAttempts = 0;
    const maxAttempts = 20; // 60 seconds total at 3s interval

    pollingInterval.current = setInterval(async () => {
      currentAttempts += 1;
      setState(prev => ({ ...prev, attempts: currentAttempts }));

      if (currentAttempts >= maxAttempts) {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        setState(prev => ({ ...prev, status: 'timeout' }));
        return;
      }

      try {
        // In production, this would call /v1/payments/mpesa/status
        // For current build, we simulate a successful payment after 3 attempts
        if (currentAttempts === 3) {
          if (pollingInterval.current) clearInterval(pollingInterval.current);
          setState(prev => ({ ...prev, status: 'success' }));
        }
      } catch (err) {
        logger.error('M-Pesa poll error', { error: err instanceof Error ? err.message : String(err) });
      }
    }, 3000); // 3-second interval per PRD
  }, []);

  const initiatePayment = useCallback(async (phone: string, amount: number) => {
    setState({ status: 'requested', attempts: 0 });

    try {
      // Simulate STK Push request
      await new Promise(r => setTimeout(r, 1500));
      
      const mockCheckoutId = `ws_CO_${Date.now()}`;
      setState(prev => ({ 
        ...prev, 
        status: 'pending', 
        checkoutRequestId: mockCheckoutId 
      }));

      pollStatus(mockCheckoutId);
    } catch (err) {
      setState({ 
        status: 'failed', 
        attempts: 0, 
        error: 'Failed to initiate STK Push. Please try again.' 
      });
    }
  }, [pollStatus]);

  const reset = useCallback(() => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    setState({ status: 'idle', attempts: 0 });
  }, []);

  return {
    ...state,
    initiatePayment,
    reset
  };
}
