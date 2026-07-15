/**
 * StatusBadge — semantic status pill.
 *
 * Replaces hand-rolled `bg-{color}-100 text-{color}-700` patterns across
 * portal pages with a single token-driven component.
 *
 * Statuses are grouped into three semantic categories that map onto a
 * stable color palette:
 *   - neutral   → grey   (draft, pending, scheduled, on-hold, in-review)
 *   - active    → blue   (in-progress, processing, dispensing, in-consult)
 *   - success   → green  (completed, dispensed, verified, paid, approved)
 *   - warning   → amber  (waiting, partial, expiring-soon, overdue, retry)
 *   - danger    → red    (cancelled, rejected, failed, critical, expired, revoked)
 *   - info      → violet (demo, system, automated, ai)
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone =
  | 'neutral'
  | 'active'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  active:
    'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  danger:
    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
  info:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
};

/** Common AfyaHero status keywords mapped to tones. */
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // neutral
  draft: 'neutral',
  pending: 'neutral',
  scheduled: 'neutral',
  'on-hold': 'neutral',
  hold: 'neutral',
  'in-review': 'neutral',
  inactive: 'neutral',

  // active
  'in-progress': 'active',
  inprogress: 'active',
  processing: 'active',
  dispensing: 'active',
  'in-consult': 'active',
  active: 'active',
  'sample-collected': 'active',
  ordered: 'active',
  acknowledged: 'active',

  // success
  completed: 'success',
  done: 'success',
  dispensed: 'success',
  verified: 'success',
  paid: 'success',
  approved: 'success',
  resolved: 'success',
  passed: 'success',
  ok: 'success',

  // warning
  waiting: 'warning',
  partial: 'warning',
  'expiring-soon': 'warning',
  overdue: 'warning',
  retry: 'warning',
  warning: 'warning',
  'insurance-pending': 'warning',
  unverified: 'warning',

  // danger
  cancelled: 'danger',
  canceled: 'danger',
  rejected: 'danger',
  failed: 'danger',
  critical: 'danger',
  expired: 'danger',
  revoked: 'danger',
  'out-of-stock': 'danger',
  suspended: 'danger',
  abnormal: 'danger',
  blocked: 'danger',

  // info
  demo: 'info',
  system: 'info',
  automated: 'info',
  ai: 'info',
};

export interface StatusBadgeProps {
  /** Free-form status string (case-insensitive). Mapped to a tone. */
  status?: string;
  /** Override the tone explicitly. Wins over `status`. */
  tone?: StatusTone;
  /** Human-friendly label. Defaults to a Title Case of `status`. */
  children?: ReactNode;
  /** Optional leading dot. */
  dot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

function toneFor(status?: string, tone?: StatusTone): StatusTone {
  if (tone) return tone;
  if (!status) return 'neutral';
  return STATUS_TONE_MAP[status.toLowerCase()] ?? 'neutral';
}

function defaultLabel(status?: string): string | null {
  if (!status) return null;
  return status
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ');
}

export function StatusBadge({
  status,
  tone,
  children,
  dot = false,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const resolvedTone = toneFor(status, tone);
  const label = children ?? defaultLabel(status) ?? '—';
  const sizeClass =
    size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset',
        sizeClass,
        TONE_CLASSES[resolvedTone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            resolvedTone === 'neutral' && 'bg-slate-500',
            resolvedTone === 'active' && 'bg-blue-500',
            resolvedTone === 'success' && 'bg-emerald-500',
            resolvedTone === 'warning' && 'bg-amber-500',
            resolvedTone === 'danger' && 'bg-red-500',
            resolvedTone === 'info' && 'bg-violet-500',
          )}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}

export default StatusBadge;
