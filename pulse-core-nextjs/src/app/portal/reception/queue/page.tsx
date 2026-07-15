'use client';

import { useEffect, useState } from 'react';
import {
  RefreshCw, Volume2, Eye, CheckCircle2, AlertTriangle, Brain, Clock, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ServiceTab = 'OPD' | 'Lab' | 'Pharmacy' | 'Triage';
type QueueStatus = 'Waiting' | 'Called' | 'In Progress' | 'Done';

interface QueuePatient {
  token: string;
  name: string;
  ageSex: string;
  wait: string;
  priority: 'Normal' | 'Urgent' | 'Critical';
  status: QueueStatus;
  service: ServiceTab;
  queueId?: string;
}

const QUEUE: QueuePatient[] = [
  { token: 'A003', name: 'Fatuma Hassan', ageSex: '52F', wait: '38 min', priority: 'Normal', status: 'Waiting', service: 'OPD' },
  { token: 'A005', name: 'Achieng Otieno', ageSex: '29F', wait: '31 min', priority: 'Normal', status: 'Waiting', service: 'OPD' },
  { token: 'A007', name: 'Nyambura Gicheru', ageSex: '18F', wait: '45 min', priority: 'Normal', status: 'Waiting', service: 'OPD' },
  { token: 'A009', name: 'Peter Njoroge', ageSex: '44M', wait: '22 min', priority: 'Urgent', status: 'Called', service: 'OPD' },
  { token: 'B001', name: 'Amina Waweru', ageSex: '36F', wait: '28 min', priority: 'Normal', status: 'Waiting', service: 'Lab' },
  { token: 'B002', name: 'Daniel Ochieng', ageSex: '61M', wait: '15 min', priority: 'Normal', status: 'In Progress', service: 'Lab' },
  { token: 'B003', name: 'Rose Njoki', ageSex: '27F', wait: '10 min', priority: 'Urgent', status: 'Waiting', service: 'Lab' },
  { token: 'C001', name: 'Hassan Musa', ageSex: '48M', wait: '20 min', priority: 'Normal', status: 'Waiting', service: 'Pharmacy' },
  { token: 'C002', name: 'Joyce Kamau', ageSex: '33F', wait: '12 min', priority: 'Normal', status: 'Waiting', service: 'Pharmacy' },
  { token: 'D001', name: 'Samuel Kibet', ageSex: '8M', wait: '5 min', priority: 'Critical', status: 'Called', service: 'Triage' },
];

const TAB_COUNTS: Record<ServiceTab, number> = { OPD: 12, Lab: 7, Pharmacy: 5, Triage: 3 };

const PRIORITY_STYLES: Record<string, string> = {
  Normal: 'bg-success/5 text-success border border-success/20',
  Urgent: 'bg-warning/5 text-warning border border-warning/20',
  Critical: 'bg-danger/5 text-danger border border-danger/20',
};

const STATUS_STYLES: Record<QueueStatus, string> = {
  Waiting: 'bg-slate-100 text-slate-700 border border-content-border',
  Called: 'bg-warning/5 text-warning border border-warning/20',
  'In Progress': 'bg-info/5 text-info border border-info/20',
  Done: 'bg-success/5 text-success border border-success/20',
};

export default function QueuePage() {
  const [activeTab, setActiveTab] = useState<ServiceTab>('OPD');
  const [patientStatuses, setPatientStatuses] = useState<Record<string, QueueStatus>>({});
  const [lastRefresh, setLastRefresh] = useState('');
  const [queueRows, setQueueRows] = useState<Array<QueuePatient & { queueId?: string }>>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyQueueId, setBusyQueueId] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let bootstrapFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let source: EventSource | null = null;

    const markRefreshed = () => {
      setLastRefresh(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }));
    };

    const fetchQueue = async () => {
      if (disposed) return;
      const response = await fetch('/api/reception/queue');
      if (!response.ok) return;
      const data = await response.json() as Array<QueuePatient & { queueId?: string }>;
      if (Array.isArray(data) && !disposed) {
        setQueueRows(data);
        markRefreshed();
      }
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const startPolling = () => {
      if (pollTimer || disposed) return;
      void fetchQueue();
      pollTimer = setInterval(() => void fetchQueue(), 20000);
    };

    const clearReconnectTimer = () => {
      if (!reconnectTimer) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const connectSse = () => {
      if (disposed || source) return;
      source = new EventSource('/api/reception/queue/stream');
      source.onopen = () => {
        if (bootstrapFallbackTimer) {
          clearTimeout(bootstrapFallbackTimer);
          bootstrapFallbackTimer = null;
        }
        stopPolling();
      };
      source.addEventListener('queue', (event) => {
        if (disposed) return;
        try {
          const payload = JSON.parse(event.data) as Array<QueuePatient & { queueId?: string }>;
          if (Array.isArray(payload)) {
            setQueueRows(payload);
            markRefreshed();
          }
        } catch {
          // Ignore malformed event payloads and keep stream alive.
        }
      });
      source.onerror = () => {
        if (source) {
          source.close();
          source = null;
        }
        startPolling();
        if (!reconnectTimer && !disposed) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSse();
          }, 5000);
        }
      };
    };

    markRefreshed();
    void fetchQueue();
    connectSse();
    bootstrapFallbackTimer = setTimeout(() => {
      startPolling();
    }, 6000);

    return () => {
      disposed = true;
      stopPolling();
      clearReconnectTimer();
      if (bootstrapFallbackTimer) {
        clearTimeout(bootstrapFallbackTimer);
      }
      if (source) {
        source.close();
        source = null;
      }
    };
  }, []);

  const displayQueue = (queueRows.length > 0 ? queueRows : QUEUE).filter((p) => p.service === activeTab);
  const activeQueue = queueRows.length > 0 ? queueRows : QUEUE;
  const urgentCount = activeQueue.filter((p) => p.priority === 'Urgent' || p.priority === 'Critical').length;

  function getStatus(p: QueuePatient): QueueStatus {
    return patientStatuses[p.token] ?? p.status;
  }

  function callPatient(token: string) {
    setPatientStatuses((s) => ({ ...s, [token]: 'Called' }));
  }

  function markDone(token: string) {
    setPatientStatuses((s) => ({ ...s, [token]: 'Done' }));
  }

  function escalate(token: string) {
    setPatientStatuses((s) => ({ ...s, [token]: 'In Progress' }));
  }

  async function persistAction(queueId: string | undefined, action: 'call' | 'start' | 'done' | 'escalate') {
    if (!queueId) return;
    setActionError(null);
    setBusyQueueId(queueId);
    try {
      const response = await fetch('/api/reception/queue/action', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({ queueId, action }),
      });
      if (!response.ok) {
        throw new Error(`Queue action failed (${response.status})`);
      }
    } catch {
      setActionError('Could not save queue action. Please retry.');
    } finally {
      setBusyQueueId(null);
      setLastRefresh(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }));
    }
  }

  const TABS: ServiceTab[] = ['OPD', 'Lab', 'Pharmacy', 'Triage'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(217,119,6,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
        <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <Volume2 className="h-3.5 w-3.5" />
              Live patient flow
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink md:text-5xl">Live queue</h1>
            <p className="mt-2 text-sm text-slate">Last updated: {lastRefresh || '--:--'} · calling, escalation, and service routing in sync</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-content-border bg-content-bg px-4 py-3 shadow-sm">
              <p className="text-2xl font-semibold text-ink">{activeQueue.length}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate">Total tokens</p>
            </div>
            <div className="rounded-2xl border border-content-border bg-content-bg px-4 py-3 shadow-sm">
              <p className="text-2xl font-semibold text-ink">{urgentCount}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate">Priority</p>
            </div>
            <button
              onClick={() => setLastRefresh(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }))}
              className="flex items-center gap-2 rounded-full border border-content-border bg-content-bg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-content-bg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
            >
              <Volume2 className="w-4 h-4" />
              Call Next Patient
            </button>
          </div>
        </div>
      </div>

      {/* Wait time stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Avg Wait', value: '18 min', icon: <Clock className="w-4 h-4" /> },
          { label: 'Longest Wait', value: '45 min', icon: <AlertTriangle className="w-4 h-4" /> },
          { label: 'Served Today', value: '34', icon: <Users className="w-4 h-4" /> },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 rounded-[1.5rem] border border-content-border bg-content-bg p-4 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{stat.icon}</span>
            <div>
              <p className="text-lg font-bold text-ink">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Service Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={cn(
              'px-4 py-2 rounded-card text-sm font-medium transition-all',
              activeTab === tab
                ? 'text-white font-semibold bg-primary'
                : 'text-slate-600 border border-content-border bg-content-bg hover:bg-slate-100',
            )}
          >
            {tab}
              <span
                className={cn(
                  'ml-2 px-1.5 py-0.5 rounded-full text-xs',
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-content-surface text-slate-600',
                )}
              >
              {(queueRows.length > 0 ? queueRows : QUEUE).filter((row) => row.service === tab).length || TAB_COUNTS[tab]}
            </span>
          </button>
        ))}
      </div>
      {actionError && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {actionError}
        </div>
      )}

      {/* Queue Board */}
      <div className="space-y-3">
        {displayQueue.map((patient) => {
          const status = getStatus(patient);
          return (
            <div
              key={patient.token}
              className={cn(
                'bg-content-bg border rounded-card p-4 flex items-center gap-4 transition-all shadow-card',
                status === 'Done' ? 'opacity-60 border-content-border/50' : 'border-content-border hover:border-content-border',
              )}
            >
              {/* Token */}
              <div
                className="w-14 h-14 rounded-card flex items-center justify-center font-mono font-bold text-lg flex-shrink-0 bg-primary/10 text-primary"
              >
                {patient.token}
              </div>

              {/* Patient Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-ink font-semibold">{patient.name}</p>
                  <span className="text-slate-500 text-xs">{patient.ageSex}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_STYLES[patient.priority])}>
                    {patient.priority}
                  </span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[status])}>
                    {status}
                  </span>
                  <span className="text-slate-500 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {patient.wait}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    callPatient(patient.token);
                    void persistAction(patient.queueId, 'call');
                  }}
                  disabled={busyQueueId === patient.queueId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-content-surface text-slate-700 hover:text-ink hover:bg-content-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  aria-label={`Call token ${patient.token}`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Call
                </button>
                <button className="p-1.5 rounded-lg hover:bg-content-surface text-slate-500 hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35" aria-label={`View details for ${patient.name}`}>
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    markDone(patient.token);
                    void persistAction(patient.queueId, 'done');
                  }}
                  disabled={busyQueueId === patient.queueId}
                  className="p-1.5 rounded-lg hover:bg-success/10 text-slate-500 hover:text-success transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/35"
                  aria-label={`Mark token ${patient.token} as done`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    escalate(patient.token);
                    void persistAction(patient.queueId, 'escalate');
                  }}
                  disabled={busyQueueId === patient.queueId}
                  className="p-1.5 rounded-lg hover:bg-danger/10 text-slate-500 hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35"
                  aria-label={`Escalate token ${patient.token}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Suggestion */}
      <div className="rounded-card p-4 border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">AI Queue Recommendation</p>
            <p className="text-sm text-slate-600 mt-1">
              AI recommends redirecting 3 Pharmacy patients to OPD — estimated wait reduction: 12 min.
              Queue peak expected at 2:00 PM. Consider opening an additional service counter.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
