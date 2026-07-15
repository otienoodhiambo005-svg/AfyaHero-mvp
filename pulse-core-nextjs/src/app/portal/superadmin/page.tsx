/**
 * Super Admin Dashboard
 * Global system overview for platform administrators
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

import KPICard from '@/components/ui/KPICard';
import PageLayout from '@/components/ui/PageLayout';
import { TenantHeatmap } from '@/components/ui/TenantHeatmap';
import { AICostTrend } from '@/components/ui/AICostTrend';
import { tokens } from '@/styles/design-tokens';
import {
  Activity,
  Building2,
  Users,
  AlertTriangle,
  Server,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Gauge,
  GitBranch,
  Telescope,
  BarChart3,
  Calendar,
  FlaskConical,
  ClipboardList,
} from 'lucide-react';

interface DashboardPayload {
  timestamp: string;
  stats: {
    totalHospitals: number;
    totalUsers: number;
    activeUsers24h: number;
    openErrors: number;
    systemStatus: 'healthy' | 'warning' | 'critical';
    apiSuccessRate: number;
  };
  trends: {
    hospitalsPct: number;
    usersPct: number;
    activeUsersPct: number;
    incidentsPct: number;
    auditEvents24hPct: number;
  };
  capacity: {
    nodeHeapUsedMb: number;
    nodeHeapTotalMb: number;
    nodeRssMb: number;
    heapUtilizationPct: number;
    cpuCores: number;
    auditEvents24h: number;
    globalQueueDepth: number;
    redisConfigured: boolean;
  };
  performance: {
    clinicalEvents24h: number;
    clinicalEventsPrev24h: number;
    throughputVsPrior24hPct: number;
    breakdown: {
      appointments: number;
      labOrders: number;
      checkins: number;
      consultations: number;
    };
  };
  sparkline: {
    auditDailyLast7: number[];
    appointmentsDailyLast7: number[];
  };
  bottlenecks: {
    topQueues: Array<{ hospitalId: string; hospitalName: string; tokens: number }>;
    topAuditActions24h: Array<{ action: string; count: number }>;
    labRequestsOver48h: number;
    failedDataExchanges7d: number;
  };
  forecast: {
    auditEventsNext7d: number;
    auditEventsLast7d: number;
    deltaPctVsLast7: number;
    method: string;
  };
  forecastAppointments: {
    appointmentsNext7d: number;
    appointmentsLast7d: number;
    deltaPctVsLast7: number;
    method: string;
  };
}

function Sparkline7({ values, label }: { values: number[]; label: string }) {
  const safe = values.length === 7 ? values : [...values, ...Array(7).fill(0)].slice(0, 7);
  const max = Math.max(1, ...safe);
  return (
    <div className="pt-2 border-t border-content-border">
      <div className="text-xs text-slate mb-2">{label}</div>
      <div className="flex h-12 items-end gap-1" role="img" aria-label={`${label}: seven day trend`}>
        {safe.map((v, i) => {
          const h = Math.round((v / max) * 100);
          return (
            <div
              key={i}
              className="flex-1 min-w-0 rounded-sm bg-blue-500/75 dark:bg-blue-400/70 transition-all"
              style={{ height: `${Math.max(v > 0 ? 8 : 2, h)}%` }}
              title={`Day ${i + 1}: ${v}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate font-mono">
        <span>−6d</span>
        <span>today</span>
      </div>
    </div>
  );
}

function isDashboardPayload(body: unknown): body is DashboardPayload {
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  const stats = o.stats as Record<string, unknown> | undefined;
  const trends = o.trends as Record<string, unknown> | undefined;
  const capacity = o.capacity as Record<string, unknown> | undefined;
  const performance = o.performance as Record<string, unknown> | undefined;
  const breakdown = performance?.breakdown as Record<string, unknown> | undefined;
  const sparkline = o.sparkline as Record<string, unknown> | undefined;
  const bottlenecks = o.bottlenecks as Record<string, unknown> | undefined;
  const forecast = o.forecast as Record<string, unknown> | undefined;
  const forecastAppointments = o.forecastAppointments as Record<string, unknown> | undefined;

  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const arrNum = (v: unknown) => Array.isArray(v) && v.length === 7 && v.every((x) => typeof x === 'number');

  return (
    Boolean(stats && trends && capacity && performance && sparkline && bottlenecks && forecast && forecastAppointments) &&
    num(stats?.totalHospitals) &&
    num(trends?.auditEvents24hPct) &&
    num(capacity?.nodeRssMb) &&
    num(performance?.clinicalEvents24h) &&
    Boolean(breakdown) &&
    num(breakdown?.appointments) &&
    arrNum(sparkline?.auditDailyLast7) &&
    arrNum(sparkline?.appointmentsDailyLast7) &&
    num(forecastAppointments?.appointmentsNext7d)
  );
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiCostData, setAiCostData] = useState<
    Array<{
      date: string;
      huggingface: number;
      groq: number;
      gemini: number;
      openai: number;
      claude: number;
    }>
  >([]);
  const [aiCostBudget, setAiCostBudget] = useState(100);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, aiCostsRes] = await Promise.all([
        fetch('/api/superadmin/dashboard', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/superadmin/ai-costs', { credentials: 'include', cache: 'no-store' }),
      ]);
      const body = (await dashboardRes.json().catch(() => ({}))) as DashboardPayload & { error?: string };
      if (!dashboardRes.ok) {
        throw new Error(body.error || `Failed to load dashboard (${dashboardRes.status})`);
      }
      if (!isDashboardPayload(body)) {
        throw new Error('Invalid dashboard response');
      }
      setData(body);

      const aiBody = (await aiCostsRes.json().catch(() => ({}))) as {
        data?: typeof aiCostData;
        budget?: number;
      };
      if (aiCostsRes.ok && Array.isArray(aiBody.data)) {
        setAiCostData(aiBody.data);
        if (typeof aiBody.budget === 'number') setAiCostBudget(aiBody.budget);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading && !data) {
    return (
      <PageLayout title="Platform Dashboard">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-content-bg border border-content-border rounded-card" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-48 bg-content-bg border border-content-border rounded-card" />
            <div className="h-48 bg-content-bg border border-content-border rounded-card" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!data && error && !loading) {
    return (
      <PageLayout
        title="Platform Dashboard"
        actions={
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-card border border-content-border bg-content-surface px-3 py-2 text-sm font-medium text-charcoal hover:bg-content-bg disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry
          </button>
        }
      >
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-card border border-danger/20 bg-danger/5 p-10 text-center text-danger"
          role="alert"
        >
          <AlertTriangle className="h-10 w-10 shrink-0" />
          <div>
            <div className="text-lg font-semibold">Live metrics unavailable</div>
            <p className="mt-2 max-w-md text-sm opacity-90">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-card bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Try again
          </button>
        </div>
      </PageLayout>
    );
  }

  const stats = data?.stats;
  const trends = data?.trends;
  const capacity = data?.capacity;
  const performance = data?.performance;
  const sparkline = data?.sparkline;
  const bottlenecks = data?.bottlenecks;
  const forecast = data?.forecast;
  const forecastAppointments = data?.forecastAppointments;

  const statusMeta =
    stats?.systemStatus === 'critical'
      ? {
          label: 'Critical attention required',
          sub: 'Open security incidents, heap pressure, or payment health triggered an alert.',
          Icon: AlertTriangle,
          iconClass: 'text-danger',
        }
      : stats?.systemStatus === 'warning'
        ? {
            label: 'Elevated risk',
            sub: 'Review bottlenecks and incident backlog.',
            Icon: AlertTriangle,
            iconClass: 'text-warning',
          }
        : {
            label: 'All systems operational',
            sub: `Payment completion rate (7d): ${stats?.apiSuccessRate ?? 0}%`,
            Icon: CheckCircle2,
            iconClass: 'text-success',
          };

  const StatusIcon = statusMeta.Icon;

  const throughputPct = performance?.throughputVsPrior24hPct ?? 0;
  const throughputLabel =
    throughputPct > 0
      ? `Up ${throughputPct}% vs prior 24h`
      : throughputPct < 0
        ? `Down ${Math.abs(throughputPct)}% vs prior 24h`
        : 'Flat vs prior 24h';

  return (
    <PageLayout
      title="Platform Dashboard"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {loading && data ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating metrics…
            </span>
          ) : null}
          {data?.timestamp ? (
            <span className="hidden text-xs text-slate sm:inline font-mono">
              Snapshot: {new Date(data.timestamp).toLocaleString()}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-card border border-content-border bg-content-surface px-3 py-2 text-sm font-medium text-charcoal hover:bg-content-bg disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card md:p-6">
          <div className="absolute -right-8 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Telescope className="h-3.5 w-3.5" />
                Platform command
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-charcoal md:text-5xl">Africa-scale operating view</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate">
                Monitor tenant growth, active facilities, AI spend, audit pressure, and infrastructure capacity from one global console.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
              {[
                { label: 'Hospitals', value: stats?.totalHospitals ?? 0, icon: <Building2 className="h-4 w-4" /> },
                { label: 'Active 24h', value: stats?.activeUsers24h ?? 0, icon: <Activity className="h-4 w-4" /> },
                { label: 'API rate', value: `${stats?.apiSuccessRate ?? 0}%`, icon: <CheckCircle2 className="h-4 w-4" /> },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-sm">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <p className="text-2xl font-semibold text-charcoal">{item.value}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && data ? (
          <div
            className="flex flex-col gap-3 rounded-card border border-warning/20 bg-warning/5 p-4 text-warning sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-medium">Refresh failed — showing last good snapshot</div>
                <div className="text-sm opacity-90">{error}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-card bg-warning px-4 py-2 text-sm font-medium text-white hover:bg-warning/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry
            </button>
          </div>
        ) : null}

        {error && !data ? null : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="Total Hospitals"
                value={stats?.totalHospitals ?? 0}
                icon={Building2}
                trend={{ value: trends?.hospitalsPct ?? 0, label: 'new vs prior 30 days' }}
                accentColor={tokens.colors.primary[500]}
              />
              <KPICard
                title="Registered Users"
                value={stats?.totalUsers ?? 0}
                icon={Users}
                trend={{ value: trends?.usersPct ?? 0, label: 'new vs prior 7 days' }}
                accentColor={tokens.colors.primary[500]}
              />
              <KPICard
                title="Active Users (24h)"
                value={stats?.activeUsers24h ?? 0}
                icon={Activity}
                trend={{ value: trends?.activeUsersPct ?? 0, label: 'vs prior 24h window' }}
                accentColor={tokens.colors.primary[500]}
              />
              <KPICard
                title="Open Incidents"
                value={stats?.openErrors ?? 0}
                icon={AlertTriangle}
                trend={{ value: trends?.incidentsPct ?? 0, label: 'new vs prior 7 days' }}
                accentColor={tokens.colors.primary[500]}
              />
            </div>

            <TenantHeatmap
              tenants={bottlenecks?.topQueues?.map((q) => ({
                id: q.hospitalId,
                name: q.hospitalName,
                county: 'Nairobi',
                status: q.tokens > 15 ? 'critical' : q.tokens > 8 ? 'active' : 'onboarding',
                users: q.tokens,
                lastActivity: '24h',
              })) ?? []}
              onFilterByStatus={(status) => {
                window.location.href = `/portal/superadmin/hospitals?status=${status}`;
              }}
            />

            <AICostTrend
              data={
                aiCostData.length > 0
                  ? aiCostData
                  : [
                      { date: 'Mon', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                      { date: 'Tue', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                      { date: 'Wed', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                      { date: 'Thu', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                      { date: 'Fri', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                      { date: 'Sat', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                      { date: 'Sun', huggingface: 0, groq: 0, gemini: 0, openai: 0, claude: 0 },
                    ]
              }
              budget={aiCostBudget}
            />

            <div className="bg-content-surface rounded-card p-6 border border-content-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-charcoal">
                      Clinical throughput (24h)
                    </h3>
                    <p className="text-sm text-slate">
                      Live counts across appointments, lab orders, reception check-ins, and consultations — compared to
                      the prior rolling 24 hours.
                    </p>
                  </div>
                </div>
                <div className="rounded-card border border-content-border bg-content-bg px-4 py-3 text-right shrink-0">
                  <div className="text-xs text-slate">Composite trend</div>
                  <div
                    className={`text-lg font-semibold ${
                      throughputPct > 0
                        ? 'text-success'
                        : throughputPct < 0
                          ? 'text-danger'
                          : 'text-charcoal'
                    }`}
                  >
                    {throughputLabel}
                  </div>
                  <div className="text-xs text-slate mt-0.5 font-mono">
                    {performance?.clinicalEvents24h ?? 0} events (prev {performance?.clinicalEventsPrev24h ?? 0})
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-card border border-content-border p-4">
                  <div className="flex items-center gap-2 text-xs text-slate mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Appointments
                  </div>
                  <div className="text-xl font-semibold text-charcoal">
                    {performance?.breakdown.appointments ?? 0}
                  </div>
                </div>
                <div className="rounded-card border border-content-border p-4">
                  <div className="flex items-center gap-2 text-xs text-slate mb-1">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Lab orders
                  </div>
                  <div className="text-xl font-semibold text-charcoal">
                    {performance?.breakdown.labOrders ?? 0}
                  </div>
                </div>
                <div className="rounded-card border border-content-border p-4">
                  <div className="flex items-center gap-2 text-xs text-slate mb-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Check-ins
                  </div>
                  <div className="text-xl font-semibold text-charcoal">
                    {performance?.breakdown.checkins ?? 0}
                  </div>
                </div>
                <div className="rounded-card border border-content-border p-4">
                  <div className="flex items-center gap-2 text-xs text-slate mb-1">
                    <Activity className="h-3.5 w-3.5" />
                    Consultations
                  </div>
                  <div className="text-xl font-semibold text-charcoal">
                    {performance?.breakdown.consultations ?? 0}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate">
                <span className="rounded-full bg-content-bg border border-content-border px-2 py-0.5 font-mono">
                  Audit events (24h): {capacity?.auditEvents24h ?? 0}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono ${
                    (trends?.auditEvents24hPct ?? 0) >= 0
                      ? 'bg-success/5 text-success'
                      : 'bg-danger/5 text-danger'
                  }`}
                >
                  Audit Δ vs prior 24h: {(trends?.auditEvents24hPct ?? 0) >= 0 ? '+' : ''}
                  {trends?.auditEvents24hPct ?? 0}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-content-surface rounded-card p-6 border border-content-border">
                <div className="flex items-center gap-3 mb-4">
                  <Server className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-charcoal">System Status</h3>
                </div>
                <div className="flex items-center gap-3">
                  <StatusIcon className={`w-8 h-8 ${statusMeta.iconClass}`} />
                  <div>
                    <div className="font-medium text-charcoal">{statusMeta.label}</div>
                    <div className="text-sm text-slate">{statusMeta.sub}</div>
                  </div>
                </div>
              </div>

              <div className="bg-content-surface rounded-card p-6 border border-content-border">
                <div className="flex items-center gap-3 mb-4">
                  <Gauge className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-charcoal">Capacity &amp; throughput</h3>
                </div>
                <div className="space-y-3 text-sm text-slate">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Node heap utilization</span>
                      <span className="font-mono">{capacity?.heapUtilizationPct ?? 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-content-bg overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, capacity?.heapUtilizationPct ?? 0)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate mt-1">
                      {capacity?.nodeHeapUsedMb ?? 0} / {capacity?.nodeHeapTotalMb ?? 0} MB heap · RSS{' '}
                      {capacity?.nodeRssMb ?? 0} MB · {capacity?.cpuCores ?? 0} vCPU (host)
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-content-border">
                    <div>
                      <div className="text-xs text-slate">Audit events (24h)</div>
                      <div className="text-lg font-semibold text-charcoal">
                        {capacity?.auditEvents24h ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate">Queue tokens (active)</div>
                      <div className="text-lg font-semibold text-charcoal">
                        {capacity?.globalQueueDepth ?? 0}
                      </div>
                    </div>
                    <div className="col-span-2 text-xs text-slate">
                      Redis cache: {capacity?.redisConfigured ? 'configured' : 'not configured'}
                    </div>
                  </div>
                  {sparkline ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Sparkline7 values={sparkline.auditDailyLast7} label="Audit volume (UTC days)" />
                      <Sparkline7
                        values={sparkline.appointmentsDailyLast7}
                        label="New appointments (UTC days)"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-content-surface rounded-card p-6 border border-content-border">
                <div className="flex items-center gap-3 mb-4">
                  <GitBranch className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-charcoal">Bottlenecks</h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate mb-2">
                      Busiest facility queues
                    </div>
                    {bottlenecks && bottlenecks.topQueues.length > 0 ? (
                      <ul className="space-y-2">
                        {bottlenecks.topQueues.map((row) => (
                          <li
                            key={row.hospitalId}
                            className="flex justify-between gap-2 border-b border-content-border pb-2 last:border-0"
                          >
                            <span className="text-charcoal truncate">{row.hospitalName}</span>
                            <span className="font-mono text-slate shrink-0">{row.tokens}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate">No active queue backlog detected.</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate mb-2">
                      Top audit actions (24h)
                    </div>
                    {bottlenecks && bottlenecks.topAuditActions24h.length > 0 ? (
                      <ul className="space-y-2">
                        {bottlenecks.topAuditActions24h.map((row) => (
                          <li
                            key={row.action}
                            className="flex justify-between gap-2 border-b border-content-border pb-2 last:border-0"
                          >
                            <span className="text-charcoal truncate font-mono text-xs">
                              {row.action}
                            </span>
                            <span className="font-mono text-slate shrink-0">{row.count}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate">No audit volume in the last 24 hours.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate pt-2 border-t border-content-border">
                    <span>Lab requests pending &gt;48h: {bottlenecks?.labRequestsOver48h ?? 0}</span>
                    <span>Records needing follow-up (7d): {bottlenecks?.failedDataExchanges7d ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-content-surface rounded-card p-6 border border-content-border">
                <div className="flex items-center gap-3 mb-4">
                  <Telescope className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-charcoal">Audit activity forecast</h3>
                </div>
                <p className="text-sm text-slate mb-4">
                  Linear projection from daily audit counts (UTC) for the last seven days. Useful as an early signal of
                  activity trends — not a guarantee.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-card bg-content-bg p-4 border border-content-border">
                    <div className="text-xs text-slate">Last 7 days (actual)</div>
                    <div className="text-2xl font-semibold text-charcoal">
                      {forecast?.auditEventsLast7d ?? 0}
                    </div>
                    <div className="text-xs text-slate mt-1">audit events</div>
                  </div>
                  <div className="rounded-card bg-primary/5 p-4 border border-primary/20">
                    <div className="text-xs text-primary">Next 7 days (projected)</div>
                    <div className="text-2xl font-semibold text-primary">
                      {forecast?.auditEventsNext7d ?? 0}
                    </div>
                    <div className="text-xs text-primary mt-1">
                      {forecast && forecast.deltaPctVsLast7 >= 0 ? '+' : ''}
                      {forecast?.deltaPctVsLast7 ?? 0}% vs last week&apos;s volume
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate font-mono truncate">
                  Model: {forecast?.method ?? '—'}
                </div>
              </div>

              <div className="bg-content-surface rounded-card p-6 border border-content-border">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-charcoal">Appointment demand forecast</h3>
                </div>
                <p className="text-sm text-slate mb-4">
                  Projection from daily <em>new appointment</em> records (UTC). Use this with audit trends to identify
                  where demand may need staffing or schedule changes.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-card bg-content-bg p-4 border border-content-border">
                    <div className="text-xs text-slate">Last 7 days (actual)</div>
                    <div className="text-2xl font-semibold text-charcoal">
                      {forecastAppointments?.appointmentsLast7d ?? 0}
                    </div>
                    <div className="text-xs text-slate mt-1">appointments created</div>
                  </div>
                  <div className="rounded-card bg-violet-50 dark:bg-violet-950/40 p-4 border border-violet-100 dark:border-violet-900/50">
                    <div className="text-xs text-violet-800 dark:text-violet-200">Next 7 days (projected)</div>
                    <div className="text-2xl font-semibold text-violet-900 dark:text-violet-100">
                      {forecastAppointments?.appointmentsNext7d ?? 0}
                    </div>
                    <div className="text-xs text-violet-800/80 dark:text-violet-200/90 mt-1">
                      {forecastAppointments && forecastAppointments.deltaPctVsLast7 >= 0 ? '+' : ''}
                      {forecastAppointments?.deltaPctVsLast7 ?? 0}% vs last week&apos;s volume
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate font-mono truncate">
                  Model: {forecastAppointments?.method ?? '—'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
