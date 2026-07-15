'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ArrowRight, BookOpen, Clock3, ExternalLink, HeartPulse, Loader2, ShieldPlus } from 'lucide-react';
import type { EducationTopicData, HealthNewsRole, LiveHealthNewsPayload } from '@/lib/health-news';

interface HealthNewsPanelProps {
  accentColor: string;
  heading: string;
  description: string;
  insightTitle: string;
  insightText: string;
  role: HealthNewsRole;
  topics: EducationTopicData[];
}

export default function HealthNewsPanel({
  accentColor,
  heading,
  description,
  insightTitle,
  insightText,
  role,
  topics,
}: HealthNewsPanelProps): React.ReactElement {
  const [hasHydrated, setHasHydrated] = useState(false);
  const regionCode = (process.env.NEXT_PUBLIC_HEALTH_NEWS_REGION ?? 'KE').toUpperCase();
  const [livePayload, setLivePayload] = useState<LiveHealthNewsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLiveEducation() {
      try {
        const response = await fetch(`/api/health-news?role=${role}&region=${regionCode}`, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = await response.json() as LiveHealthNewsPayload;
        if (isMounted) {
          setLivePayload(payload);
        }
      } catch {
        // Preserve fallback content if live feeds are unavailable.
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLiveEducation();
    const intervalId = window.setInterval(() => {
      void loadLiveEducation();
    }, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [role, regionCode]);

  const displayTopics = useMemo(() => {
    const liveItems = livePayload?.items ?? [];
    const merged = [...liveItems];

    for (const fallbackTopic of topics) {
      if (merged.length >= 3) {
        break;
      }

      if (!merged.some((topic) => topic.title === fallbackTopic.title)) {
        merged.push(fallbackTopic);
      }
    }

    return merged.slice(0, 3);
  }, [livePayload, topics]);

  const liveSourceText = livePayload?.sourceNames?.length ? livePayload.sourceNames.join(' · ') : null;
  const insightBody = livePayload?.insightText ?? insightText;
  const updatedAtLabel = livePayload?.updatedAt
    ? new Date(livePayload.updatedAt).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;

  if (!hasHydrated) {
    return <section className="rounded-card border border-content-border bg-content-bg p-5 shadow-card" aria-hidden="true" />;
  }

  return (
    <section className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
      <div className="flex flex-col gap-4 border-b border-content-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
            <HeartPulse className="h-3.5 w-3.5" />
            Health News
          </div>
          <h2 className="mt-3 text-xl font-semibold text-ink">{heading}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-content-border bg-content-surface px-2.5 py-1">
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              {isLoading ? 'Refreshing online updates' : 'Online updates enabled'}
            </span>
            {liveSourceText && (
              <span className="rounded-full border border-content-border bg-content-surface px-2.5 py-1">
                {liveSourceText}
              </span>
            )}
            {updatedAtLabel && (
              <span className="rounded-full border border-content-border bg-content-surface px-2.5 py-1">
                Updated {updatedAtLabel}
              </span>
            )}
            {livePayload?.refreshMinutes && (
              <span className="rounded-full border border-content-border bg-content-surface px-2.5 py-1">
                Refresh {livePayload.refreshMinutes}m
              </span>
            )}
            {(livePayload?.regionCode || regionCode) && (
              <span className="rounded-full border border-content-border bg-content-surface px-2.5 py-1">
                Region {(livePayload?.regionCode || regionCode).toUpperCase()}
              </span>
            )}
          </div>
        </div>


      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {displayTopics.map((topic) => {
          const hasImage = Boolean(topic.image);
          return (
            <article
              key={topic.title}
              className={cn(
                'rounded-card border p-4 transition-colors',
                hasImage
                  ? 'relative overflow-hidden border-white/10 hover:border-white/20 flex flex-col min-h-[220px]'
                  : 'bg-content-surface border-content-border hover:border-content-border hover:bg-content-bg',
              )}
            >
              {hasImage && (
                <>
                  <Image
                    src={topic.image || ''}
                    alt={topic.title ? `Featured image for: ${topic.title}` : 'Health news article image'}
                    aria-hidden="true"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-slate-900/72" />
                </>
              )}

              <div className={cn('flex flex-col', hasImage && 'relative z-10 h-full')}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]', hasImage && 'bg-content-bg/20 text-white')}
                    style={!hasImage ? { backgroundColor: `${accentColor}14`, color: accentColor } : undefined}
                  >
                    {topic.tag}
                  </span>
                  <span className={cn('inline-flex items-center gap-1 text-xs', hasImage ? 'text-white/70' : 'text-slate-500')}>
                    <Clock3 className="h-3.5 w-3.5" />
                    {topic.duration}
                  </span>
                </div>

                <h3 className={cn('mt-4 text-base font-semibold', hasImage ? 'text-white' : 'text-ink')}>{topic.title}</h3>
                <p className={cn('mt-2 text-sm leading-6 flex-1', hasImage ? 'text-white/80' : 'text-slate-600')}>{topic.summary}</p>

                <div className={cn('mt-3 flex flex-wrap items-center gap-2 text-xs', hasImage ? 'text-white/60' : 'text-slate-500')}>
                  {topic.source && (
                    <span className={cn('rounded-full border px-2 py-1', hasImage ? 'border-white/20 bg-content-bg/10 text-white/80' : 'border-content-border bg-content-bg')}>
                      {topic.source}
                    </span>
                  )}
                  {topic.publishedAt && (
                    <span>
                      {new Date(topic.publishedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>

                {topic.url ? (
                  <a
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('mt-4 inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80', hasImage ? 'text-white' : '')}
                    style={!hasImage ? { color: accentColor } : undefined}
                  >
                    <BookOpen className="h-4 w-4" />
                    {topic.actionLabel}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    disabled
                    className={cn('mt-4 inline-flex items-center gap-2 text-sm font-semibold opacity-50 cursor-not-allowed', hasImage ? 'text-white' : '')}
                    style={!hasImage ? { color: accentColor } : undefined}
                  >
                    <BookOpen className="h-4 w-4" />
                    {topic.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-card border border-content-border bg-content-surface px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-card p-2.5" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
            <ShieldPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{insightTitle}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{insightBody}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
