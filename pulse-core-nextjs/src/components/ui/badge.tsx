import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'severity-high' | 'severity-medium' | 'severity-low' | 'ai';

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'border-transparent bg-ink text-white hover:bg-ink/80',
  secondary:
    'border-transparent bg-content-surface text-ink hover:bg-content-surface/80',
  destructive:
    'border-transparent bg-severity-high text-white hover:bg-severity-high/80',
  outline: 'text-ink border-content-border',
  'severity-high': 'bg-severity-high-bg text-severity-high border-severity-high/30',
  'severity-medium': 'bg-severity-medium-bg text-severity-medium border-severity-medium/30',
  'severity-low': 'bg-severity-low-bg text-severity-low border-severity-low/30',
  'ai': 'bg-ai-badge-bg text-ai-badge-text border-ai-badge-text/20',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-badge border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
