'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, AlertTriangle, CheckCircle, Eye, X, Search,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

type OrderTab = 'Pending Results' | 'My Orders' | 'Referrals';

interface PendingResult {
  id: string;
  patient: string;
  test: string;
  ordered: string;
  resulted: string;
  summary: string;
  flag: 'CRITICAL' | 'HIGH' | 'LOW' | 'NORMAL';
}

interface MyOrder {
  id: string;
  patient: string;
  test: string;
  priority: 'STAT' | 'Urgent' | 'Routine';
  orderedAt: string;
  status: 'Pending' | 'Processing' | 'Completed';
}

interface Referral {
  direction: 'outgoing' | 'incoming';
  patient: string;
  from: string;
  to: string;
  reason: string;
  urgency: 'Urgent' | 'Routine' | 'STAT';
  date: string;
}


const flagStyles: Record<PendingResult['flag'], string> = {
  CRITICAL: 'bg-danger/5 text-danger border border-danger/20',
  HIGH:     'bg-warning/5 text-warning border border-warning/20',
  LOW:      'bg-info/5 text-info border border-info/20',
  NORMAL:   'bg-success/5 text-success border border-success/20',
};

const priorityStyles: Record<MyOrder['priority'], string> = {
  STAT:    'bg-danger/5 text-danger border border-danger/20',
  Urgent:  'bg-warning/5 text-warning border border-warning/20',
  Routine: 'bg-slate-100 text-slate-700 border border-content-border',
};

const orderStatusStyles: Record<MyOrder['status'], string> = {
  Pending:    'bg-warning/5 text-warning border border-warning/20',
  Processing: 'bg-info/5 text-info border border-info/20',
  Completed:  'bg-success/5 text-success border border-success/20',
};

const urgencyStyle = (u: Referral['urgency']): string => {
  switch (u) {
    case 'STAT':    return 'bg-danger/5 text-danger border border-danger/20';
    case 'Urgent':  return 'bg-warning/5 text-warning border border-warning/20';
    case 'Routine': return 'bg-slate-100 text-slate-700 border border-content-border';
  }
};

type OrdersApiPayload = {
  pendingResults?: PendingResult[];
  myOrders?: MyOrder[];
  referrals?: Referral[];
  error?: string;
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderTab>('Pending Results');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [orderType, setOrderType] = useState<string>('Lab');
  const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ackBusyId, setAckBusyId] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [patientQuery, setPatientQuery] = useState('Hassan Ali');
  const [testName, setTestName] = useState('');
  const [orderPriority, setOrderPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/medical/orders', { cache: 'no-store', credentials: 'same-origin' });
      const data = (await response.json()) as OrdersApiPayload;
      if (!response.ok) {
        setLoadError(typeof data.error === 'string' ? data.error : 'Unable to load orders.');
        return;
      }
      setPendingResults(Array.isArray(data.pendingResults) ? data.pendingResults : []);
      setMyOrders(Array.isArray(data.myOrders) ? data.myOrders : []);
      setReferrals(Array.isArray(data.referrals) ? data.referrals : []);
    } catch {
      setLoadError('Network error while loading orders. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const tabList = useMemo(
    () => [
      { label: 'Pending Results' as const, badge: pendingResults.length },
      { label: 'My Orders' as const },
      { label: 'Referrals' as const, badge: referrals.filter((r) => r.direction === 'incoming').length },
    ],
    [pendingResults.length, referrals],
  );

  async function handleAcknowledge(labRequestId: string): Promise<void> {
    setAckBusyId(labRequestId);
    setAckError(null);
    try {
      const response = await fetch('/api/medical/orders/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labRequestId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setAckError(typeof data.error === 'string' ? data.error : 'Could not acknowledge this result.');
        return;
      }
      await loadOrders({ silent: true });
    } catch {
      setAckError('Network error while acknowledging. Please retry.');
    } finally {
      setAckBusyId(null);
    }
  }

  async function handleSubmitOrder(): Promise<void> {
    setSubmitError(null);
    if (orderType !== 'Lab') {
      setSubmitError('This quick action currently submits lab draw requests only.');
      return;
    }
    if (!testName.trim()) {
      setSubmitError('Specific test is required.');
      return;
    }

    setSubmitBusy(true);
    try {
      const response = await fetch('/api/medical/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientQuery: patientQuery.trim(),
          testName: testName.trim(),
          priority: orderPriority,
          notes: clinicalNotes.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSubmitError(data.error ?? 'Unable to submit lab request.');
        return;
      }

      setShowModal(false);
      setTestName('');
      setClinicalNotes('');
      setOrderPriority('routine');
      await loadOrders({ silent: true });
    } catch {
      setSubmitError('Network error while submitting order.');
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">Orders &amp; Results</h1>
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Updating…
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-portal-primary hover:bg-portal-primary-hover text-white text-sm font-medium transition-colors w-fit"
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-content-bg border border-danger/20 text-danger text-xs font-medium hover:bg-danger/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {ackError && (
        <div role="alert" className="rounded-card border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>{ackError}</span>
        </div>
      )}

      {submitError && (
        <div role="alert" className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>{submitError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-content-border overflow-x-auto">
        {tabList.map(({ label, badge }) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            className={cn(
              'px-5 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors',
              activeTab === label
                ? 'text-portal-primary border-b-2 border-portal-primary'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {label}
            {badge !== undefined && (
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', activeTab === label ? 'bg-portal-primary-light/25 text-portal-primary' : 'bg-content-surface text-slate-600')}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Results */}
      {activeTab === 'Pending Results' && (
        <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-portal-primary" aria-hidden />
              <p className="text-sm">Loading pending results…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-content-border bg-content-surface">
                    {['Patient', 'Test', 'Ordered', 'Resulted', 'Summary', 'Flag', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                        No pending lab results to review. Completed tests with entered results will appear here until you acknowledge them.
                      </td>
                    </tr>
                  ) : (
                    pendingResults.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-b border-content-border/50 transition-colors',
                          r.flag === 'CRITICAL' ? 'bg-danger/5 hover:bg-danger/10' : 'hover:bg-content-surface'
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {r.flag === 'CRITICAL' && <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" aria-hidden />}
                            {r.patient}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.test}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.ordered}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.resulted}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={r.summary}>{r.summary}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', flagStyles[r.flag])}>{r.flag}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-xs text-portal-primary hover:text-portal-primary-hover flex items-center gap-1">
                              <Eye className="w-3 h-3" aria-hidden /> Review
                            </button>
                            <button
                              type="button"
                              disabled={ackBusyId === r.id}
                              onClick={() => void handleAcknowledge(r.id)}
                              className="text-xs text-slate-600 hover:text-ink flex items-center gap-1 disabled:opacity-50"
                            >
                              {ackBusyId === r.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                              ) : (
                                <CheckCircle className="w-3 h-3" aria-hidden />
                              )}
                              Ack
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* My Orders */}
      {activeTab === 'My Orders' && (
        <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-portal-primary" aria-hidden />
              <p className="text-sm">Loading your orders…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-content-border bg-content-surface">
                    {['Patient', 'Test / Study', 'Priority', 'Ordered At', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                        No lab orders found for your account in this hospital. New orders you place will appear here.
                      </td>
                    </tr>
                  ) : (
                    myOrders.map((o) => (
                      <tr key={o.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                        <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{o.patient}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{o.test}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityStyles[o.priority])}>{o.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{o.orderedAt}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', orderStatusStyles[o.status])}>{o.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button type="button" className="text-xs text-portal-primary hover:text-portal-primary-hover flex items-center gap-1">
                            <Eye className="w-3 h-3" aria-hidden /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Referrals */}
      {activeTab === 'Referrals' && (
        <div className="space-y-3">
          {referrals.map((r, i) => (
            <div
              key={i}
              className={cn(
                'rounded-card border p-4',
                r.direction === 'outgoing'
                  ? 'bg-success/5 border-success/20'
                  : 'bg-info/5 border-info/20'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      r.direction === 'outgoing' ? 'bg-success/5 text-success border border-success/20' : 'bg-info/5 text-info border border-info/20'
                    )}>
                      {r.direction === 'outgoing' ? '↗ Outgoing' : '↙ Incoming'}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', urgencyStyle(r.urgency))}>{r.urgency}</span>
                  </div>
                  <p className="text-sm font-semibold text-ink">{r.patient}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.from} → {r.to}</p>
                  <p className="text-sm text-slate-700 mt-2">{r.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{r.date}</p>
                  <button type="button" className="mt-2 text-xs text-portal-primary hover:text-portal-primary-hover">View Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Order Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-content-bg border border-content-border overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-content-border">
              <h2 className="text-base font-bold text-ink">New Order</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-800" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Patient</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                  <input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-content-bg border border-content-border text-ink text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Order Type</label>
                <div className="flex gap-2">
                  {['Lab', 'Imaging', 'Referral', 'Procedure'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrderType(t)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        orderType === t
                          ? 'bg-portal-primary text-white'
                          : 'bg-content-bg border border-content-border text-slate-600 hover:text-ink hover:bg-slate-100'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Specific Test</label>
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder={orderType === 'Lab' ? 'e.g. CBC, LFT, RFT...' : 'e.g. Chest X-Ray PA...'}
                  className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Priority</label>
                <select
                  value={orderPriority}
                  onChange={(e) => setOrderPriority(e.target.value as 'routine' | 'urgent' | 'stat')}
                  className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Clinical Notes</label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Clinical indication, relevant history..."
                  className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-content-border text-slate-700 text-sm hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitOrder()}
                  disabled={submitBusy}
                  className="flex-1 py-2 rounded-lg bg-portal-primary hover:bg-portal-primary-hover text-white text-sm font-medium transition-colors"
                >
                  {submitBusy ? 'Submitting...' : 'Submit Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
