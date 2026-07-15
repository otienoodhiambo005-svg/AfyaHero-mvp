/**
 * SeverityChip — clinical/operational severity indicator.
 *
 * Five-level scale used across triage, lab abnormality flags, quality
 * incidents, and alerts. Distinct from StatusBadge: severity is always
 * an ordinal scale, not a workflow state.
 */

import { ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldAlert, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

const LEVEL_ORDER: SeverityLevel[] = ['info', 'low', 'medium', 'high', 'critical'];

const LEVEL_CLASSES: Record<SeverityLevel, string> = {
  info:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
  low:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  medium:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  high:
    'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900',
  critical:
    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
};

const LEVEL_ICON: Record<SeverityLevel, typeof Info> = {
  info: Info,
  low: ShieldAlert,
  medium: AlertCircle,
  high: AlertTriangle,
  critical: Flame,
};

const LEVEL_LABEL: Record<SeverityLevel, string> = {
  info: 'Info',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export interface SeverityChipProps {
  level: SeverityLevel;
  children?: ReactNode;
  /** Show the leading icon. Defaults to true. */
  icon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function SeverityChip({
  level,
  children,
  icon = true,
  size = 'md',
  className,
}: SeverityChipProps) {
  const Icon = LEVEL_ICON[level];
  const sizeClass =
    size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset',
        sizeClass,
        LEVEL_CLASSES[level],
        className,
      )}
      aria-label={`Severity: ${LEVEL_LABEL[level]}`}
    >
      {icon && <Icon className={iconSize} aria-hidden />}
      {children ?? LEVEL_LABEL[level]}
    </span>
  );
}

/** Compare two severity levels (returns >0 if a is higher than b). */
export function compareSeverity(a: SeverityLevel, b: SeverityLevel): number {
  return LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b);
}

export default SeverityChip;
