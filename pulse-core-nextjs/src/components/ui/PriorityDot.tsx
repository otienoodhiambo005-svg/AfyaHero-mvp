/**
 * PriorityDot — compact dot indicator for use inside dense lists/tables.
 * Wraps the dot in a `<span>` with an `aria-label` so screen readers convey
 * the priority without showing the textual label.
 */

import { cn } from '@/lib/utils';

export type Priority = 'normal' | 'urgent' | 'critical' | 'routine' | 'STAT';

const PRIORITY_CLASS: Record<string, string> = {
  normal: 'bg-slate-400',
  routine: 'bg-slate-400',
  urgent: 'bg-amber-500',
  STAT: 'bg-orange-500',
  critical: 'bg-red-600 animate-pulse',
};

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'Normal priority',
  routine: 'Routine',
  urgent: 'Urgent',
  STAT: 'STAT',
  critical: 'Critical',
};

export interface PriorityDotProps {
  priority: Priority;
  className?: string;
  size?: 'xs' | 'sm';
}

export function PriorityDot({ priority, className, size = 'sm' }: PriorityDotProps) {
  const sizeClass = size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return (
    <span
      role="img"
      aria-label={PRIORITY_LABEL[priority] ?? `Priority: ${priority}`}
      className={cn(
        'inline-block rounded-full',
        sizeClass,
        PRIORITY_CLASS[priority] ?? 'bg-slate-300',
        className,
      )}
    />
  );
}

export default PriorityDot;
