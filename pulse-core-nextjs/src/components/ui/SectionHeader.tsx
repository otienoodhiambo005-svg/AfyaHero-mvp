import * as React from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderAlign = 'start' | 'center';
type SectionHeaderTone = 'default' | 'warm';

interface SectionHeaderProps {
  /**
   * Small uppercase label rendered above the title. Mirrors Claude's editorial
   * eyebrow cadence with letter-spacing and a discreet leading rule.
   */
  eyebrow?: string;
  /** Section title rendered in the serif face. */
  title: string;
  /** Optional supporting paragraph rendered in the body face. */
  description?: string;
  /** Optional trailing actions (buttons, links). */
  actions?: React.ReactNode;
  /** Layout alignment. Defaults to 'start'. */
  align?: SectionHeaderAlign;
  /**
   * Visual tone. 'warm' uses Claude-inspired paper/ember tokens; 'default'
   * keeps the cool portal palette so existing pages opt in deliberately.
   */
  tone?: SectionHeaderTone;
  className?: string;
  /** Heading level for accessibility — defaults to h2. */
  as?: 'h1' | 'h2' | 'h3';
}

/**
 * Editorial section header with a Claude-style serif title, eyebrow, and a
 * discreet decorative rule. Designed to give pages a calm editorial cadence
 * without disrupting the existing portal grid.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = 'start',
  tone = 'default',
  className,
  as = 'h2',
}: SectionHeaderProps) {
  const Heading = as;
  const isCenter = align === 'center';
  const isWarm = tone === 'warm';

  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        isCenter && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-2',
          isCenter && 'items-center',
        )}
      >
        {eyebrow && (
          <span
            className={cn(
              'inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em]',
              isWarm ? 'text-[var(--ember)]' : 'text-slate',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-px w-6',
                isWarm ? 'bg-[var(--ember-edge)]' : 'bg-content-border',
              )}
            />
            {eyebrow}
          </span>
        )}

        <Heading
          className={cn(
            'font-serif text-balance text-3xl leading-[1.1] tracking-tight sm:text-4xl',
            isWarm ? 'text-[var(--paper-warm-ink)]' : 'text-ink',
          )}
        >
          {title}
        </Heading>

        {description && (
          <p
            className={cn(
              'max-w-2xl text-sm leading-7 sm:text-[15px]',
              isWarm ? 'text-[var(--paper-warm-muted)]' : 'text-slate',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            isCenter && 'justify-center',
          )}
        >
          {actions}
        </div>
      )}
    </header>
  );
}

export default SectionHeader;
