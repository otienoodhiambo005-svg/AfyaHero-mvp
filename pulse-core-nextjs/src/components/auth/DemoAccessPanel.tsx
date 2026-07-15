'use client';

import { Copy, KeyRound, Sparkles } from 'lucide-react';

export interface DemoCredential {
  label: string;
  identifierLabel: string;
  identifier: string;
  password: string;
  meta?: string;
}

interface DemoAccessPanelProps {
  accent: string;
  credentials: DemoCredential[];
  onUse: (credential: DemoCredential) => void;
  activeIdentifier?: string;
}

export default function DemoAccessPanel({
  accent,
  credentials,
  onUse,
  activeIdentifier,
}: DemoAccessPanelProps) {
  if (credentials.length === 0) return null;

  const copyText = (text: string) => {
    void navigator.clipboard?.writeText(text);
  };

  return (
    <section
      aria-label="Demo access details"
      className="mb-6 overflow-hidden rounded-2xl border bg-slate-50 shadow-sm"
      style={{ borderColor: `${accent}35` }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: `${accent}20`, background: `${accent}10` }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: accent }}
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist/70 font-mono">
            Demo access
          </p>
          <p className="text-xs font-semibold text-ink">
            Use a guided account to explore this portal.
          </p>
        </div>
      </div>

      <div className="divide-y divide-white/20">
        {credentials.map((credential) => {
          const isActive = activeIdentifier === credential.identifier;
          return (
            <div
              key={`${credential.label}-${credential.identifier}`}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <KeyRound aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{credential.label}</p>
                    {credential.meta && (
                      <p className="truncate text-[11px] font-medium text-mist/60">{credential.meta}</p>
                    )}
                  </div>
                </div>

                <dl className="grid gap-2 text-xs">
                  <div className="grid grid-cols-[84px_1fr_auto] items-center gap-2">
                    <dt className="font-bold uppercase tracking-widest text-mist/50 font-mono text-[9px]">
                      {credential.identifierLabel}
                    </dt>
                    <dd className="truncate rounded-lg bg-slate-100 px-2 py-1 font-mono text-ink">
                      {credential.identifier}
                    </dd>
                    <button
                      type="button"
                      onClick={() => copyText(credential.identifier)}
                      className="rounded-lg p-1.5 text-mist/60 transition hover:bg-slate-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={`Copy ${credential.label} ${credential.identifierLabel}`}
                    >
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-[84px_1fr_auto] items-center gap-2">
                    <dt className="font-bold uppercase tracking-widest text-mist/50 font-mono text-[9px]">
                      Password
                    </dt>
                    <dd className="truncate rounded-lg bg-slate-100 px-2 py-1 font-mono text-ink">
                      {credential.password}
                    </dd>
                    <button
                      type="button"
                      onClick={() => copyText(credential.password)}
                      className="rounded-lg p-1.5 text-mist/60 transition hover:bg-slate-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={`Copy ${credential.label} password`}
                    >
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={() => onUse(credential)}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-lg transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{
                  background: isActive ? accent : `${accent}E6`,
                  boxShadow: `0 8px 24px ${accent}25`,
                }}
              >
                {isActive ? 'Selected' : 'Use demo'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
