import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PORTALS } from '@/types';
import type { PortalRole } from '@/types';
import { Building2, Stethoscope, TestTube2, Pill, Briefcase, Shield } from 'lucide-react';
import { VideoBackground } from '@/components/shared/VideoBackground';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';

export const metadata: Metadata = {
  title: 'AfyaHero Pulse — Portal Selector',
  description: 'Choose the right AfyaHero Pulse workspace for your hospital role.',
};

const portalIcons: Record<PortalRole, React.ElementType> = {
  reception: Building2,
  medical: Stethoscope,
  lab: TestTube2,
  pharmacy: Pill,
  admin: Briefcase,
  super_admin: Shield,
};

const portalOrder: PortalRole[] = ['reception', 'medical', 'lab', 'pharmacy', 'admin'];

const roleAudience: Record<PortalRole, { eyebrow: string; title: string; detail: string }> = {
  reception: {
    eyebrow: 'Operations',
    title: 'Front Desk, Queue, and Billing Operations',
    detail: 'Register patients, manage check-in queues, perform biometric verification, assign ward beds, collect invoice payments, and audit ledgers.',
  },
  medical: {
    eyebrow: 'Medical Professional',
    title: 'Clinical workspace for bedside teams',
    detail: 'Orders, SOAP notes, handover, patient review, and treatment workflows for doctors and nurses.',
  },
  lab: {
    eyebrow: 'Laboratory',
    title: 'Diagnostics and result operations',
    detail: 'Specimen workflows, analytics, result validation, and public health visibility for lab teams.',
  },
  pharmacy: {
    eyebrow: 'Pharmacy',
    title: 'Medication and dispensing control',
    detail: 'Prescription review, stock oversight, dispensing queues, and formulary operations.',
  },
  admin: {
    eyebrow: 'Administration',
    title: 'Executive oversight and governance',
    detail: 'Beds, finance, staffing, quality, and cross-hospital operational control for administrators.',
  },
  super_admin: {
    eyebrow: 'Platform Administrator',
    title: 'AfyaHero super access',
    detail: 'Cross-hospital monitoring, global settings, and platform configuration.',
  },
};

export default function LandingPage() {
  if (isStandaloneSuperAdminMode()) {
    redirect('/auth/superadmin/login');
  }

  return (
    <VideoBackground
      src="/media/onboarding-bg.mp4"
      poster="/login-bg.png"
    >
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <section className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/10 bg-[#0C1510] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">
              Role-based access
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Secure onboarding
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Image src="/afyahero-icon.jpeg" alt="AfyaHero" width={56} height={56} className="rounded-2xl ring-1 ring-white/10" priority />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-200">AfyaHero OS</p>
                <p className="text-xs text-slate-300">Hospital workspace for clinical and operations teams</p>
              </div>
            </div>

            <div className="mt-8 max-w-2xl">
              <h1 className="font-logo text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
                Enter the right workspace for your hospital role.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-200 sm:mt-5 sm:text-base sm:leading-7 lg:text-lg">
                Choose the protected onboarding path for medical professionals, laboratory teams, pharmacy operations, administrators, and front desk staff.
                Each role opens a focused dashboard with the tools and access needed for that work.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/10 bg-[#0C1510] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Clinical Support</p>
                <p className="mt-2 text-lg font-semibold text-white">Faster Documentation</p>
                <p className="mt-1 text-sm text-slate-300">Get help with transcripts, SOAP notes, and ICD-10 suggestions during care documentation.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-[#0C1510] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Billing</p>
                <p className="mt-2 text-lg font-semibold text-white">Reliable Payments</p>
                <p className="mt-1 text-sm text-slate-300">Track billing steps clearly and avoid duplicate payment records at the desk.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-[#0C1510] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Pharmacy</p>
                <p className="mt-2 text-lg font-semibold text-white">Safer Dispensing</p>
                <p className="mt-1 text-sm text-slate-300">Check drug interactions quickly and keep formulary decisions consistent.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-[#0C1510] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Connectivity</p>
                <p className="mt-2 text-lg font-semibold text-white">Offline First</p>
                <p className="mt-1 text-sm text-slate-300">Keep working during low internet periods and sync records when connection improves.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-[#0C1510] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Growth Ready</p>
                <p className="mt-2 text-lg font-semibold text-white">Built for Expansion</p>
                <p className="mt-1 text-sm text-slate-300">Run one facility today and expand across more sites as your services grow.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <Link href="/auth/login" className="rounded-full border border-emerald-500/10 bg-[#0C1510] px-5 py-2.5 font-medium text-white transition hover:bg-[#080F0C]">
                Generic login
              </Link>
              <Link href="/auth/register-facility" className="font-bold text-sky-300 transition hover:text-sky-200">
                Register your facility
              </Link>
            </div>
          </section>

          <section className="rounded-[28px] border border-emerald-500/10 bg-[#0C1510] p-4 shadow-2xl shadow-slate-950/40 sm:rounded-[32px] sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Onboarding screen</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Choose a professional dashboard</h2>
              </div>
              <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                5 roles
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {portalOrder.map((role, index) => {
                const cfg = PORTALS[role];
                const audience = roleAudience[role];
                const isLastOdd = index === portalOrder.length - 1 && portalOrder.length % 2 !== 0;

                return (
                  <Link
                    key={role}
                    href={cfg.loginPath}
                    aria-label={`Open ${cfg.label} dashboard onboarding`}
                    className={`group relative flex min-h-[220px] flex-col rounded-[28px] border border-emerald-500/10 bg-[#080F0C] p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-[#0C1510]${isLastOdd ? ' sm:col-span-2 sm:max-w-lg sm:mx-auto sm:w-full' : ''}`}
                    style={{ boxShadow: `inset 0 1px 0 ${cfg.accentColor}20` }}
                  >
                    <div
                      className="absolute inset-x-5 top-0 h-px opacity-70"
                      style={{ background: `linear-gradient(90deg, transparent, ${cfg.accentColor}, transparent)` }}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg transition duration-300 group-hover:scale-105"
                        style={{
                          background: `${cfg.accentColor}1f`,
                          borderColor: `${cfg.accentColor}40`,
                          boxShadow: `0 14px 32px ${cfg.accentColor}22`,
                        }}
                      >
                        {(() => {
                          const IconComponent = portalIcons[role];
                          return <IconComponent className="w-6 h-6" style={{ color: cfg.accentColor }} />;
                        })()}
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                        style={{ backgroundColor: `${cfg.accentColor}22`, color: cfg.accentColor }}
                      >
                        {audience.eyebrow}
                      </span>
                    </div>

                    <div className="mt-6 flex-1">
                      <h3 className="text-2xl font-semibold text-white">{cfg.label}</h3>
                      <p className="mt-2 text-sm font-medium" style={{ color: cfg.accentColor }}>
                        {audience.title}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{audience.detail}</p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                      <span className="text-slate-300">Sign in to continue</span>
                      <span className="font-semibold transition group-hover:translate-x-1" style={{ color: cfg.accentColor }}>
                        Open {cfg.label} dashboard
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Need access to another workspace? Use generic login or register a facility profile first.
            </p>
          </section>
        </div>
      </div>
    </VideoBackground>
  );
}
