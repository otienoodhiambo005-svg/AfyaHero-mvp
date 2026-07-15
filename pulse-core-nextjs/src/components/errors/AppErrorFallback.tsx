'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import logger from '@/lib/logger';

type AppRouterError = Error & { digest?: string };

export function AppErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  showErrorId = true,
}: {
  error: AppRouterError;
  reset: () => void;
  title?: string;
  description?: string;
  showErrorId?: boolean;
}) {
  useEffect(() => {
    const isDev = process.env.NODE_ENV !== 'production';

    logger.error('App Router error boundary triggered', {
      digest: error.digest,
      name: error.name,
      ...(isDev ? { message: error.message, stack: error.stack } : {}),
      component: 'app-router',
    });
  }, [error]);

  return (
    <main className="min-h-[60vh] w-full px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl border border-content-border bg-content-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className="h-11 w-11 shrink-0 rounded-2xl bg-content-bg border border-content-border flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="text-xl text-ink">!</span>
          </div>

          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-charcoal">{title}</h1>
            <p className="mt-1 text-sm text-slate">{description}</p>

            {showErrorId && error.digest ? (
              <p className="mt-3 text-xs text-slate font-mono">
                Error ID: <span className="select-all">{error.digest}</span>
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-content-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-content-bg"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-content-border bg-content-bg px-4 py-2 text-sm font-semibold text-charcoal hover:bg-content-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-content-bg"
              >
                Go to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

