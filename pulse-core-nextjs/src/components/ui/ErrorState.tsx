/**
 * ErrorState — standardized placeholder for sections that failed to load.
 * Pairs with `LoadingState` and `EmptyState`.
 */

'use client';

import { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Provide to render a primary retry button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Optional secondary actions (links, etc.). */
  actions?: ReactNode;
  /** Compact horizontal layout for inline placement. */
  inline?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this section. Please try again.',
  onRetry,
  retryLabel = 'Retry',
  actions,
  inline = false,
  className,
}: ErrorStateProps) {
  if (inline) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-2 text-sm text-red-700 dark:text-red-300',
          className,
        )}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span>{title}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 underline-offset-2 hover:underline"
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-slate">{description}</p>
      </div>
      {(onRetry || actions) && (
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-control bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {retryLabel}
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

export default ErrorState;
