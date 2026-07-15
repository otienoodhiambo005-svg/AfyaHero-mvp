'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Brain, Bed, Users, DollarSign, Activity, AlertTriangle, BarChart3, FileDown, Search, Building } from 'lucide-react';
import type { EducationTopicData } from '@/lib/health-news';
import { cn } from '@/lib/utils';
import { tokens } from '@/styles/design-tokens';
import logger from '@/lib/logger';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import ExecutiveIntelligenceDashboard from '@/components/admin/ExecutiveIntelligenceDashboard';
import ClinicalAlertsDashboard from '@/components/admin/ClinicalAlertsDashboard';
import ResourceAllocationUI from '@/components/admin/ResourceAllocationUI';
import PopulationHealthAnalytics from '@/components/admin/PopulationHealthAnalytics';
import { readDataSourceUnavailablePayload } from '@/lib/degraded-mode';

const HealthNewsPanel = dynamic(() => import('@/components/shared/HealthNewsPanel'), { ssr: false });

const ACCENT = tokens.colors.primary[500];

interface WardRow {
  name: string;
  total: number;
  occupied: number;
  doctor: string;
}

interface Alert {
  id: number;
  type: 'warning' | 'info' | 'success' | 'error';
  message: string;
  time: string;
}

interface QueueDepartment {
  dept: string;
  waiting: number;
  avgWait: number;
  slaTarget: number;
}


// Alert tone mappings now handled by StatusBadge component

const HEALTH_NEWS_TOPICS: EducationTopicData[] = [
  {
    title: 'Discharge education completion as a quality metric',
    tag: 'Quality',
    duration: '5 min read',
    summary: 'Track whether wards document medication, follow-up, and danger-sign counseling before discharge to reduce avoidable readmissions.',
    actionLabel: 'Review quality brief',
    image: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Community messaging during respiratory surges',
    tag: 'Population Health',
    duration: '4 min read',
    summary: 'Use standard public education messages on cough hygiene, early testing, vaccination, and high-risk referral thresholds during seasonal spikes.',
    actionLabel: 'Open campaign notes',
    image: 'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Staff refreshers for patient communication safety',
    tag: 'Operations',
    duration: '3 min read',
    summary: 'Frontline coaching on informed consent, medication explanations, and escalation advice helps protect care quality across departments.',
    actionLabel: 'View leadership checklist',
    image: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&q=70&auto=format&fit=crop',
  },
];


function OccupancyBar({ pct }: { pct: number }) {
  const colorClass = pct >= 95 ? 'bg-danger' : pct >= 80 ? 'bg-primary' : 'bg-success';
  return (
    <div className="w-full bg-content-border rounded-full h-1.5 mt-1">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminDashboard() {
  const [wards, setWards] = useState<WardRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
  const [queueDepartments, setQueueDepartments] = useState<QueueDepartment[]>([]);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`);
      const data = await res.json();
      setWards(Array.isArray(data.wards) ? data.wards : []);
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (err) {
      logger.error('Failed to load admin dashboard', { error: err });
      setLoadError(err instanceof Error ? err.message : 'Could not load dashboard.');
      setWards([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-KE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
    [],
  );

  useEffect(() => {
    const fetchDataEntity = async <T,>(entity: string): Promise<T | null> => {
      const response = await fetch(`/api/data?entity=${entity}`);
      if (!response.ok) {
        const degradedPayload = await readDataSourceUnavailablePayload(response);
        if (degradedPayload) {
          setDegradedNotice(
            'Some live admin metrics are temporarily unavailable. Showing the latest local dashboard snapshot.',
          );
        }
        return null;
      }
      return (await response.json()) as T;
    };

    Promise.all([
      fetchDataEntity<WardRow[]>('wards'),
      fetchDataEntity<Alert[]>('alerts'),
      fetch('/api/admin/queue/summary', { credentials: 'same-origin' }).then((r) => r.ok ? r.json() : null),
    ]).then(([w, a, q]) => {
      if (Array.isArray(w) && w.length) setWards(w);
      if (Array.isArray(a) && a.length) setAlerts(a);
      const queueRows = (q as { departments?: QueueDepartment[] } | null)?.departments;
      if (Array.isArray(queueRows)) {
        setQueueDepartments(queueRows);
      } else {
        setQueueLoadError('Queue action center is currently unavailable.');
      }
      if (!Array.isArray(w) || !Array.isArray(a)) {
        setLoadError('Live dashboard data is unavailable right now. Showing the latest local snapshot.');
      }
      if (Array.isArray(w) && Array.isArray(a)) {
        setDegradedNotice(null);
      }
    }).catch(() => {
      setLoadError('Live dashboard data is unavailable right now. Showing the latest local snapshot.');
      setQueueLoadError('Queue action center is currently unavailable.');
    });
  }, []);

  const totalBeds = wards.reduce((s, w) => s + w.total, 0);
  const occupiedBeds = wards.reduce((s, w) => s + w.occupied, 0);

  const filteredWards = useMemo(() => {
    if (!searchQuery) return wards;
    const query = searchQuery.toLowerCase();
    return wards.filter((ward) =>
      ward.name.toLowerCase().includes(query) ||
      ward.doctor.toLowerCase().includes(query)
    );
  }, [wards, searchQuery]);

  const queueRisk = useMemo(() => {
    if (queueDepartments.length === 0) {
      return {
        atRiskDepartments: 0,
        worstDepartment: null as QueueDepartment | null,
      };
    }
    const atRisk = queueDepartments.filter((dept) => dept.avgWait > dept.slaTarget * 0.8);
    const worst = [...queueDepartments].sort((a, b) => (b.avgWait - b.slaTarget) - (a.avgWait - a.slaTarget))[0] ?? null;
    return {
      atRiskDepartments: atRisk.length,
      worstDepartment: worst,
    };
  }, [queueDepartments]);

  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const occupancyToneClass =
    occupancyPct >= 95
      ? 'text-severity-high bg-severity-high-bg border-severity-high/30'
      : occupancyPct >= 80
        ? 'text-severity-medium bg-severity-medium-bg border-severity-medium/30'
        : 'text-ai-confirmed-text bg-ai-confirmed-bg border-portal-primary/25';

  const nextAction = useMemo(() => {
    if (occupancyPct >= 95) {
      return 'Trigger overflow protocol and review all discharge-eligible patients in ICU/Maternity within 30 minutes.';
    }
    if (queueRisk.atRiskDepartments > 0) {
      return 'Reassign triage and consultation staff to at-risk departments before SLA breach windows.';
    }
    return 'Maintain current staffing posture and run quality coaching in high-volume departments.';
  }, [occupancyPct, queueRisk.atRiskDepartments]);

  const shellSurface = 'rounded-3xl border border-content-border bg-content-surface text-charcoal shadow-card';
  const sectionSurface = 'rounded-3xl border border-content-border bg-content-canvas p-4 md:p-6';
  const softGlassCard = 'rounded-3xl border border-content-border bg-content-bg shadow-card';
  const subduedBadge = 'rounded-full border border-content-border bg-content-surface text-slate';
  const panelHeader = 'border-b border-content-border bg-content-surface px-5 py-4';

  return (
    <div className="min-h-screen bg-content-canvas p-3 md:p-5">
      <div className={`mx-auto w-full max-w-[1480px] space-y-5 p-3 md:p-4 ${shellSurface}`}>
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card md:p-6">
        <div className="absolute -right-8 top-0 h-40 w-40 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <Building className="h-3.5 w-3.5" />
              Hospital admin command
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">Administrative overview</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate">
              {today || 'Loading date...'} · operational posture across beds, staffing, revenue, and queue pressure.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
            {[
              { label: 'Occupancy', value: `${occupancyPct}%`, icon: <Bed className="h-4 w-4" /> },
              { label: 'Queue risk', value: queueRisk.atRiskDepartments, icon: <AlertTriangle className="h-4 w-4" /> },
              { label: 'Alerts', value: alerts.length, icon: <Activity className="h-4 w-4" /> },
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
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <button className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-content-bg ${subduedBadge}`}>
            <FileDown className="w-4 h-4" />
            Export
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity motion-safe:hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <BarChart3 className="w-4 h-4" />
            HMIS Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loadError && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm leading-relaxed text-danger">
          {loadError}
        </div>
      )}
      {degradedNotice && (
        <div className="rounded-card border border-warning/20 bg-warning/5 px-4 py-3 text-sm leading-relaxed text-warning">
          {degradedNotice}
        </div>
      )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {[
          {
            title: 'Bed Occupancy',
            value: `${Math.round((occupiedBeds / totalBeds) * 100)}%`,
            sub: `${occupiedBeds}/${totalBeds} beds occupied`,
            icon: <Bed className="w-5 h-5" />,
          },
          {
            title: 'OPD Today',
            value: '124',
            sub: 'patients seen',
            icon: <Users className="w-5 h-5" />,
          },
          {
            title: 'Revenue vs Budget',
            value: '84%',
            sub: 'KES 2.1M / KES 2.5M',
            icon: <DollarSign className="w-5 h-5" />,
          },
          {
            title: 'Staff on Duty',
            value: '42/58',
            sub: '16 off-duty / leave',
            icon: <Activity className="w-5 h-5" />,
          },
        ].map((card) => (
          <div key={card.title} className={`${softGlassCard} space-y-3 p-4 md:p-5`}>
            <div className="flex items-center justify-between">
              <span className="text-slate text-[11px] font-semibold uppercase tracking-[0.08em]">{card.title}</span>
              <span className="rounded-full border border-content-border bg-content-surface p-2 text-primary">
                {card.icon}
              </span>
            </div>
            <p className="text-3xl font-semibold leading-none tracking-tight text-ink">{card.value}</p>
            <p className="text-slate text-xs leading-relaxed">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Executive Intelligence - Desktop/Tablet Optimized */}
      <ExecutiveIntelligenceDashboard />

      {/* Clinical Alerts Dashboard */}
      <ClinicalAlertsDashboard />

      {/* Resource Allocation UI */}
      <ResourceAllocationUI
        resourceType="staff"
        optimizationGoal="efficiency"
        currentAllocation={{}}
        demandData={{}}
        constraints={{}}
      />

      {/* Population Health Analytics */}
      <PopulationHealthAnalytics
        timeframe="month"
        reportType="ahi"
      />

      {/* Operational Pulse — Glassboard quick scan */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className={`${softGlassCard} p-4`}>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate font-semibold">Occupancy Pressure</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-3xl font-semibold text-ink">{occupancyPct}%</p>
            <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', occupancyToneClass)}>
              {occupancyPct >= 95 ? 'Critical' : occupancyPct >= 80 ? 'Watch' : 'Stable'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate">Hospital-wide bed load across all active wards.</p>
        </div>

        <div className={`${softGlassCard} p-4`}>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate font-semibold">Queue Risk</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{queueRisk.atRiskDepartments}</p>
          <p className="mt-2 text-xs text-slate">
            {queueRisk.atRiskDepartments > 0
              ? `${queueRisk.atRiskDepartments} departments near SLA limits.`
              : 'All tracked departments are within SLA thresholds.'}
          </p>
        </div>

        <div className={`${softGlassCard} p-4`}>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate font-semibold">Decision Lane</p>
          <p className="mt-2 text-sm font-medium text-charcoal leading-relaxed">
            {nextAction}
          </p>
        </div>
      </div>

      {/* AI Alert */}
      <div
        className="rounded-3xl border border-primary/20 bg-content-bg p-4 md:p-6 shadow-card"
      >
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">AI Executive Alert</p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal md:max-w-[92%]">
              Bed occupancy in Maternity ward at 95% — consider early discharge review for 2 stable patients.
              Revenue is 16% below monthly target — 3 high-value insurance claims pending review (total KES 284,000).
              ICU full; recommend activating overflow protocol.
            </p>
          </div>
        </div>
      </div>

      {/* Action Center */}
      <div className={`${softGlassCard} p-4 md:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">Admin Action Center</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">Queue risk and escalation controls</h2>
          </div>
          <a
            href="/portal/admin/queue"
            className={`inline-flex items-center px-3 py-2 text-xs font-semibold hover:bg-content-bg ${subduedBadge}`}
          >
            Open Queue Monitor
          </a>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-card border border-warning/20 bg-warning/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-warning">At-risk departments</p>
            <p className="text-2xl font-bold text-warning">{queueRisk.atRiskDepartments}</p>
          </div>
          <div className="rounded-card border border-content-border bg-content-bg p-3 md:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-slate">Bottleneck forecast</p>
            <p className="text-sm text-charcoal mt-1">
              {queueRisk.worstDepartment
                ? `${queueRisk.worstDepartment.dept} is projected to miss SLA first (${queueRisk.worstDepartment.avgWait}m avg vs ${queueRisk.worstDepartment.slaTarget}m target).`
                : 'No live queue forecast available right now. Use Queue Monitor for manual check.'}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-card border border-portal-primary/20 bg-portal-primary-light/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-portal-primary font-semibold">Recommended next action</p>
          <p className="mt-1 text-sm text-charcoal">{nextAction}</p>
        </div>
        {queueLoadError && (
          <p className="mt-2 text-xs text-warning">{queueLoadError}</p>
        )}
      </div>

      {/* Ward Occupancy Table + Alerts (side by side) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Ward Table — 2/3 */}
        <div className="lg:col-span-2 overflow-hidden rounded-3xl border border-content-border bg-content-bg shadow-card">
          <div className={`flex flex-wrap items-center justify-between gap-3 ${panelHeader}`}>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Ward Occupancy</h2>
              <span className="text-slate text-xs">{filteredWards.length} wards</span>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wards..."
                aria-label="Search wards by ward name or doctor"
                className="w-full rounded-card border border-content-border bg-content-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-portal-primary/40 focus-visible:ring-2 focus-visible:ring-portal-primary/20 sm:w-56"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-content-border">
                  {['Ward', 'Total', 'Occupied', 'Available', 'Occupancy', 'Doctor on Duty'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {filteredWards.length > 0 ? (
                filteredWards.map((ward) => {
                  const pct = Math.round((ward.occupied / ward.total) * 100);
                  const isFull = pct >= 100;
                  return (
                    <tr key={ward.name} className="border-b border-content-border/70 transition-colors hover:bg-content-surface/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{ward.name}</span>
                          {isFull && (
                            <StatusBadge tone="danger" size="sm">FULL</StatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate">{ward.total}</td>
                      <td className="px-4 py-3 text-ink">{ward.occupied}</td>
                      <td className={cn('px-4 py-3 font-medium', isFull ? 'text-danger' : 'text-success')}>
                        {ward.total - ward.occupied}
                      </td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn('text-xs font-semibold', pct >= 95 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-success')}
                          >
                            {pct}%
                          </span>
                          <div className="flex-1">
                            <OccupancyBar pct={pct} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate whitespace-nowrap">{ward.doctor}</td>
                    </tr>
                  );
                })
              ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <Building className="h-5 w-5" />
                        </div>
                        <p className="text-ink font-medium">No wards match</p>
                        <p className="text-sm text-slate">Try adjusting your search query.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Alerts — 1/3 */}
        <div className="overflow-hidden rounded-3xl border border-content-border bg-content-bg shadow-card">
          <div className={`flex items-center gap-2 ${panelHeader}`}>
            <AlertTriangle className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight text-ink">Recent Alerts</h2>
          </div>
          <div className="space-y-3 p-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-card border border-content-border p-3 text-xs bg-content-bg"
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge tone={alert.type === 'error' ? 'danger' : alert.type === 'warning' ? 'warning' : alert.type === 'success' ? 'success' : 'info'} size="sm">{alert.type}</StatusBadge>
                </div>
                <p className="font-medium leading-snug text-ink">{alert.message}</p>
                <p className="mt-1 text-slate opacity-70">{alert.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <HealthNewsPanel
        accentColor={ACCENT}
        heading="Health news visibility for system-wide outcomes"
        description="Give executive teams a compact view of the news priorities that affect patient safety, readmissions, and population-health communication across the hospital."
        insightTitle="Today's news priority"
        insightText="Maternity and ICU pressure makes discharge quality and escalation messaging more important today. Audit whether high-risk units are documenting news on warning signs, follow-up timelines, and medication understanding."
        role="admin"
        topics={HEALTH_NEWS_TOPICS}
      />

      {/* Quick Actions */}
      <div className={`${softGlassCard} p-4 md:p-6`}>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Bed Census', icon: <Bed className="w-4 h-4" /> },
            { label: 'Staff Roster', icon: <Users className="w-4 h-4" /> },
            { label: 'Financial Report', icon: <DollarSign className="w-4 h-4" /> },
            { label: 'HMIS Export', icon: <FileDown className="w-4 h-4" /> },
          ].map((action) => (
            <button
              key={action.label}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-content-bg ${subduedBadge}`}
            >
              <span className="text-primary">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
