'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pill,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderInsights } from '@/components/portal/pharmacy/OrderInsights';
import { DispenseModal, type DispenseModalLineItem } from '@/components/portal/pharmacy/modals/DispenseModal';
import { cn } from '@/lib/utils';

type RxStatus = 'Ready to Dispense' | 'Clarification Needed' | 'Awaiting Stock' | 'Dispensed' | 'On Hold';

interface RxOrder {
  prescriptionId: string;
  rx: string;
  patient: string;
  pid: string;
  prescriber: string;
  items: number;
  insurance: string;
  status: RxStatus;
  priority: 'Urgent' | 'Normal';
  time: string;
  alert?: string;
  lineItems: DispenseModalLineItem[];
}

const STATUS_STYLE: Record<RxStatus, string> = {
  'Ready to Dispense': 'bg-success/5 text-success',
  'Clarification Needed': 'bg-warning/5 text-warning',
  'Awaiting Stock': 'bg-primary/5 text-primary',
  Dispensed: 'bg-slate-100 text-slate-600',
  'On Hold': 'bg-danger/5 text-danger',
};

const STATUS_ICON: Record<RxStatus, React.ReactNode> = {
  'Ready to Dispense': <CheckCircle2 className="w-3.5 h-3.5" />,
  'Clarification Needed': <AlertTriangle className="w-3.5 h-3.5" />,
  'Awaiting Stock': <Clock className="w-3.5 h-3.5" />,
  Dispensed: <CheckCircle2 className="w-3.5 h-3.5" />,
  'On Hold': <AlertTriangle className="w-3.5 h-3.5" />,
};

export default function PharmacyOrdersPage() {
  const [orders, setOrders] = useState<RxOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RxStatus | 'All'>('All');
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'replenishments'>('prescriptions');
  const [selectedOrder, setSelectedOrder] = useState<RxOrder | null>(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const statuses: (RxStatus | 'All')[] = [
    'All',
    'Ready to Dispense',
    'Clarification Needed',
    'Awaiting Stock',
    'On Hold',
    'Dispensed',
  ];

  const loadOrders = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/pharmacy/orders', { cache: 'no-store', credentials: 'same-origin' });
      const payload = (await res.json()) as { orders?: RxOrder[]; error?: string };
      if (!res.ok) {
        throw new Error(payload?.error ?? `Could not load orders (${res.status})`);
      }
      if (!Array.isArray(payload.orders)) {
        throw new Error('Unexpected response from server.');
      }
      setOrders(payload.orders);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => setSuccessMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  const ready = useMemo(() => orders.filter((o) => o.status === 'Ready to Dispense').length, [orders]);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const q = search.toLowerCase();
        const matchSearch =
          o.patient.toLowerCase().includes(q) ||
          o.rx.toLowerCase().includes(q) ||
          o.prescriber.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'All' || o.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [orders, search, statusFilter],
  );

  const handleDispensed = useCallback(() => {
    setSuccessMessage('Prescription recorded as dispensed.');
    void loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-5 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Prescription Orders</h1>
        <span className="rounded-card border border-success/20 bg-success/5 px-3 py-1 text-sm font-medium text-success">
          {loading ? '…' : ready} ready to dispense
        </span>
      </div>

      {loadError && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="mt-2 text-xs font-bold uppercase tracking-wide text-danger underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {successMessage && !loadError && (
        <div className="rounded-card border border-success/20 bg-success/5 px-4 py-3 text-sm font-medium text-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-content-border">
        <button
          type="button"
          onClick={() => setActiveTab('prescriptions')}
          className={cn(
            'pb-3 text-sm font-bold transition-all relative',
            activeTab === 'prescriptions' ? 'text-primary' : 'text-slate-400 hover:text-slate-600',
          )}
        >
          Incoming Prescriptions
          {activeTab === 'prescriptions' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('replenishments')}
          className={cn(
            'pb-3 text-sm font-bold transition-all relative flex items-center gap-2',
            activeTab === 'replenishments' ? 'text-primary' : 'text-slate-400 hover:text-slate-600',
          )}
        >
          <Sparkles className="w-4 h-4" /> Smart Replenishments
          {activeTab === 'replenishments' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'prescriptions' ? (
          <motion.div
            key="rx"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-5"
          >
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-44">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient or RX"
                  aria-label="Search orders by patient, prescription, or prescriber"
                  className="w-full rounded-card border border-content-border bg-content-bg py-2 pl-9 pr-3 text-sm text-charcoal outline-none focus:border-portal-primary/35 focus:ring-2 focus:ring-portal-primary/15"
                  disabled={loading && orders.length === 0}
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as RxStatus | 'All')}
                  className="rounded-card border border-content-border bg-content-bg px-3 py-2 text-sm text-charcoal outline-none focus:border-portal-primary/35 focus:ring-2 focus:ring-portal-primary/15"
                  disabled={loading && orders.length === 0}
                >
                  {statuses.map((s) => (
                    <option key={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Orders */}
            <div className="rounded-card border border-content-border bg-content-bg shadow-card divide-y divide-slate-100 min-h-[120px]">
              {loading && orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading prescription orders…</p>
                </div>
              ) : (
                <>
                  {loading && orders.length > 0 && (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500 bg-content-surface border-b border-content-border/50">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      Refreshing…
                    </div>
                  )}
                  {filtered.map((o) => (
                    <div
                      key={o.prescriptionId}
                      onClick={() => {
                        if (o.status === 'Ready to Dispense') {
                          setSelectedOrder(o);
                          setIsDispenseModalOpen(true);
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between p-4 transition-colors group',
                        o.status === 'Ready to Dispense'
                          ? 'hover:bg-content-surface cursor-pointer'
                          : 'opacity-90 grayscale-[0.2]',
                      )}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (o.status === 'Ready to Dispense') {
                            setSelectedOrder(o);
                            setIsDispenseModalOpen(true);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-card bg-primary/5 group-hover:bg-primary/10 transition-colors">
                          <Pill className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-ink">{o.rx}</p>
                            <span className="text-xs font-mono text-slate-400">{o.pid}</span>
                            {o.priority === 'Urgent' && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-danger/5 text-danger border border-danger/20 italic tracking-tighter">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 font-medium">
                            {o.patient} • {o.prescriber} • {o.items} item{o.items > 1 ? 's' : ''} • {o.insurance} •{' '}
                            {o.time}
                          </p>
                          {o.alert && (
                            <p className="text-xs text-warning font-bold flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              {o.alert}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap border ${
                            o.status === 'Ready to Dispense' ? 'border-green-200' : 'border-content-border'
                          } ${STATUS_STYLE[o.status]}`}
                        >
                          {STATUS_ICON[o.status]}
                          {o.status}
                        </span>
                        <span className="p-2 rounded-lg bg-content-bg border border-content-border text-primary group-hover:bg-primary/5 transition-colors inline-flex">
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  ))}
                  {!loading && !loadError && filtered.length === 0 && (
                    <p className="text-center py-8 text-slate-400">No orders match.</p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="replenish"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <OrderInsights />
          </motion.div>
        )}
      </AnimatePresence>

      <DispenseModal
        isOpen={isDispenseModalOpen}
        onClose={() => setIsDispenseModalOpen(false)}
        order={
          selectedOrder
            ? {
                rx: selectedOrder.rx,
                patient: selectedOrder.patient,
                pid: selectedOrder.pid,
                items: selectedOrder.items,
                lineItems: selectedOrder.lineItems,
              }
            : null
        }
        onDispensed={handleDispensed}
      />
    </div>
  );
}
