import * as React from 'react';
import { Info, Sparkles, ShieldAlert, Leaf, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnnouncementTone = 'info' | 'ai-safety' | 'caution' | 'success';

interface AnnouncementCardProps {
  /** Visual tone — drives surface, border, accent, and default icon. */
  tone?: AnnouncementTone;
  /** Small uppercase label rendered above the heading. */
  eyebrow?: string;
  /** Card heading rendered in the serif face. */
  title: string;
  /** Supporting body content. Strings are wrapped in a paragraph. */
  children?: React.ReactNode;
  /** Optional trailing action (button, link). */
  action?: React.ReactNode;
  /** Override the tone's default icon. Pass `null` to omit the icon. */
  icon?: LucideIcon | null;
  className?: string;
  /** ARIA role override — defaults to 'status' for non-interactive notices. */
  role?: 'status' | 'note' | 'alert';
}

const TONE_STYLES: Record<
  AnnouncementTone,
  {
    surface: string;
    border: string;
    accentBar: string;
    iconWrap: string;
    iconColor: string;
    eyebrow: string;
    heading: string;
    body: string;
    icon: LucideIcon;
  }
> = {
  info: {
    surface: 'bg-[var(--paper-warm)]',
    border: 'border-[var(--paper-warm-edge)]',
    accentBar: 'bg-[var(--ember-edge)]',
    iconWrap: 'bg-[var(--ember-soft)]',
    iconColor: 'text-[var(--ember)]',
    eyebrow: 'text-[var(--ember)]',
    heading: 'text-[var(--paper-warm-ink)]',
    body: 'text-[var(--paper-warm-muted)]',
    icon: Info,
  },
  'ai-safety': {
    surface: 'bg-[var(--paper-warm)]',
    border: 'border-[var(--ember-edge)]',
    accentBar: 'bg-[var(--ember)]',
    iconWrap: 'bg-[var(--ember-soft)]',
    iconColor: 'text-[var(--ember)]',
    eyebrow: 'text-[var(--ember)]',
    heading: 'text-[var(--paper-warm-ink)]',
    body: 'text-[var(--paper-warm-muted)]',
    icon: Sparkles,
  },
  caution: {
    surface: 'bg-[var(--amber-quiet-bg)]',
    border: 'border-[var(--amber-quiet)]/30',
    accentBar: 'bg-[var(--amber-quiet)]',
    iconWrap: 'bg-white/60',
    iconColor: 'text-[var(--amber-quiet)]',
    eyebrow: 'text-[var(--amber-quiet)]',
    heading: 'text-[var(--paper-warm-ink)]',
    body: 'text-[var(--paper-warm-muted)]',
    icon: ShieldAlert,
  },
  success: {
    surface: 'bg-[var(--sage-quiet-bg)]',
    border: 'border-[var(--sage-quiet)]/30',
    accentBar: 'bg-[var(--sage-quiet)]',
    iconWrap: 'bg-white/60',
    iconColor: 'text-[var(--sage-quiet)]',
    eyebrow: 'text-[var(--sage-quiet)]',
    heading: 'text-[var(--paper-warm-ink)]',
    body: 'text-[var(--paper-warm-muted)]',
    icon: Leaf,
  },
};

/**
 * Claude-inspired advisory card. Uses warm paper surfaces with a discreet
 * coral/sage accent rule. Designed for guidance, AI-safety notices, and
 * editorial callouts — sits comfortably alongside the existing cool portal
 * palette without overpowering it.
 */
export function AnnouncementCard({
  tone = 'info',
  eyebrow,
  title,
  children,
  action,
  icon,
  className,
  role = 'status',
}: AnnouncementCardProps) {
  const styles = TONE_STYLES[tone];
  const ResolvedIcon = icon === undefined ? styles.icon : icon;

  return (
    <aside
      role={role}
      className={cn(
        'relative overflow-hidden rounded-[1.25rem] border p-5 sm:p-6',
        styles.surface,
        styles.border,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-[3px]', styles.accentBar)}
      />

      <div className="flex items-start gap-4">
        {ResolvedIcon && (
          <span
            aria-hidden
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              styles.iconWrap,
            )}
          >
            <ResolvedIcon className={cn('h-4 w-4', styles.iconColor)} />
          </span>
        )}

        <div className="flex-1 space-y-2">
          {eyebrow && (
            <span
              className={cn(
                'inline-flex items-center font-mono text-[10.5px] uppercase tracking-[0.26em]',
                styles.eyebrow,
              )}
            >
              {eyebrow}
            </span>
          )}

          <h3
            className={cn(
              'font-serif text-xl leading-snug tracking-tight sm:text-[1.4rem]',
              styles.heading,
            )}
          >
            {title}
          </h3>

          {children && (
            <div className={cn('text-sm leading-7', styles.body)}>
              {typeof children === 'string' ? <p>{children}</p> : children}
            </div>
          )}

          {action && <div className="pt-1">{action}</div>}
        </div>
      </div>
    </aside>
  );
}

export default AnnouncementCard;
