'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertTriangle, Scan, Eye, Printer, PauseCircle, CheckCircle, Loader2, Search, Beaker, CreditCard, Pill, ShieldCheck } from 'lucide-react';
import type { EducationTopicData } from '@/lib/health-news';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import FormulaMatchModal from '@/components/portal/FormulaMatchModal';
import MpesaCheckoutModal from '@/components/portal/MpesaCheckoutModal';
import PredictiveInventoryPanel from '@/components/pharmacy/PredictiveInventoryPanel';
import MedicationAdherenceMonitor from '@/components/pharmacy/MedicationAdherenceMonitor';
import HealthNewsPanel from '@/components/shared/HealthNewsPanel';

type RxStatus = 'Pending' | 'Dispensing' | 'Dispensed' | 'On Hold';

interface QueueRx {
  rxNum: string;
  patient: string;
  prescribedBy: string;
  date: string;
  items: number;
  insurance: string;
  priority: 'Normal' | 'Urgent';
  status: RxStatus;
  alert?: string;
}

interface TopDrug {
  drug: string;
  qty: number;
}


// Status tone mappings now handled by StatusBadge component

const HEALTH_NEWS_TOPICS: EducationTopicData[] = [
  {
    title: 'Antibiotic adherence and missed-dose counseling',
    tag: 'Adherence',
    duration: '4 min read',
    summary: 'Give the same short explanation on completing antibiotic courses, what to do after a missed dose, and when adverse effects need urgent review.',
    actionLabel: 'Open counseling guide',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Insulin and cold-chain storage advice',
    tag: 'Storage',
    duration: '3 min read',
    summary: 'Support safe home storage by reminding patients about heat exposure, travel handling, and the signs of degraded temperature-sensitive medicines.',
    actionLabel: 'Read storage brief',
    image: 'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=800&q=70&auto=format&fit=crop',
  },
  {
    title: 'Pain medicine safety for caregivers',
    tag: 'Medication Safety',
    duration: '5 min read',
    summary: 'Use a consistent script on dose spacing, overdose red flags, and avoiding duplicate paracetamol-containing products after discharge.',
    actionLabel: 'View safety script',
    image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&q=70&auto=format&fit=crop',
  },
];


export default function PharmacyDashboardPage(): React.ReactElement {
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false);
  const [aiAlertLoading, setAiAlertLoading] = useState<boolean>(false);
  const [aiAlertText, setAiAlertText] = useState<string>('');
  const [queue, setQueue] = useState<QueueRx[]>([]);
  const [topDrugs, setTopDrugs] = useState<TopDrug[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPharmacy = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/pharmacy/queue', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load pharmacy queue (${res.status})`);
      const data = await res.json();
      setQueue(Array.isArray(data.queue) ? data.queue : []);
      setTopDrugs(Array.isArray(data.topDrugs) ? data.topDrugs : []);
    } catch (err) {
      logger.error('Failed to load pharmacy queue', { error: err });
      setLoadError(err instanceof Error ? err.message : 'Could not load pharmacy queue.');
      setQueue([]);
      setTopDrugs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPharmacy(); }, [loadPharmacy]);
  const [dispensingRx, setDispensingRx] = useState<string | null>(null);
  const [isFormulaMatchOpen, setIsFormulaMatchOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{ open: boolean; patient: string; amount: number }>({
    open: false,
    patient: '',
    amount: 0
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/data?entity=rxQueue').then((r) => r.ok ? r.json() : null),
      fetch('/api/data?entity=topDrugs').then((r) => r.ok ? r.json() : null),
    ]).then(([rx, drugs]) => {
      if (Array.isArray(rx) && rx.length) setQueue(rx);
      if (Array.isArray(drugs) && drugs.length) setTopDrugs(drugs);
      if (!Array.isArray(rx) || !Array.isArray(drugs)) {
        setLoadError('Live pharmacy data is unavailable right now. Showing the latest local snapshot.');
      }
    }).catch(() => {
      setLoadError('Live pharmacy data is unavailable right now. Showing the latest local snapshot.');
    });
  }, []);

  const handleDispense = async (rx: QueueRx) => {
    setActionError(null);
    setDispensingRx(rx.rxNum);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          rxNum: rx.rxNum,
          patient: rx.patient,
          items: rx.items,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Could not complete dispensing.');
      }
      setQueue((prev) => prev.map((item) => (
        item.rxNum === rx.rxNum ? { ...item, status: 'Dispensed' as const } : item
      )));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not complete dispensing.');
    } finally {
      setDispensingRx(null);
    }
  };

  const filteredQueue = useMemo(() => {
    if (!searchQuery) return queue;
    const query = searchQuery.toLowerCase();
    return queue.filter((rx) =>
      rx.patient.toLowerCase().includes(query) ||
      rx.rxNum.toLowerCase().includes(query) ||
      rx.prescribedBy.toLowerCase().includes(query)
    );
  }, [searchQuery, queue]);

  const pharmacyStats = useMemo(() => ({
    pending: queue.filter((rx) => rx.status === 'Pending' || rx.status === 'Dispensing').length,
    urgent: queue.filter((rx) => rx.priority === 'Urgent').length,
    dispensed: queue.filter((rx) => rx.status === 'Dispensed').length,
  }), [queue]);

  useEffect(() => {
    const runAiDosingAlert = async () => {
      setAiAlertLoading(true);
      try {
        const response = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'drug_interaction',
            data: {
              medications: [
                'Amoxicillin 750mg',
                'Paracetamol syrup 120mg/5ml',
                'Ibuprofen syrup 100mg/5ml',
              ],
            },
          }),
        });

        const payload = await response.json();
        const first = Array.isArray(payload?.results) ? payload.results[0] : null;
        if (!response.ok || !first) {
          throw new Error(payload?.error || 'No interaction insight returned.');
        }

        const safetyMessage = [
          `${first.drug1} + ${first.drug2} (${first.severity})`,
          first.clinical_effect,
          first.recommendation,
        ].filter(Boolean).join(' - ');

        setAiAlertText(safetyMessage);
      } catch {
        setAiAlertText('Amoxicillin dose (750mg) exceeds pediatric range for an 8kg child. Verify weight-based dosing and confirm with prescriber before dispensing.');
      } finally {
        setAiAlertLoading(false);
      }
    };

    void runAiDosingAlert();
  }, []);

  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 text-charcoal shadow-card md:p-6">
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.18),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
        <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary-light/35 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <Pill className="h-3.5 w-3.5" />
              Grace Otieno · Pharmacy counter
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">Dispensing queue</h1>
            <p className="mt-2 text-sm font-medium text-slate">Medication safety, fulfillment status, and checkout actions for today’s active scripts.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
            {[
              { label: 'Pending', value: pharmacyStats.pending, icon: <Pill className="h-4 w-4" /> },
              { label: 'Urgent', value: pharmacyStats.urgent, icon: <AlertTriangle className="h-4 w-4" /> },
              { label: 'Dispensed', value: pharmacyStats.dispensed, icon: <ShieldCheck className="h-4 w-4" /> },
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
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsFormulaMatchOpen(true)}
            className="flex items-center gap-2 rounded-full border border-success/20 bg-success/5 px-4 py-2 text-sm font-semibold text-success transition hover:bg-success/10"
          >
            <Beaker className="w-4 h-4" /> Compound AI
          </button>
          <button className="flex items-center gap-2 rounded-full border border-content-border bg-content-bg px-4 py-2 text-sm font-medium text-charcoal transition hover:border-portal-primary/30 hover:bg-content-bg">
            <Scan className="w-4 h-4 text-portal-primary" /> Scan Rx
          </button>
        </div>
      </div>

      {/* AI Alert */}
      {!alertDismissed && (
        <div className="flex gap-3 rounded-card border border-danger/20 bg-danger/5 p-4" role="status" aria-live="polite">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-danger">AI Dosing Alert</p>
            {aiAlertLoading ? (
              <p className="inline-flex items-center gap-2 text-sm leading-relaxed text-charcoal">
                <Loader2 className="h-4 w-4 animate-spin" /> Running AI safety check...
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-charcoal">
                Prescription <span className="font-medium text-ink">RX-2847</span> - {aiAlertText}
              </p>
            )}
          </div>
          <button onClick={() => setAlertDismissed(true)} className="shrink-0 text-xs font-medium text-danger hover:text-danger/80">Dismiss</button>
        </div>
      )}

      {/* KPI Strip */}
      {loadError && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Queue Now',       value: '7',        sub: 'Prescriptions pending', color: 'text-info' },
          { label: 'Dispensed Today', value: '43',       sub: 'Prescriptions',          color: 'text-success' },
          { label: 'Out-of-Stock',    value: '3',        sub: 'Drug alerts',            color: 'text-danger' },
          { label: 'Revenue Today',   value: 'KES 18.4K', sub: 'Across all modes',      color: 'text-info' },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">{k.label}</p>
            <p className={cn('text-2xl font-semibold tracking-tight', k.color)}>{k.value}</p>
            <p className="mt-1 text-xs text-slate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Predictive Inventory Intelligence - Desktop/Tablet Optimized */}
      <PredictiveInventoryPanel />

      {/* Medication Adherence Monitor */}
      <MedicationAdherenceMonitor
        patientId="demo-patient"
        medications={[
          { name: 'Artemether/Lumefantrine 80/480mg', frequency: 'twice daily', duration: '3 days' },
          { name: 'Amoxicillin 500mg', frequency: 'three times daily', duration: '7 days' },
        ]}
        adherenceHistory={{}}
        riskFactors={{ age: 35, comorbidities: 'Diabetes', previousAdmissions: 2 }}
        socialContext={{ support: 'moderate', distance: 15 }}
      />

      {/* Dispensing Queue Table */}
      <div className="overflow-hidden rounded-card border border-content-border bg-content-bg shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-content-border bg-content-surface px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Active Queue</h2>
            <span className="text-xs text-slate">{filteredQueue.length} of {queue.length} prescriptions</span>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient, RX #, or doctor..."
              aria-label="Search prescriptions by patient, RX number, or prescriber"
              className="h-10 w-full rounded-card border border-content-border bg-content-surface pl-9 pr-3 text-sm text-charcoal outline-none transition focus:border-portal-primary/35 focus:ring-2 focus:ring-portal-primary/15 sm:w-72"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface">
                {['Rx #', 'Patient', 'Prescribed By', 'Date', 'Items', 'Insurance', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length > 0 ? (
                filteredQueue.map((rx) => (
                <tr
                  key={rx.rxNum}
                  className={cn(
                    'border-b border-content-border/70 transition-colors',
                    rx.alert ? 'bg-severity-high-bg/80 hover:bg-severity-high-bg' : 'hover:bg-content-surface/60'
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-portal-primary">{rx.rxNum}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                    <div>
                      {rx.patient}
                      {rx.alert && (
                        <span className="ml-2 rounded border border-danger/20 bg-danger/5 px-1.5 py-0.5 text-xs font-medium text-danger">
                          {rx.alert}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-charcoal">{rx.prescribedBy}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate">{rx.date}</td>
                  <td className="px-4 py-3 text-center font-medium text-ink">{rx.items}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-charcoal">{rx.insurance}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',
                      rx.priority === 'Urgent' ? 'bg-severity-medium-bg text-severity-medium' : 'bg-content-surface text-charcoal'
                    )}>
                      {rx.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge
                      tone={rx.status === 'On Hold' ? 'danger' : rx.status === 'Pending' ? 'warning' : rx.status === 'Dispensing' ? 'active' : 'success'}
                      size="sm"
                    >
                      {rx.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {rx.status !== 'Dispensed' && (
                        <button
                          onClick={() => setCheckoutData({ open: true, patient: rx.patient, amount: rx.items * 450 })}
                          className="flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-xs font-semibold text-portal-primary transition hover:border-portal-primary/20 hover:bg-portal-primary-light/20 hover:text-portal-primary-hover"
                        >
                          <CreditCard className="w-3 h-3" /> Collect KES
                        </button>
                      )}
                      {rx.status !== 'Dispensed' && (
                        <button
                          onClick={() => { void handleDispense(rx); }}
                          disabled={dispensingRx === rx.rxNum}
                          className="flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-xs font-semibold text-portal-primary transition hover:border-portal-primary/25 hover:bg-portal-primary-light/35 hover:text-portal-primary-hover disabled:opacity-50"
                        >
                          {dispensingRx === rx.rxNum ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Dispense
                        </button>
                      )}
                      <button className="rounded-md p-1 text-xs text-slate transition hover:bg-content-surface hover:text-ink">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="rounded-md p-1 text-xs text-slate transition hover:bg-content-surface hover:text-ink">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {rx.status !== 'Dispensed' && (
                        <button className="rounded-md p-1 text-xs text-warning transition hover:bg-warning/10 hover:text-warning/80">
                          <PauseCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Pill className="h-5 w-5" />
                      </div>
                      <p className="text-ink font-medium">No prescriptions match</p>
                      <p className="text-sm text-slate">Try adjusting your search query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Drugs Dispensed */}
      <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-ink">Top 5 Drugs Dispensed Today</h2>
        <div className="space-y-3">
          {topDrugs.map((d, i) => {
            const maxQty = topDrugs[0].qty;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-xs text-slate">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink">{d.drug}</span>
                    <span className="text-sm font-semibold text-portal-primary">{d.qty}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-content-border">
                    <div
                      className="h-2 rounded-full bg-portal-primary"
                      style={{ width: `${(d.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <HealthNewsPanel
        accentColor="var(--portal-primary)"
        heading="Medication news built into dispensing"
        description="Keep high-frequency counseling messages visible so every handoff covers safe use, adherence, storage, and reasons to return for review."
        insightTitle="Today's news priority"
        insightText="Urgent prescriptions and pediatric dosing checks are active in the queue. Prioritize counseling on exact dose measurement, antibiotic completion, and safe medicine storage at home."
        role="pharmacy"
        topics={HEALTH_NEWS_TOPICS}
      />

      <FormulaMatchModal 
        open={isFormulaMatchOpen} 
        onClose={() => setIsFormulaMatchOpen(false)} 
      />

      <MpesaCheckoutModal
        open={checkoutData.open}
        onClose={() => setCheckoutData(prev => ({ ...prev, open: false }))}
        patientName={checkoutData.patient}
        amount={checkoutData.amount}
        onSuccess={() => {
          // Update queue status locally for demo
          setQueue(prev => prev.map(rx => 
            rx.patient === checkoutData.patient ? { ...rx, status: 'Dispensed' as const } : rx
          ));
        }}
      />
    </div>
  );
}
