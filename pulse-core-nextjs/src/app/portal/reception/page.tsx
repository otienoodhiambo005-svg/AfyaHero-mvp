'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Users, Clock, DollarSign, FileText, AlertTriangle,
  Brain, Eye, CheckCircle, CreditCard, Search, Fingerprint, ShieldCheck, UserPlus,
} from 'lucide-react';
import type { EducationTopicData } from '@/lib/health-news';
import { cn } from '@/lib/utils';
import { tokens } from '@/styles/design-tokens';
import logger from '@/lib/logger';
import { KPICard } from '@/components/ui/KPICard';
import LoadingState from '@/components/ui/LoadingState';
import StatusBadge from '@/components/ui/StatusBadge';
import { readDataSourceUnavailablePayload } from '@/lib/degraded-mode';

const HealthNewsPanel = dynamic(() => import('@/components/shared/HealthNewsPanel'), { ssr: false });
const PatientRegistrationForm = dynamic(() => import('@/components/portal/PatientRegistrationForm'), { ssr: false });
const IDCheckModal = dynamic(() => import('@/components/portal/IDCheckModal'), { ssr: false });
const PredictiveFlowPanel = dynamic(() => import('@/components/reception/PredictiveFlowPanel'), { ssr: false });

const ACCENT = tokens.colors.primary[500];

interface KpiCard {
  title: string;
  value: string;
  sub: string;
  trend: string;
  trendUp: boolean;
}

interface ArrivalRow {
  token: string;
  patient: string;
  ageSex: string;
  priority: 'Normal' | 'Urgent' | 'Critical';
  complaint: string;
  wait: string;
  status: 'Waiting' | 'In Progress' | 'Checked In' | 'Billed';
}

type ApiArrivalRow = {
  token?: string;
  patient?: string;
  patient_name?: string;
  name?: string;
  ageSex?: string;
  age_sex?: string;
  priority?: string;
  complaint?: string;
  wait?: string;
  wait_time?: string;
  status?: string;
};

const KPI_CARDS: KpiCard[] = [
  {
    title: "Patient Volume",
    value: '142',
    sub: 'Total arrivals today',
    trend: '22%',
    trendUp: true,
  },
  {
    title: 'Avg. Wait Time (TAT)',
    value: '18 min',
    sub: 'Registration to Vitals',
    trend: '4%',
    trendUp: true,
  },
  {
    title: 'Hospital Collections',
    value: 'KES 284,500',
    sub: 'M-Pesa + Cash today',
    trend: '15%',
    trendUp: true,
  },
  {
    title: 'Insurance Rejections',
    value: '4.2%',
    sub: 'SHIF/NHIF eligibility issues',
    trend: '4.2%',
    trendUp: false,
  },
];


function normalizePriority(value?: string): ArrivalRow['priority'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'urgent') return 'Urgent';
  return 'Normal';
}

function normalizeStatus(value?: string): ArrivalRow['status'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'in progress' || normalized === 'in_progress') return 'In Progress';
  if (normalized === 'checked in' || normalized === 'checked_in') return 'Checked In';
  if (normalized === 'billed') return 'Billed';
  return 'Waiting';
}

function normalizeArrivals(data: ApiArrivalRow[]): ArrivalRow[] {
  return data.map((row, index) => ({
    token: row.token ?? `T-${(index + 1).toString().padStart(3, '0')}`,
    patient: row.patient ?? row.patient_name ?? row.name ?? 'Unknown Patient',
    ageSex: row.ageSex ?? row.age_sex ?? 'N/A',
    priority: normalizePriority(row.priority),
    complaint: row.complaint ?? 'General consultation',
    wait: row.wait ?? row.wait_time ?? '0 min',
    status: normalizeStatus(row.status),
  }));
}

const HEALTH_NEWS_TOPICS: EducationTopicData[] = [
  {
    title: 'What to tell patients before triage vitals',
    tag: 'Queue Prep',
    duration: '3 min read',
    summary: 'Give every waiting patient the same brief on hydration, medication disclosure, and emergency red-flag symptoms before they reach triage.',
    actionLabel: 'Open triage briefing',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Vaccination and child wellness reminders at check-in',
    tag: 'Prevention',
    duration: '4 min read',
    summary: 'Use registration touchpoints to remind caregivers about vaccine cards, growth review dates, and fever danger signs that need same-day escalation.',
    actionLabel: 'View reminder script',
    image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Antenatal front-desk counseling prompts',
    tag: 'Maternal Care',
    duration: '2 min read',
    summary: 'Standardize how reception teams advise expectant mothers on fast-track symptoms, clinic documentation, and follow-up preparation.',
    actionLabel: 'Read ANC prompts',
    image: 'https://images.unsplash.com/photo-1544991936-9464fa57a5b5?w=800&q=70&auto=format&fit=crop',
  },
];


export default function ReceptionDashboard() {
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-KE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }),
  );
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [idCheckOpen, setIdCheckOpen] = useState(false);
  const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArrivals = useCallback(async () => {
    try {
      const response = await fetch('/api/reception/arrivals', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) {
        const degradedPayload = await readDataSourceUnavailablePayload(response);
        if (degradedPayload) {
          setDegradedNotice('Live arrivals feed is temporarily unavailable. Displaying the latest local queue snapshot.');
        }
        return;
      }
      const data = await response.json() as ApiArrivalRow[];
      if (Array.isArray(data) && data.length) {
        setArrivals(normalizeArrivals(data));
        setDegradedNotice(null);
      }
    } catch (err) {
      logger.warn('Failed to fetch arrivals data', { error: err });
      setDegradedNotice('Unable to refresh live arrivals right now. Showing local queue data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArrivals();
    const interval = setInterval(() => void fetchArrivals(), 30000);
    return () => clearInterval(interval);
  }, [fetchArrivals]);

  const filteredArrivals = useMemo(() => {
    if (!searchQuery) return arrivals;
    const query = searchQuery.toLowerCase();
    return arrivals.filter((row) =>
      row.patient.toLowerCase().includes(query) ||
      row.token.toLowerCase().includes(query) ||
      row.complaint.toLowerCase().includes(query)
    );
  }, [arrivals, searchQuery]);

  const waitingCount = useMemo(
    () => arrivals.filter((row) => row.status === 'Waiting' || row.status === 'In Progress').length,
    [arrivals],
  );
  const urgentCriticalCount = useMemo(
    () => arrivals.filter((row) => row.priority === 'Urgent' || row.priority === 'Critical').length,
    [arrivals],
  );
  const verificationRiskPct = 4.2;
  const throughputScore = Math.max(0, 100 - Math.round((waitingCount / Math.max(arrivals.length, 1)) * 100));
  const pulseToneClass =
    waitingCount >= 8
      ? 'text-severity-high bg-severity-high-bg border-severity-high/30'
      : waitingCount >= 5
        ? 'text-severity-medium bg-severity-medium-bg border-severity-medium/30'
        : 'text-ai-confirmed-text bg-ai-confirmed-bg border-portal-primary/25';

  const nextAction = useMemo(() => {
    if (urgentCriticalCount >= 3) {
      return 'Open fast-track triage desk and prioritize biometric + vitals capture for critical arrivals in the next 20 minutes.';
    }
    if (waitingCount >= 6) {
      return 'Reassign one registrar to queue triage and one to insurance verification to reduce intake bottlenecks.';
    }
    return 'Maintain current queue flow and focus on ID verification quality checks for insurance-bound patients.';
  }, [urgentCriticalCount, waitingCount]);

  return (
    <div className="min-h-screen bg-content-canvas p-3 md:p-5">
      <div className="mx-auto flex max-w-[1560px] gap-3 rounded-[2rem] bg-content-surface p-3 text-charcoal shadow-card">
        <main className="flex-1 space-y-4 rounded-[1.75rem] bg-content-canvas p-3 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.12)] sm:p-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(217,119,6,0.18),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
            <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
            <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Active operations shift
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">Operations command panel</h1>
                <p className="mt-2 text-sm text-slate">{today || 'Loading date...'} · front desk, eligibility, queue intake, and billing desk synchronized</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
                {[
                  { label: 'Waiting', value: waitingCount, icon: <Clock className="h-4 w-4" /> },
                  { label: 'Urgent', value: urgentCriticalCount, icon: <AlertTriangle className="h-4 w-4" /> },
                  { label: 'Flow', value: `${throughputScore}%`, icon: <ShieldCheck className="h-4 w-4" /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-sm">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-portal-primary/10 text-portal-primary">
                      {item.icon}
                    </div>
                    <p className="text-2xl font-semibold text-ink">{item.value}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {degradedNotice && (
            <div className="rounded-card border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning">
              {degradedNotice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_CARDS.map((card) => (
              <KPICard
                key={card.title}
                title={card.title}
                value={card.value}
                subtitle={card.sub}
                icon={
                  card.title === 'Patient Volume' ? Users :
                  card.title === 'Avg. Wait Time (TAT)' ? Clock :
                  card.title === 'Hospital Collections' ? DollarSign :
                  AlertTriangle
                }
                accentColor={ACCENT}
                trend={{
                  value: card.trendUp ? Number.parseFloat(card.trend) : -Number.parseFloat(card.trend),
                  label: card.trendUp ? 'vs baseline' : 'needs review',
                }}
              />
            ))}
          </div>

          {/* Operational Pulse — Glassboard quick scan */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate font-semibold">Queue Pressure</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-3xl font-semibold text-ink">{waitingCount}</p>
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', pulseToneClass)}>
                  {waitingCount >= 8 ? 'Critical' : waitingCount >= 5 ? 'Watch' : 'Stable'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate">Patients waiting or currently being processed at reception.</p>
            </div>

            <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate font-semibold">Throughput Signal</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{throughputScore}%</p>
              <p className="mt-2 text-xs text-slate">Derived from active queue load against today&apos;s intake volume.</p>
            </div>

            <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate font-semibold">Decision Lane</p>
              <p className="mt-2 text-sm font-medium text-charcoal leading-relaxed">{nextAction}</p>
            </div>
          </div>

          {/* Predictive Patient Flow Intelligence - Desktop/Tablet Optimized */}
          <PredictiveFlowPanel />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[68%_32%]">
            <section className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink">Today&apos;s Arrivals</h2>
                  <p className="text-sm text-slate">{filteredArrivals.length} of {arrivals.length} patients</p>
                </div>
                <label className="relative block w-full sm:w-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patients"
                    aria-label="Search today&apos;s arrivals"
                    className="h-10 w-full rounded-full border border-content-border bg-content-surface pl-9 pr-4 text-sm text-charcoal outline-none transition focus:border-portal-primary/35 focus:ring-2 focus:ring-portal-primary/15 sm:w-72"
                  />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-sm">
                  <thead>
                    <tr className="border-b border-content-border bg-content-surface">
                      {['Token', 'Patient', 'Age/Sex', 'Priority', 'Complaint', 'Wait', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArrivals.length > 0 ? (
                      filteredArrivals.map((row) => (
                        <tr key={row.token} className="border-b border-content-border/70 transition-colors hover:bg-content-surface/65">
                          <td className="px-3 py-3 font-mono text-xs font-bold text-primary">{row.token}</td>
                          <td className="px-3 py-3 font-medium text-ink">{row.patient}</td>
                          <td className="px-3 py-3 text-charcoal">{row.ageSex}</td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              tone={
                                row.priority === 'Critical' ? 'danger' :
                                row.priority === 'Urgent' ? 'warning' : 'success'
                              }
                              size="sm"
                            >
                              {row.priority}
                            </StatusBadge>
                          </td>
                          <td className="px-3 py-3 text-charcoal">{row.complaint}</td>
                          <td className="px-3 py-3 text-charcoal">{row.wait}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={row.status.toLowerCase()} size="sm">
                              {row.status}
                            </StatusBadge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <button className="rounded-lg p-1.5 text-slate transition-colors hover:bg-content-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35" title="View" aria-label={`View ${row.patient}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setCheckedIn((s) => { const n = new Set(s); n.add(row.token); return n; })}
                                className={cn(
                                  'rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35',
                                  checkedIn.has(row.token) ? 'text-ai-confirmed-text' : 'text-slate hover:bg-content-bg hover:text-ink',
                                )}
                                title="Check In"
                                aria-label={`Check in ${row.patient}`}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button className="rounded-lg p-1.5 text-slate transition-colors hover:bg-content-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35" title="Bill" aria-label={`Create bill for ${row.patient}`}>
                                <CreditCard className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8">
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <Search className="h-5 w-5" />
                            </div>
                            <p className="text-ink font-medium">No patients match</p>
                            <p className="text-sm text-slate">Try adjusting your search query.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4" aria-label="Reception side insights and quick actions">
              <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <Brain className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-primary">AI Operational Insights</p>
                    <p className="mt-1 text-sm text-charcoal">
                      <strong>High Arrival Notice:</strong> Seasonal malaria surge detected via CHW screening trends.
                      Expected overflow for peds triage at 1:30 PM. Active SHIF eligibility rate is 92% today (+5% vs avg).
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
                <h3 className="text-sm font-semibold text-ink">Quick Actions</h3>
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => setIdCheckOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-card px-4 py-2.5 text-sm font-semibold text-white bg-primary shadow-lg transition-opacity hover:opacity-90"
                  >
                    <Fingerprint className="h-4 w-4" />
                    Biometric ID Check
                  </button>
                  <button
                    onClick={() => setRegistrationOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-card border border-content-border bg-content-surface px-4 py-2.5 text-sm font-semibold text-charcoal transition-colors hover:bg-content-bg"
                  >
                    <UserPlus className="h-4 w-4" />
                    Patient Admission
                  </button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-card border border-content-border bg-content-surface px-4 py-2.5 text-sm font-semibold text-charcoal transition-colors hover:bg-content-bg">
                    <CreditCard className="h-4 w-4" />
                    New Invoice
                  </button>
                </div>
                <div className="mt-3 rounded-card border border-portal-primary/20 bg-portal-primary-light/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-portal-primary font-semibold">Recommended next action</p>
                  <p className="mt-1 text-sm text-charcoal">{nextAction}</p>
                  <p className="mt-1 text-xs text-slate">Current verification risk baseline: {verificationRiskPct}%</p>
                </div>
              </div>
            </section>
          </div>

          <div className="rounded-card border border-content-border bg-content-bg p-3 shadow-card">
            <HealthNewsPanel
              accentColor={ACCENT}
              heading="Patient news support for first contact"
              description="Surface the short counseling points reception staff can share while registering, checking in, and redirecting patients across the facility."
              insightTitle="Today's news priority"
              insightText="Respiratory complaints and antenatal follow-ups are trending upward this morning. Prioritize short wait-area reminders on hydration, mask use for cough symptoms, and rapid escalation for reduced fetal movement or breathing difficulty."
              role="reception"
              topics={HEALTH_NEWS_TOPICS}
            />
          </div>
        </main>
      </div>

      {/* Modals */}
      <IDCheckModal 
        open={idCheckOpen} 
        onClose={() => setIdCheckOpen(false)} 
        onRegisterNew={() => {
          setIdCheckOpen(false);
          setRegistrationOpen(true);
        }}
      />
      <PatientRegistrationForm 
        open={registrationOpen} 
        onClose={() => setRegistrationOpen(false)} 
      />
    </div>
  );
}
