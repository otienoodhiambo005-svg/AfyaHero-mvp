'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BrainCircuit, FlaskConical, AlertTriangle, Clock, CheckCircle, XCircle, Play, Search, TestTubes, ShieldCheck } from 'lucide-react';
import type { EducationTopicData } from '@/lib/health-news';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';

const HealthNewsPanel = dynamic(() => import('@/components/shared/HealthNewsPanel'), { ssr: false });

type LabPriority = 'STAT' | 'Urgent' | 'Routine';
type LabStatus = 'Ordered' | 'Sample Collected' | 'Processing' | 'Completed';
type FilterTab = 'All' | 'STAT' | 'Urgent' | 'Routine';

interface QueueItem {
  labId: string;
  patient: string;
  test: string;
  sampleType: string;
  priority: LabPriority;
  ordered: string;
  collected: string;
  status: LabStatus;
  timeInLab: string;
}


// Priority/Status tone mappings now handled by StatusBadge component

const rowHighlight = (priority: LabPriority, status: LabStatus): string => {
  if (priority === 'STAT' && status !== 'Completed') return 'bg-danger/5';
  if (priority === 'Urgent' && status !== 'Completed') return 'bg-warning/5';
  return '';
};

const HEALTH_NEWS_TOPICS: EducationTopicData[] = [
  {
    title: 'Pre-test fasting instructions patients must understand',
    tag: 'Pre-Analytical',
    duration: '3 min read',
    summary: 'Use a standard explanation for fasting tests so patients know when to avoid food, what medications to disclose, and when samples should be rescheduled.',
    actionLabel: 'Open fasting guide',
    image: 'https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Safe sputum and urine sample coaching',
    tag: 'Collection',
    duration: '4 min read',
    summary: 'Reduce rejected samples by giving brief, consistent instructions on specimen labeling, contamination prevention, and transport timing.',
    actionLabel: 'View collection script',
    image: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Critical result handoff education points',
    tag: 'Patient Safety',
    duration: '2 min read',
    summary: 'When critical results are escalated, make sure staff know the key patient-facing messages to reinforce while directing urgent clinical review.',
    actionLabel: 'Read handoff points',
    image: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&q=70&auto=format&fit=crop',
  },
];


export default function LabDashboardPage(): React.ReactElement {
  const [today, setToday] = useState('');
  const [filter, setFilter] = useState<FilterTab>('All');
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyLabId, setBusyLabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/lab/queue', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load lab queue (${res.status})`);
      const data = await res.json();
      setQueue(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      logger.error('Failed to load lab queue', { error: err });
      setLoadError(err instanceof Error ? err.message : 'Could not load lab queue.');
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('en-KE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date()),
    );
  }, []);

  const filtered = useMemo(() => {
    return queue.filter((q) => {
      const matchFilter = filter === 'All' || q.priority === filter;
      if (!searchQuery) return matchFilter;
      const query = searchQuery.toLowerCase();
      const matchSearch = q.patient.toLowerCase().includes(query) ||
        q.labId.toLowerCase().includes(query) ||
        q.test.toLowerCase().includes(query);
      return matchFilter && matchSearch;
    });
  }, [queue, filter, searchQuery]);

  const filterTabs = useMemo<{ label: FilterTab; count: number }[]>(
    () => [
      { label: 'All', count: queue.length },
      { label: 'STAT', count: queue.filter((q) => q.priority === 'STAT').length },
      { label: 'Urgent', count: queue.filter((q) => q.priority === 'Urgent').length },
      { label: 'Routine', count: queue.filter((q) => q.priority === 'Routine').length },
    ],
    [queue],
  );

  const kpis = useMemo(() => {
    const totalInQueue = queue.length;
    const statPending = queue.filter((q) => q.priority === 'STAT' && q.status !== 'Completed').length;
    const completedToday = queue.filter((q) => q.status === 'Completed').length;
    const processingCount = queue.filter((q) => q.status === 'Processing').length;
    return { totalInQueue, statPending, completedToday, processingCount };
  }, [queue]);

  async function handleQueueAction(labId: string, action: 'process' | 'enter' | 'reject') {
    if (busyLabId) return;
    setBusyLabId(labId);
    setActionMessage(null);

    try {
      const response = await fetch('/api/lab/queue/action', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': `${labId}-${action}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ labId, action }),
      });

      if (!response.ok) {
        throw new Error(`Action failed with ${response.status}`);
      }

      const payload = await response.json() as {
        status?: LabStatus;
        persisted?: boolean;
        aiHints?: string[];
        escalationRequired?: boolean;
      };
      if (!payload.status) {
        throw new Error('Action failed: invalid response');
      }

      setQueue((prev) =>
        prev.map((item) => (item.labId === labId ? { ...item, status: payload.status as LabStatus } : item)),
      );

      const label =
        action === 'process'
          ? 'moved to processing'
          : action === 'enter'
            ? 'marked completed'
            : 'returned to ordered for recollection';
      const hint = payload.aiHints?.[0];
      const durabilityNote = payload.persisted ? '' : ' (queued locally; DB sync pending)';
      const escalationNote = payload.escalationRequired
        ? ' Critical-result escalation logged for clinician follow-up.'
        : '';
      setActionMessage(`${labId} ${label}${durabilityNote}.${hint ? ` AI note: ${hint}` : ''}${escalationNote}`);
    } catch {
      setActionMessage(`Could not update ${labId} right now. Please retry.`);
    } finally {
      setBusyLabId(null);
    }
  }

  return (
    <div className="min-h-screen bg-content-canvas p-3 md:p-5">
      <div className="mx-auto max-w-[1480px] space-y-5 rounded-3xl bg-content-surface p-4 text-charcoal shadow-card md:p-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
          <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary-light/35 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
                <FlaskConical className="h-3.5 w-3.5" />
                Kevin Mwangi · Lab Bench 3
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-ink md:text-5xl">Lab work queue</h1>
              <p className="mt-2 text-sm text-slate">{today || 'Loading date...'} · STAT samples, processing lanes, and result entry in one view</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
              {[
                { label: 'In queue', value: kpis.totalInQueue, icon: <TestTubes className="h-4 w-4" /> },
                { label: 'STAT', value: kpis.statPending, icon: <AlertTriangle className="h-4 w-4" /> },
                { label: 'Done', value: kpis.completedToday, icon: <ShieldCheck className="h-4 w-4" /> },
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

        {/* AI Alert */}
        {!alertDismissed && (
          <div className="flex gap-3 rounded-3xl border border-portal-primary/25 bg-content-bg p-4 shadow-card">
            <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-portal-primary" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-sm font-semibold text-portal-primary">AI Priority Alert</p>
              <p className="text-sm leading-relaxed text-charcoal">
                <span className="font-medium text-danger">2 STAT samples overdue.</span>{' '}
                Sample <span className="font-medium text-ink">LAB-2847</span> (Blood Culture) at risk of contamination  4h 20m in transit. Predicted TAT breach for 3 routine samples.
              </p>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="mt-0.5 shrink-0 rounded-lg px-1.5 py-1 text-xs text-portal-primary transition-colors hover:bg-portal-primary-light/30 hover:text-portal-primary-hover">
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Strip */}
        {loadError && (
          <ErrorState title="Could not load lab queue" description={loadError} onRetry={loadQueue} />
        )}
        {actionMessage && (
          <div className="rounded-card border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
            {actionMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total in Queue', value: String(kpis.totalInQueue), sub: 'Samples', color: 'text-portal-primary', icon: <FlaskConical className="h-5 w-5" /> },
            { label: 'STAT Pending', value: String(kpis.statPending), sub: 'Critical priority', color: 'text-danger', icon: <AlertTriangle className="h-5 w-5" /> },
            { label: 'Completed Today', value: String(kpis.completedToday), sub: 'Samples processed', color: 'text-success', icon: <CheckCircle className="h-5 w-5" /> },
            { label: 'Active Processing', value: String(kpis.processingCount), sub: 'Running benches', color: 'text-info', icon: <Clock className="h-5 w-5" /> },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-3xl border border-content-border bg-content-bg p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate">{kpi.label}</span>
                <span className={kpi.color}>{kpi.icon}</span>
              </div>
              <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
              <p className="mt-1 text-xs text-slate">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs and Search */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-content-border bg-content-bg p-4 shadow-card">
          <div className="flex flex-wrap gap-2">
            {filterTabs.map(({ label, count }) => (
              <button
                key={label}
                onClick={() => setFilter(label)}
                aria-pressed={filter === label}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  filter === label
                    ? 'border-portal-primary/30 bg-portal-primary-light/35 text-portal-primary'
                    : 'border-content-border bg-content-surface text-slate hover:border-mist hover:text-ink'
                )}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs',
                    filter === label ? 'bg-portal-primary/20 text-portal-primary' : 'bg-content-border text-slate'
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full shrink-0 sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient, test, or Lab ID..."
              aria-label="Search lab work queue"
              className="h-10 w-full rounded-full border border-content-border bg-content-surface pl-9 pr-3 text-sm text-charcoal outline-none transition focus:border-portal-primary/40 focus:bg-content-bg sm:w-80"
            />
          </div>
        </div>

        {/* Work Queue Table */}
        <div className="overflow-hidden rounded-3xl border border-content-border bg-content-bg shadow-card">
          <div className="border-b border-content-border bg-content-surface px-5 py-3">
            <span className="text-xs text-slate">{filtered.length} results</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-content-border bg-content-surface">
                  {['Lab ID', 'Patient', 'Test', 'Sample', 'Priority', 'Ordered', 'Collected', 'Status', 'Time in Lab', 'Actions'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((item, index) => (
                    <tr
                      key={`lab-${index}-${item.labId || 'unknown'}`}
                      className={cn('border-b border-content-border/70 bg-content-bg transition-colors hover:bg-content-bg', rowHighlight(item.priority, item.status))}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {item.priority === 'STAT' && item.status !== 'Completed' && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />
                          )}
                          <span className="font-mono text-xs text-portal-primary">{item.labId}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{item.patient}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal">{item.test}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal">{item.sampleType}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge
                          tone={item.priority === 'STAT' ? 'danger' : item.priority === 'Urgent' ? 'warning' : 'neutral'}
                          size="sm"
                        >
                          {item.priority}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal">{item.ordered}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal">{item.collected}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={item.status.toLowerCase().replace(/\s+/g, '-')} size="sm">
                          {item.status}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={cn('text-sm', item.timeInLab !== '' && item.priority === 'STAT' ? 'font-medium text-severity-high' : 'text-charcoal')}>
                          {item.timeInLab}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.status !== 'Completed' && (
                            <button
                              onClick={() => handleQueueAction(item.labId, 'process')}
                              disabled={busyLabId === item.labId}
                              className="inline-flex items-center gap-1 rounded-full border border-portal-primary/30 bg-portal-primary-light/35 px-2 py-1 text-xs text-portal-primary transition hover:bg-portal-primary-light/55 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Play className="h-3 w-3" /> {busyLabId === item.labId ? 'Updating...' : 'Process'}
                            </button>
                          )}
                          {item.status === 'Processing' && (
                            <button
                              onClick={() => handleQueueAction(item.labId, 'enter')}
                              disabled={busyLabId === item.labId}
                              className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/5 px-2 py-1 text-xs text-success transition hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <CheckCircle className="h-3 w-3" /> {busyLabId === item.labId ? 'Updating...' : 'Enter'}
                            </button>
                          )}
                          <button
                            onClick={() => handleQueueAction(item.labId, 'reject')}
                            disabled={busyLabId === item.labId}
                            className="inline-flex items-center gap-1 rounded-full border border-danger/20 bg-danger/5 px-2 py-1 text-xs text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle className="h-3 w-3" /> {busyLabId === item.labId ? 'Updating...' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-8">
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <TestTubes className="h-5 w-5" />
                        </div>
                        <p className="text-ink font-medium">No samples match</p>
                        <p className="text-sm text-slate">Try adjusting your search or filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-content-border bg-content-bg p-3 shadow-card md:p-4">
          <HealthNewsPanel
            accentColor="var(--portal-primary)"
            heading="Health news for specimen quality and patient preparation"
            description="Keep the highest-value patient instructions visible so lab teams can improve preparation, reduce recollects, and support safer result escalation."
            insightTitle="Today's news priority"
            insightText="STAT and urgent samples are climbing. Focus on patient prep reminders for fasting and clean collection, especially before repeat samples or high-risk recollection decisions."
            role="lab"
            topics={HEALTH_NEWS_TOPICS}
          />
        </div>
      </div>
    </div>
  );
}
