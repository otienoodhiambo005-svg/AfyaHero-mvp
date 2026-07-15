/**
 * DemoOnlyBanner — page-level call-out shown only when the active session is
 * a superadmin-issued demo. Surfaces the demo persona, time remaining, and a
 * "switch to live account" CTA.
 *
 * Intended for placement at the top of portal screens that have destructive
 * CTAs disabled in demo mode.
 */

'use client';

import { Sparkles, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useDemoSession } from '@/hooks/useDemoSession';
import { cn } from '@/lib/utils';

export interface DemoOnlyBannerProps {
  /** Override the call-to-action destination. */
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  /** Hide the time-remaining counter. */
  hideCountdown?: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':');
}

export function DemoOnlyBanner({
  ctaHref = '/auth/login',
  ctaLabel = 'Switch to live account',
  className,
  hideCountdown = false,
}: DemoOnlyBannerProps) {
  const { isDemo, session, msRemaining } = useDemoSession();

  if (!isDemo || !session) return null;

  return (
    <div
      role="status"
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[1.25rem] border border-violet-200 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_36%),linear-gradient(90deg,rgba(245,243,255,0.96),rgba(238,242,255,0.96))] px-4 py-3 text-sm shadow-sm dark:border-violet-900 dark:from-violet-950/40 dark:to-indigo-950/40',
        className,
      )}
    >
      <div className="relative flex flex-wrap items-center gap-2 text-violet-800 dark:text-violet-200">
        <Sparkles className="h-4 w-4" aria-hidden />
        <span className="font-medium">Demo mode</span>
        <span className="text-violet-700/70 dark:text-violet-300/70">
          • {session.hospitalName} • {session.name}
        </span>
      </div>
      <div className="relative flex items-center gap-3">
        {!hideCountdown && msRemaining !== null && (
          <span className="inline-flex items-center gap-1 text-xs text-violet-800/80 dark:text-violet-200/80">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatRemaining(msRemaining)}
          </span>
        )}
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
        >
          {ctaLabel}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default DemoOnlyBanner;
