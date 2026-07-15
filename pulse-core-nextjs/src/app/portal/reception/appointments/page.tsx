'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UserPlus,
  Search,
  Phone,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  XCircle,
} from 'lucide-react';

type AppStatus = 'Confirmed' | 'Walk-In' | 'Cancelled' | 'Arrived' | 'No Show';

type PatchAction = 'check_in' | 'cancel' | 'reschedule';

interface Appointment {
  id: string;
  time: string;
  patient: string;
  phone: string;
  type: string;
  doctor: string;
  status: AppStatus;
}

interface ListPayload {
  date: string;
  timezone: string;
  appointments: Appointment[];
}

interface ActionBanner {
  tone: 'error' | 'success';
  action: PatchAction;
  message: string;
}

const STATUS_STYLE: Record<AppStatus, string> = {
  Arrived: 'bg-success/5 text-success border-success/20',
  Confirmed: 'bg-primary/5 text-primary border-primary/20',
  'Walk-In': 'bg-warning/5 text-warning border-warning/20',
  Cancelled: 'bg-slate-100 text-slate-400 border-content-border',
  'No Show': 'bg-danger/5 text-danger border-danger/20',
};

function statusPillClass(status: string): string {
  return STATUS_STYLE[status as AppStatus] ?? 'bg-slate-100 text-slate-700 border-content-border';
}

function actionLabel(a: PatchAction): string {
  switch (a) {
    case 'check_in':
      return 'Check-in';
    case 'cancel':
      return 'Cancellation';
    case 'reschedule':
      return 'Reschedule';
    default:
      return 'Update';
  }
}

/** Convert display time like "14:30" or "2:30 pm" to HH:mm for input[type=time] when possible. */
function toTimeInputValue(display: string): string {
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(display.trim());
  if (m24) {
    const h = Number(m24[1]);
    const min = m24[2];
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${min}`;
  }
  return '09:00';
}

export default function AppointmentsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AppStatus | 'All'>('All');
  const [rows, setRows] = useState<Appointment[]>([]);
  const [meta, setMeta] = useState<{ date: string; timezone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<ActionBanner | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: PatchAction } | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const actionRetryRef = useRef<(() => Promise<void>) | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/reception/appointments', { credentials: 'same-origin' });
      const data = (await response.json().catch(() => null)) as ListPayload | { error?: string } | null;
      if (!response.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Could not load appointments (${response.status}).`;
        throw new Error(msg);
      }
      if (!data || !('appointments' in data) || !Array.isArray(data.appointments)) {
        throw new Error('Unexpected response from server.');
      }
      setRows(data.appointments);
      setMeta({ date: data.date, timezone: data.timezone });
    } catch (e) {
      setRows([]);
      setMeta(null);
      setLoadError(e instanceof Error ? e.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const confirmed = rows.filter((a) => a.status === 'Confirmed').length;
  const walkins = rows.filter((a) => a.status === 'Walk-In').length;
  const arrived = rows.filter((a) => a.status === 'Arrived').length;
  const noShows = rows.filter((a) => a.status === 'No Show').length;

  const filtered = rows.filter((a) => {
    const matchSearch =
      !search ||
      a.patient.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || a.status === filter;
    return matchSearch && matchFilter;
  });

  const openReschedule = (a: Appointment) => {
    setActionBanner(null);
    setRescheduleFor(a.id);
    setRescheduleDate(meta?.date ?? '');
    setRescheduleTime(toTimeInputValue(a.time));
  };

  const patchAppointment = useCallback(
    async (appointmentId: string, body: Record<string, unknown>, patchAction: PatchAction) => {
      actionRetryRef.current = null;
      setActionBanner(null);
      setBusy({ id: appointmentId, action: patchAction });
      const run = async () => {
        setActionBanner(null);
        setBusy({ id: appointmentId, action: patchAction });
        try {
          const response = await fetch('/api/reception/appointments', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          const resBody = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
          if (!response.ok) {
            throw new Error(resBody?.error ?? `Request failed (${response.status}).`);
          }
          actionRetryRef.current = null;
          setActionBanner({
            tone: 'success',
            action: patchAction,
            message:
              patchAction === 'cancel'
                ? 'Appointment cancelled.'
                : patchAction === 'reschedule'
                  ? 'Appointment rescheduled.'
                  : 'Patient checked in.',
          });
          if (patchAction === 'reschedule') {
            setRescheduleFor(null);
          }
          await loadAppointments();
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Update failed.';
          setActionBanner({ tone: 'error', action: patchAction, message });
          actionRetryRef.current = run;
        } finally {
          setBusy(null);
        }
      };
      await run();
    },
    [loadAppointments],
  );

  async function checkIn(appointmentId: string) {
    await patchAppointment(appointmentId, { appointmentId }, 'check_in');
  }

  async function cancelAppointment(appointmentId: string) {
    await patchAppointment(appointmentId, { action: 'cancel', appointmentId }, 'cancel');
  }

  async function submitReschedule(appointmentId: string) {
    if (!rescheduleDate || !rescheduleTime) {
      setActionBanner({
        tone: 'error',
        action: 'reschedule',
        message: 'Choose a date and time for the new slot.',
      });
      return;
    }
    await patchAppointment(
      appointmentId,
      {
        action: 'reschedule',
        appointmentId,
        newDate: rescheduleDate,
        newTime: rescheduleTime,
      },
      'reschedule',
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Appointments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Today&apos;s schedule — walk-ins and booked visits
            {meta ? (
              <span className="block text-xs text-slate-400 mt-0.5">
                Showing {meta.date} ({meta.timezone})
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAppointments()}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 px-3 py-2 rounded-card border border-content-border bg-content-bg hover:bg-content-surface disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-white px-3 py-2 rounded-card bg-primary"
          >
            <UserPlus className="w-4 h-4" /> Register Walk-In
          </button>
        </div>
      </div>

      {loadError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Could not load the schedule</p>
              <p className="text-warning mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadAppointments()}
            className="shrink-0 text-sm font-semibold text-warning underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {actionBanner && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-card border px-4 py-3 text-sm ${
            actionBanner.tone === 'error'
              ? 'border-danger/20 bg-danger/5 text-danger'
              : 'border-success/20 bg-success/5 text-success'
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            {actionBanner.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-success" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">
                {actionBanner.tone === 'error'
                  ? `${actionLabel(actionBanner.action)} did not complete`
                  : `${actionLabel(actionBanner.action)} saved`}
              </p>
              <p
                className={`mt-0.5 ${
                  actionBanner.tone === 'error' ? 'text-danger' : 'text-success'
                }`}
              >
                {actionBanner.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {actionBanner.tone === 'error' && actionRetryRef.current ? (
              <button
                type="button"
                onClick={() => void actionRetryRef.current?.()}
                className="text-sm font-semibold text-danger underline-offset-2 hover:underline"
              >
                Try again
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setActionBanner(null);
                actionRetryRef.current = null;
              }}
              className={`text-sm font-semibold underline-offset-2 hover:underline ${
                actionBanner.tone === 'error' ? 'text-danger' : 'text-success'
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Arrived', value: arrived, colorClass: 'text-success' },
          { label: 'Confirmed', value: confirmed, colorClass: 'text-primary' },
          { label: 'Walk-Ins', value: walkins, colorClass: 'text-warning' },
          { label: 'No Shows', value: noShows, colorClass: 'text-danger' },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.colorClass}`}>
              {loading ? '—' : k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, clinician, or type…"
            aria-label="Search appointments"
            className="w-full pl-9 pr-3 py-2 text-sm border border-content-border rounded-card bg-content-bg focus:outline-none"
            disabled={loading && rows.length === 0}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['All', 'Arrived', 'Confirmed', 'Walk-In', 'No Show', 'Cancelled'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                filter === s
                  ? 'text-white border-transparent bg-primary'
                  : 'bg-content-bg text-slate-600 border-content-border hover:bg-content-surface'
              }`}
              
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments table */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto relative">
        {loading && rows.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-content-bg/80 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden />
            <p className="text-sm text-slate-600">Loading today&apos;s appointments…</p>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 bg-content-surface border-b border-content-border/50">
              {['Time', 'Patient', 'Phone', 'Clinic / Type', 'Clinician', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-content-border/50 hover:bg-content-surface align-top">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-slate-700 text-xs">{a.time}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-medium text-ink">{a.patient}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    {a.phone !== '—' && <Phone className="w-3 h-3" />}
                    {a.phone}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {a.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">{a.doctor}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusPillClass(a.status)}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 min-w-[200px]">
                  {(a.status === 'Confirmed' || a.status === 'Walk-In') && (
                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {a.status === 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => void checkIn(a.id)}
                            disabled={busy?.id === a.id}
                            className="text-xs font-medium flex items-center gap-1 text-white bg-success px-2 py-0.5 rounded-lg disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/35"
                          >
                            {busy?.id === a.id && busy.action === 'check_in' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Check In
                          </button>
                        )}
                        {a.status === 'Walk-In' && (
                          <button
                            type="button"
                            className="text-xs font-medium flex items-center gap-1 text-white bg-primary px-2 py-0.5 rounded-lg"
                          >
                            <UserPlus className="w-3 h-3" /> Register
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void cancelAppointment(a.id)}
                          disabled={busy?.id === a.id}
                          className="text-xs font-medium flex items-center gap-1 text-danger px-2 py-0.5 rounded-lg border border-danger/20 bg-danger/5 hover:bg-danger/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35"
                        >
                          {busy?.id === a.id && busy.action === 'cancel' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => openReschedule(a)}
                          disabled={busy?.id === a.id}
                          className="text-xs font-medium flex items-center gap-1 text-slate-700 px-2 py-0.5 rounded-lg border border-content-border bg-content-bg hover:bg-content-surface disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Calendar className="w-3 h-3" />
                          Reschedule
                        </button>
                      </div>
                      {rescheduleFor === a.id && (
                        <div className="w-full max-w-xs rounded-card border border-content-border bg-content-surface p-2 space-y-2">
                          <p className="text-[11px] text-slate-600 text-left w-full">New slot ({meta?.timezone ?? 'local'})</p>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="date"
                              value={rescheduleDate}
                              onChange={(e) => setRescheduleDate(e.target.value)}
                              className="text-xs border border-content-border rounded-lg px-2 py-1 bg-content-bg"
                            />
                            <input
                              type="time"
                              value={rescheduleTime}
                              onChange={(e) => setRescheduleTime(e.target.value)}
                              className="text-xs border border-content-border rounded-lg px-2 py-1 bg-content-bg"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              className="text-xs text-slate-600 px-2 py-1"
                              onClick={() => setRescheduleFor(null)}
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-white bg-primary px-2 py-1 rounded-lg disabled:opacity-60"
                              disabled={busy?.id === a.id}
                              onClick={() => void submitReschedule(a.id)}
                            >
                              {busy?.id === a.id && busy.action === 'reschedule' ? (
                                <span className="inline-flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                                </span>
                              ) : (
                                'Save new time'
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !loadError && filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            No appointments for this day. Adjust filters or refresh after new bookings are added.
          </p>
        )}
        {!loading && loadError && rows.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">Schedule unavailable until connection is restored.</p>
        )}
      </div>
    </div>
  );
}
