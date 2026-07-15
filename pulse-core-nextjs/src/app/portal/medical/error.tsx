'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, Stethoscope } from 'lucide-react';
import logger from '@/lib/logger';

export default function MedicalPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Medical portal error boundary caught', {
      error: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-forest flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0C1510] border border-emerald-500/10 rounded-3xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose/20 flex items-center justify-center">
          <Stethoscope className="w-8 h-8 text-rose" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2 font-serif">
          Medical Portal Error
        </h1>
        
        <p className="text-mist/70 mb-6 text-sm">
          Something went wrong in the medical portal. Please try again or contact support if the problem persists.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-white/5 rounded-xl text-left">
            <p className="text-xs text-mist/50 font-mono mb-1">Error details:</p>
            <p className="text-xs text-rose/80 font-mono break-all">{error.message}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald text-white rounded-xl text-sm font-medium hover:bg-emerald/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Portal Selector
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-mist/40">
            Reference: <span className="font-mono">{error.digest || 'unknown'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
