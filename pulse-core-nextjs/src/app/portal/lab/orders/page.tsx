'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Search, X, FlaskConical, ClipboardCheck, CheckCircle, Clock, Droplets, PlayCircle, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'Pending' | 'Collected' | 'Processing' | 'Completed';
type Priority = 'Routine' | 'Urgent' | 'STAT';
type Status = 'Pending' | 'Collected' | 'Processing' | 'Completed';

interface LabOrder {
  /** Row id (UUID when loaded from API) */
  id: string;
  /** Human-readable lab request id (e.g. LAB-3011) */
  labCode: string;
  patient: string;
  pid: string;
  tests: string[];
  sampleType: string;
  requestedBy: string;
  priority: Priority;
  orderedAt: string;
  status: Status;
  collectedAt?: string;
  processedAt?: string;
  completedAt?: string;
  collectorInitials?: string;
  results?: Record<string, string>;
}

/** Offline / error fallback — not persisted (actions disabled) */
const FALLBACK_ORDERS: LabOrder[] = [
  { id: 'demo-lab-3011', labCode: 'LAB-3011', patient: 'Peter Kamau', pid: 'PID-11236', tests: ['CBC', 'CRP'], sampleType: 'EDTA Blood', requestedBy: 'Dr. Amina', priority: 'STAT', orderedAt: '08:31', status: 'Processing', collectedAt: '08:45', processedAt: '09:10' },
  { id: 'demo-lab-3012', labCode: 'LAB-3012', patient: 'Grace Abuya', pid: 'PID-11237', tests: ['LFT Panel'], sampleType: 'Serum', requestedBy: 'Dr. James', priority: 'Routine', orderedAt: '08:45', status: 'Completed', collectedAt: '09:00', processedAt: '09:45', completedAt: '11:30', results: { 'ALT': '28 U/L', 'AST': '35 U/L', 'ALP': '89 U/L', 'Bilirubin': '0.8 mg/dL' } },
  { id: 'demo-lab-3013', labCode: 'LAB-3013', patient: 'Daniel Muthoni', pid: 'PID-11240', tests: ['FS', 'TSH'], sampleType: 'Serum', requestedBy: 'Dr. Otieno', priority: 'Urgent', orderedAt: '09:05', status: 'Collected', collectedAt: '09:20' },
  { id: 'demo-lab-3014', labCode: 'LAB-3014', patient: 'Hassan Ali', pid: 'PID-11234', tests: ['Troponin I', 'CK-MB'], sampleType: 'Serum', requestedBy: 'Dr. Amina', priority: 'STAT', orderedAt: '09:15', status: 'Pending' },
  { id: 'demo-lab-3015', labCode: 'LAB-3015', patient: 'Fatuma Wanjiru', pid: 'PID-11235', tests: ['Iron Studies'], sampleType: 'Serum', requestedBy: 'Dr. Amina', priority: 'Urgent', orderedAt: '09:30', status: 'Pending' },
  { id: 'demo-lab-3016', labCode: 'LAB-3016', patient: 'James Kiprotich', pid: 'PID-11238', tests: ['U&E', 'Creatinine'], sampleType: 'Urine', requestedBy: 'Dr. Mwangi', priority: 'Routine', orderedAt: '09:45', status: 'Completed', collectedAt: '10:00', processedAt: '10:30', completedAt: '14:00', results: { 'Creatinine': '1.1 mg/dL', 'BUN': '15 mg/dL', 'eGFR': '92 mL/min' } },
  { id: 'demo-lab-3017', labCode: 'LAB-3017', patient: 'Sarah Otieno', pid: 'PID-11239', tests: ['Malaria RDT'], sampleType: 'Capillary', requestedBy: 'Dr. Kamau', priority: 'Routine', orderedAt: '10:00', status: 'Processing', collectedAt: '10:15', processedAt: '10:20' },
  { id: 'demo-lab-3018', labCode: 'LAB-3018', patient: 'Mohammed Odhiambo', pid: 'PID-11241', tests: ['Blood Group'], sampleType: 'EDTA Blood', requestedBy: 'Dr. Amina', priority: 'Routine', orderedAt: '10:15', status: 'Pending' },
  { id: 'demo-lab-3019', labCode: 'LAB-3019', patient: 'Amina Keita', pid: 'PID-11242', tests: ['HbA1c'], sampleType: 'EDTA Blood', requestedBy: 'Dr. Otieno', priority: 'Urgent', orderedAt: '10:30', status: 'Collected', collectedAt: '10:45' },
  { id: 'demo-lab-3020', labCode: 'LAB-3020', patient: 'Robert Maina', pid: 'PID-11243', tests: ['Lipid Profile'], sampleType: 'Serum', requestedBy: 'Dr. James', priority: 'Routine', orderedAt: '10:45', status: 'Pending' },
];

const priorityStyles: Record<Priority, string> = {
  Routine: 'bg-slate-100 text-slate-600 border border-content-border',
  Urgent: 'bg-warning/5 text-warning border border-warning/20',
  STAT: 'bg-danger/5 text-danger border border-danger/20',
};

const statusStyles: Record<Status, string> = {
  Pending: 'bg-warning/5 text-warning border border-warning/20',
  Collected: 'bg-primary/5 text-primary border border-primary/20',
  Processing: 'bg-violet-100 text-violet-600 border border-violet-200',
  Completed: 'bg-success/5 text-success border border-success/20',
};

interface CollectModalProps {
  order: LabOrder | null;
  onClose: () => void;
  onConfirm: (orderId: string, initials: string, notes: string) => void;
  disableSubmit?: boolean;
}

function CollectModal({ order, onClose, onConfirm, disableSubmit }: CollectModalProps): React.ReactElement {
  const [initials, setInitials] = useState('');
  const [notes, setNotes] = useState('');
  const [sampleCondition, setSampleCondition] = useState('Good');

  if (!order) return <></>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Collect sample details" className="relative w-full max-w-md overflow-hidden rounded-card border border-content-border bg-content-bg shadow-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-content-surface">
          <h3 className="font-semibold text-ink">Collect Sample</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-content-surface border border-content-border">
            <p className="text-xs text-slate-500">Order</p>
            <p className="font-mono text-sm text-violet-600">{order.labCode}</p>
            <p className="text-sm font-medium text-ink mt-1">{order.patient}</p>
            <p className="text-xs text-slate-500">{order.sampleType}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sample Condition</label>
            <div className="flex gap-2">
              {['Good', 'Hemolyzed', 'Clotted', 'Insufficient'].map((cond) => (
                <button
                  key={cond}
                  onClick={() => setSampleCondition(cond)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs border',
                    sampleCondition === cond
                      ? 'bg-violet-100 border-violet-300 text-violet-700'
                      : 'bg-content-bg border-content-border text-slate-600 hover:border-violet-200'
                  )}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Collector Initials</label>
            <input
              type="text"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              placeholder="e.g. JK"
              className="w-full px-3 py-2 rounded-lg border border-content-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              maxLength={3}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-content-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-content-border bg-content-surface">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-content-border text-slate-600 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => {
              const cond =
                sampleCondition !== 'Good' ? `Sample condition: ${sampleCondition}` : '';
              const combined = [cond, notes.trim()].filter(Boolean).join(' · ');
              onConfirm(order.id, initials, combined);
            }}
            disabled={!initials.trim() || disableSubmit}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Collection
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProcessModalProps {
  order: LabOrder | null;
  onClose: () => void;
  onConfirm: (orderId: string, results: Record<string, string>) => void;
  disableSubmit?: boolean;
}

function ProcessModal({ order, onClose, onConfirm, disableSubmit }: ProcessModalProps): React.ReactElement {
  const [results, setResults] = useState<Record<string, string>>({});

  if (!order) return <></>;

  const handleResultChange = (test: string, value: string) => {
    setResults((prev) => ({ ...prev, [test]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Process lab results" className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-content-border bg-content-bg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-violet-50">
          <h3 className="font-semibold text-ink">Process Results</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-content-surface border border-content-border">
            <p className="font-mono text-sm text-violet-600">{order.labCode}</p>
            <p className="text-sm font-medium text-ink">{order.patient}</p>
            <p className="text-xs text-slate-500">{order.tests.join(', ')}</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-600">Test Results</p>
            {order.tests.map((test) => (
              <div key={test}>
                <label className="block text-xs text-slate-500 mb-1">{test}</label>
                <input
                  type="text"
                  value={results[test] || ''}
                  onChange={(e) => handleResultChange(test, e.target.value)}
                  placeholder="Enter result..."
                  className="w-full px-3 py-2 rounded-lg border border-content-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-content-border bg-content-surface">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-content-border text-slate-600 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(order.id, results)}
            disabled={disableSubmit}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Results
          </button>
        </div>
      </div>
    </div>
  );
}

interface ViewResultsModalProps {
  order: LabOrder | null;
  onClose: () => void;
  onVerify: (orderId: string) => void;
  disableSubmit?: boolean;
}

function ViewResultsModal({ order, onClose, onVerify, disableSubmit }: ViewResultsModalProps): React.ReactElement {
  if (!order) return <></>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Lab result details" className="relative w-full max-w-md overflow-hidden rounded-card border border-content-border bg-content-bg shadow-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-success/5">
          <h3 className="font-semibold text-ink">Lab Results</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-content-surface border border-content-border">
            <p className="font-mono text-sm text-violet-600">{order.labCode}</p>
            <p className="text-sm font-medium text-ink">{order.patient}</p>
            <p className="text-xs text-slate-500">{order.tests.join(', ')}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Results</p>
            {order.results && Object.entries(order.results).map(([key, value]) => (
              <div key={key} className="flex justify-between py-2 border-b border-content-border/50">
                <span className="text-sm text-slate-600">{key}</span>
                <span className="text-sm font-medium text-ink">{value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div>Collected: {order.collectedAt}</div>
            <div>Processed: {order.processedAt}</div>
            <div>Completed: {order.completedAt}</div>
            <div>Collector: {order.collectorInitials}</div>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-content-border bg-content-surface">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-content-border text-slate-600 text-sm hover:bg-slate-100">
            Close
          </button>
          <button
            onClick={() => onVerify(order.id)}
            disabled={disableSubmit}
            className="flex-1 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" /> Verify Results
          </button>
        </div>
      </div>
    </div>
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPersistedLabRequest(id: string): boolean {
  return UUID_RE.test(id);
}

export default function LabOrdersPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [collectModalOrder, setCollectModalOrder] = useState<LabOrder | null>(null);
  const [processModalOrder, setProcessModalOrder] = useState<LabOrder | null>(null);
  const [viewResultsModalOrder, setViewResultsModalOrder] = useState<LabOrder | null>(null);

  const loadOrders = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch('/api/lab/orders', { credentials: 'include' });
      const data = (await res.json()) as {
        orders?: LabOrder[];
        error?: string;
      };

      if (!res.ok) {
        const msg = data.error ?? 'Unable to load lab orders.';
        setListError(msg);
        if (res.status === 401 || res.status === 403) {
          setOrders([]);
          setUsingFallback(false);
        } else {
          setOrders(FALLBACK_ORDERS);
          setUsingFallback(true);
        }
        return;
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setUsingFallback(false);
    } catch {
      setListError('Network error while loading lab orders.');
      setOrders(FALLBACK_ORDERS);
      setUsingFallback(true);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const mergeUpdatedOrder = useCallback((updated: LabOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...updated } : o)));
  }, []);

  const patchOrder = async (body: Record<string, unknown>): Promise<LabOrder> => {
    const res = await fetch('/api/lab/orders', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { order?: LabOrder; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? 'Update failed');
    }
    if (!data.order) {
      throw new Error('Invalid server response');
    }
    return data.order;
  };

  const filteredOrders = useMemo(() => {
    const tabStatusMap: Record<Tab, Status> = {
      Pending: 'Pending',
      Collected: 'Collected',
      Processing: 'Processing',
      Completed: 'Completed',
    };
    const targetStatus = tabStatusMap[activeTab];
    const q = searchQuery.toLowerCase();
    return orders.filter((order) => {
      const matchesTab = order.status === targetStatus;
      const matchesSearch =
        !q ||
        order.patient.toLowerCase().includes(q) ||
        order.labCode.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.tests.some((t) => t.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  const handleCollect = async (orderId: string, initials: string, notes: string) => {
    if (!isPersistedLabRequest(orderId)) {
      setCollectModalOrder(null);
      return;
    }
    setMutationBusy(true);
    setMutationError(null);
    try {
      const updated = await patchOrder({
        requestId: orderId,
        action: 'collect',
        collectorInitials: initials.trim(),
        notes: notes.trim() || undefined,
      });
      mergeUpdatedOrder(updated);
      setCollectModalOrder(null);
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Could not record collection.');
    } finally {
      setMutationBusy(false);
    }
  };

  const handleProcess = async (orderId: string, results: Record<string, string>) => {
    if (!isPersistedLabRequest(orderId)) {
      setProcessModalOrder(null);
      return;
    }
    setMutationBusy(true);
    setMutationError(null);
    try {
      const updated = await patchOrder({
        requestId: orderId,
        action: 'process',
        results,
      });
      mergeUpdatedOrder(updated);
      setProcessModalOrder(null);
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Could not save results.');
    } finally {
      setMutationBusy(false);
    }
  };

  const handleVerify = async (orderId: string) => {
    if (!isPersistedLabRequest(orderId)) {
      setViewResultsModalOrder(null);
      return;
    }
    setMutationBusy(true);
    setMutationError(null);
    try {
      const updated = await patchOrder({
        requestId: orderId,
        action: 'verify',
      });
      mergeUpdatedOrder(updated);
      setViewResultsModalOrder(null);
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Could not verify results.');
    } finally {
      setMutationBusy(false);
    }
  };

  const tabCounts = useMemo(() => ({
    Pending: orders.filter((o) => o.status === 'Pending').length,
    Collected: orders.filter((o) => o.status === 'Collected').length,
    Processing: orders.filter((o) => o.status === 'Processing').length,
    Completed: orders.filter((o) => o.status === 'Completed').length,
  }), [orders]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'Pending', label: 'Pending', icon: <Clock className="w-4 h-4" /> },
    { key: 'Collected', label: 'Collected', icon: <Droplets className="w-4 h-4" /> },
    { key: 'Processing', label: 'Processing', icon: <FlaskConical className="w-4 h-4" /> },
    { key: 'Completed', label: 'Completed', icon: <ClipboardCheck className="w-4 h-4" /> },
  ];

  const actionsDisabled = usingFallback || mutationBusy;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Lab Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track sample collection, processing, and results</p>
        </div>
      </div>

      {loadingList && (
        <div className="flex items-center gap-2 rounded-lg border border-content-border bg-content-bg px-4 py-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
          <span>Loading lab orders…</span>
        </div>
      )}

      {!loadingList && listError && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
            usingFallback
              ? 'border-warning/20 bg-warning/5 text-warning'
              : 'border-danger/20 bg-danger/5 text-danger',
          )}
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>{listError}{usingFallback ? ' Showing sample data for reference; actions are disabled until the server responds.' : ''}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-lg border border-content-border bg-content-bg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-content-surface"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {mutationError && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start justify-between gap-3" role="alert">
          <span>{mutationError}</span>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            className="text-xs font-medium text-danger underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-card border transition-all',
              activeTab === tab.key
                ? 'bg-content-bg border-violet-300 shadow-md ring-1 ring-violet-200'
                : 'bg-content-bg/50 border-content-border hover:border-violet-200'
            )}
          >
            <div className={cn(
              'p-2 rounded-lg',
              activeTab === tab.key ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'
            )}>
              {tab.icon}
            </div>
            <div className="text-left">
              <p className="text-xs text-slate-500">{tab.label}</p>
              <p className="text-xl font-bold text-ink">{tabCounts[tab.key]}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-content-surface/80 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">{activeTab}</span>
            <span className="text-xs text-slate-500">({filteredOrders.length} orders)</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient or Lab ID..."
              aria-label="Search lab orders"
              className="pl-9 pr-3 py-2 rounded-lg border border-content-border text-sm outline-none focus:ring-2 focus:ring-violet-500/20 w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Lab ID', 'Patient', 'Tests', 'Priority', 'Ordered At', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-violet-600">{order.labCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{order.patient}</div>
                      <div className="text-xs text-slate-500">{order.pid}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex flex-wrap gap-1">
                        {order.tests.map((test) => (
                          <span key={test} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-content-border">
                            {test}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{order.sampleType}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityStyles[order.priority])}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{order.orderedAt}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', statusStyles[order.status])}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {order.status === 'Pending' && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => !actionsDisabled && setCollectModalOrder(order)}
                            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2 py-1 rounded hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Droplets className="w-3.5 h-3.5" /> Collect
                          </button>
                        )}
                        {order.status === 'Collected' && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => !actionsDisabled && setProcessModalOrder(order)}
                            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2 py-1 rounded hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Process
                          </button>
                        )}
                        {order.status === 'Processing' && (
                          <button type="button" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100">
                            <FlaskConical className="w-3.5 h-3.5" /> In Progress
                          </button>
                        )}
                        {order.status === 'Completed' && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => !actionsDisabled && setViewResultsModalOrder(order)}
                            className="flex items-center gap-1 text-xs text-success hover:text-success/80 px-2 py-1 rounded hover:bg-success/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <FlaskConical className="w-8 h-8 text-slate-300" />
                      <p>No {activeTab.toLowerCase()} lab orders found</p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-xs text-violet-600 hover:underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {collectModalOrder && (
        <CollectModal
          order={collectModalOrder}
          onClose={() => setCollectModalOrder(null)}
          onConfirm={(orderId, initials, notes) => {
            void handleCollect(orderId, initials, notes);
          }}
          disableSubmit={actionsDisabled}
        />
      )}

      {processModalOrder && (
        <ProcessModal
          key={processModalOrder.id}
          order={processModalOrder}
          onClose={() => setProcessModalOrder(null)}
          onConfirm={(orderId, results) => {
            void handleProcess(orderId, results);
          }}
          disableSubmit={actionsDisabled}
        />
      )}

      {viewResultsModalOrder && (
        <ViewResultsModal
          order={viewResultsModalOrder}
          onClose={() => setViewResultsModalOrder(null)}
          onVerify={(orderId) => {
            void handleVerify(orderId);
          }}
          disableSubmit={actionsDisabled}
        />
      )}
    </div>
  );
}