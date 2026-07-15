'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle2, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientDetailPanel, type PatientDetail } from '@/components/portal/PatientDetailPanel';

type QueuePriority = 'Urgent' | 'High' | 'Normal' | 'Low';

interface QueueItem {
  queueId: string;
  token: string;
  patient: string;
  age: number | null;
  complaint: string;
  checkinTime: string;
  waitMinutes: number;
  priority: QueuePriority;
  status: string;
  vitals?: {
    temp: string;
    bp: string;
    pulse: string;
    spo2: string;
  };
}

type QueueApiPayload = {
  items?: QueueItem[];
  error?: string;
};

function PriorityBadge({ priority }: { priority: QueuePriority }) {
  const colors = {
    Urgent: 'bg-danger/5 text-danger border border-danger/20',
    High: 'bg-warning/5 text-warning border border-warning/20',
    Normal: 'bg-primary/5 text-primary border border-primary/20',
    Low: 'bg-slate-100 text-slate-700 border border-content-border',
  };
  return <span className={cn('text-xs px-2 py-1 rounded-full font-medium', colors[priority])}>{priority}</span>;
}

export default function MedicalQueuePage() {
  const [queueData, setQueueData] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyQueueId, setBusyQueueId] = useState<string | null>(null);
  const [calledFlash, setCalledFlash] = useState<Set<string>>(new Set());
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/medical/queue', { cache: 'no-store', credentials: 'same-origin' });
      const payload = (await res.json()) as QueueApiPayload;
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : `Could not load queue (${res.status})`);
      }
      if (!Array.isArray(payload.items)) {
        throw new Error('Unexpected response from server.');
      }
      setQueueData(payload.items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load queue.');
      setQueueData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!actionSuccess) return;
    const t = window.setTimeout(() => setActionSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [actionSuccess]);

  const handleCall = async (queueId: string) => {
    if (busyQueueId) return;
    setActionError(null);
    setBusyQueueId(queueId);
    try {
      const res = await fetch('/api/medical/queue/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ queueId, action: 'call' }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${res.status})`);
      }
      setActionSuccess('Patient called and marked in consultation.');
      setCalledFlash((prev) => {
        const next = new Set(prev);
        next.add(queueId);
        return next;
      });
      window.setTimeout(() => {
        setCalledFlash((prev) => {
          const next = new Set(prev);
          next.delete(queueId);
          return next;
        });
      }, 3000);
      await loadQueue();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not call patient.');
    } finally {
      setBusyQueueId(null);
    }
  };

  const handleViewDetails = (item: QueueItem) => {
    const detailed: PatientDetail = {
      id: item.queueId,
      name: item.patient,
      patient_id: item.token,
      age: item.age ?? 0,
      gender: '',
      phone: '',
      national_id: '',
      blood_type: '',
      insurance: '',
      SHIF_no: '',
      emergency_contact: '',
      emergency_phone: '',
      allergies: [],
      medications: [],
      recent_records: [],
      conditions: [],
      vitals: {
        temp: item.vitals?.temp || '',
        bp: item.vitals?.bp || '',
        pulse: item.vitals?.pulse ? parseInt(item.vitals.pulse, 10) || 0 : 0,
        spo2: item.vitals?.spo2 ? parseInt(item.vitals.spo2.replace('%', ''), 10) || 0 : 0,
        rr: 0,
        weight: '',
      },
    };
    setSelectedPatient(detailed);
    setPanelOpen(true);
  };

  const inConsultation = (item: QueueItem) => item.status === 'in_progress';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Medical Queue</h1>
          <p className="text-sm text-slate-600">Real-time patient visitation queue</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-2 rounded-lg bg-warning/5 border border-warning/20 text-sm">
            <span className="font-semibold text-ink">{loading ? '…' : queueData.length}</span>
            <span className="text-slate-600 ml-1">in queue</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-content-border bg-content-bg px-4 py-6 flex items-center gap-3 text-slate-600 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden />
          <span>Loading queue from your facility…</span>
        </div>
      )}

      {loadError && !loading && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex flex-wrap items-center justify-between gap-2">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="text-xs font-semibold text-danger underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success flex items-center justify-between gap-2">
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-xs font-medium shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning flex flex-wrap items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-semibold text-warning underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!loading && !loadError && queueData.length === 0 && (
        <div className="rounded-card border border-content-border bg-content-bg p-8 text-center text-slate-600 text-sm">
          No patients are waiting in the OPD/Triage queue for your facility.
        </div>
      )}

      {/* Queue List */}
      {!loading && !loadError && queueData.length > 0 && (
        <div className="space-y-3">
          {queueData.map((item, idx) => {
            const showCalled = calledFlash.has(item.queueId) || inConsultation(item);
            const callDisabled = inConsultation(item) || busyQueueId === item.queueId;
            return (
              <div
                key={item.queueId}
                className="rounded-card border border-content-border bg-content-bg p-4 hover:shadow-md transition-shadow"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-ink">{item.token}</span>
                      <span className="text-sm text-slate-500">Position {idx + 1}</span>
                    </div>
                    <h3 className="font-semibold text-ink mt-2">{item.patient}</h3>
                    <p className="text-sm text-slate-600">
                      {item.age != null ? `${item.age}y` : '—'} • {item.complaint}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Checked in {item.checkinTime}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-4 h-4 text-warning" />
                      <span className="text-sm text-slate-600">Wait: {item.waitMinutes} min</span>
                    </div>
                  </div>

                  {item.vitals && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Vitals</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-600">Temp:</span>
                          <p className="font-semibold text-ink">{item.vitals.temp}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">BP:</span>
                          <p className="font-semibold text-ink">{item.vitals.bp}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">Pulse:</span>
                          <p className="font-semibold text-ink">{item.vitals.pulse}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">SpO₂:</span>
                          <p className="font-semibold text-ink">{item.vitals.spo2}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-stretch gap-2 justify-center">
                    <PriorityBadge priority={item.priority} />
                    <button
                      type="button"
                      onClick={() => void handleCall(item.queueId)}
                      disabled={callDisabled}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
                        showCalled
                          ? 'bg-success text-white'
                          : 'bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:pointer-events-none',
                      )}
                    >
                      {busyQueueId === item.queueId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Calling…
                        </>
                      ) : showCalled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          {inConsultation(item) ? 'In consultation' : 'Called!'}
                        </>
                      ) : (
                        <>
                          <PhoneOff className="w-4 h-4" />
                          Call Patient
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewDetails(item)}
                      className="px-4 py-2 rounded-lg font-medium text-sm bg-slate-100 text-ink hover:bg-slate-200 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PatientDetailPanel patient={selectedPatient} open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
