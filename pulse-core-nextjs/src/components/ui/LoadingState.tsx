/**
 * LoadingState — standardized placeholder for sections that are still loading.
 * Mirrors the API of `EmptyState` so screens can swap implementations without
 * restructuring layout.
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  /** Short verb, e.g. "Loading queue". Default: "Loading". */
  title?: string;
  /** Optional secondary line. */
  description?: string;
  /** Compact horizontal layout for inline placement. */
  inline?: boolean;
  className?: string;
}

export function LoadingState({
  title = 'Loading',
  description,
  inline = false,
  className,
}: LoadingStateProps) {
  if (inline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('flex items-center gap-2 text-sm text-slate', className)}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{title}…</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-12 text-slate',
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="font-medium text-ink">{title}…</p>
      {description && <p className="text-sm text-slate">{description}</p>}
    </div>
  );
}

export default LoadingState;
