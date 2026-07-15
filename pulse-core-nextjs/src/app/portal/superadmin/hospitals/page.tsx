'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Search,
  MapPin,
  Users,
  Activity,
  Settings,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Mail,
  ShieldAlert,
  ClipboardCheck,
  X,
  Loader2,
  AlertTriangle,
  FileWarning,
  Eye,
  Radar,
} from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
type ComplianceBand = 'aligned' | 'partial' | 'at_risk' | 'not_assessed';
type RiskTier = 'low' | 'medium' | 'high' | 'critical';

interface GovernanceRiskFlag {
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
}

interface HospitalGovernanceSummary {
  riskLevel: RiskTier;
  riskFlags: GovernanceRiskFlag[];
  complianceStatus: ComplianceBand;
  complianceImplementedPct: number | null;
  openIncidents: number;
  criticalOpenIncidents: number;
  activeBreaches: number;
  pendingStaff: number;
  sensitiveExports14d: number;
  anomalySignalCount: number;
}

interface Hospital {
  id: string;
  name: string;
  specialisation?: string | null;
  location?: string | null;
  licenseNumber?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    profiles: number;
    patients: number;
  };
  governance: HospitalGovernanceSummary;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface GovernanceAnomalyAlert {
  code: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  narrative: string;
  windowLabel: string;
  metrics: Record<string, number | string>;
  recommendedAction: string;
  followUpNoteTemplate: string;
  evidenceAudits: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
}

interface GovernanceDrilldownResponse {
  hospital: {
    id: string;
    name: string;
    isActive: boolean;
    email?: string | null;
    licenseNumber?: string | null;
    location?: string | null;
    _count: { profiles: number; patients: number };
  };
  governance: HospitalGovernanceSummary;
  drilldown: {
    openIncidents: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
      category: string;
      detectedAt: string;
    }>;
    activeBreaches: Array<{
      id: string;
      breachType: string;
      severity: string;
      status: string;
      affectedRecords: number;
      detectedAt: string;
      description: string;
    }>;
    sensitiveAudits30d: Array<{
      id: string;
      action: string;
      actorEmail?: string | null;
      actorRole?: string | null;
      resourceType?: string | null;
      resourceId?: string | null;
      createdAt: string;
    }>;
    securityControlBreakdown: Array<{ implementationStatus: string; count: number }>;
    lastOversightAction: {
      action: string;
      createdAt: string;
      actorEmail?: string | null;
      detail: unknown;
    } | null;
    anomalyAlerts: GovernanceAnomalyAlert[];
  };
}

// ─── Presentation helpers ─────────────────────────────────────────────────────
function riskTierStyles(tier: RiskTier) {
  switch (tier) {
    case 'critical':
      return 'bg-danger/15 text-danger border-danger/30';
    case 'high':
      return 'bg-warning/15 text-warning border-warning/30';
    case 'medium':
      return 'bg-warning/15 text-warning border-warning/30';
    default:
      return 'bg-success/10 text-success border-success/20';
  }
}

function complianceStyles(band: ComplianceBand) {
  switch (band) {
    case 'aligned':
      return 'text-success bg-success/10';
    case 'partial':
      return 'text-warning bg-warning/10';
    case 'at_risk':
      return 'text-danger bg-danger/10';
    default:
      return 'text-slate bg-content-surface';
  }
}

function complianceLabel(band: ComplianceBand) {
  switch (band) {
    case 'aligned':
      return 'Controls aligned';
    case 'partial':
      return 'Controls partial';
    case 'at_risk':
      return 'Controls at risk';
    default:
      return 'Controls not assessed';
  }
}

function flagSeverityDot(sev: GovernanceRiskFlag['severity']) {
  if (sev === 'critical') return 'bg-danger';
  if (sev === 'warning') return 'bg-warning';
  return 'bg-primary';
}

function anomalySeverityStyles(sev: GovernanceAnomalyAlert['severity']) {
  if (sev === 'critical') return 'border-danger/35 bg-danger/10 text-danger';
  if (sev === 'warning') return 'border-warning/35 bg-warning/10 text-warning';
  return 'border-primary/30 bg-primary/5 text-primary';
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const [oversightId, setOversightId] = useState<string | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<GovernanceDrilldownResponse | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [noteInsertNotice, setNoteInsertNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchHospitals = useCallback(
    async (opts?: { isManualRefresh?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '12',
        });
        if (debouncedSearch) params.set('q', debouncedSearch);

        const res = await fetch(`/api/superadmin/hospitals?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as {
          hospitals?: Hospital[];
          pagination?: Pagination;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `Failed to load hospitals (${res.status})`);
        }
        setHospitals(data.hospitals ?? []);
        setPagination(data.pagination ?? null);
        if (opts?.isManualRefresh) {
          setRefreshNotice('Facility list refreshed');
          window.setTimeout(() => setRefreshNotice(null), 2500);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load hospitals';
        setError(message);
        logger.error('Failed to load hospitals', { error: err });
      } finally {
        setLoading(false);
      }
    },
    [page, debouncedSearch],
  );

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const fetchOversightPanel = useCallback(async (hospitalId: string) => {
    setPanelLoading(true);
    setPanelError(null);
    setActionFeedback(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/superadmin/hospitals/${hospitalId}/governance`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as GovernanceDrilldownResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Failed to load oversight (${res.status})`);
      }
      setPanelData(data);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Failed to load oversight');
      setPanelData(null);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!oversightId) {
      setPanelData(null);
      setPanelError(null);
      setFollowUpNote('');
      return;
    }
    void fetchOversightPanel(oversightId);
  }, [oversightId, fetchOversightPanel]);

  const postOversightAction = async (type: 'mark_reviewed' | 'request_follow_up') => {
    if (!oversightId) return;
    setActionBusy(true);
    setActionFeedback(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/superadmin/hospitals/${oversightId}/governance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          note: type === 'request_follow_up' ? followUpNote.trim() || undefined : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Action failed (${res.status})`);
      }
      setActionFeedback(data.message ?? 'Recorded.');
      await fetchOversightPanel(oversightId);
      await fetchHospitals();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionBusy(false);
    }
  };

  const closePanel = () => {
    setOversightId(null);
    setFollowUpNote('');
    setActionFeedback(null);
    setActionError(null);
    setNoteInsertNotice(null);
  };

  return (
    <PageLayout
      title="Active Hospitals"
      subtitle="Platform-wide facility directory with governance, risk signals, and oversight actions"
      actions={
        <button
          type="button"
          onClick={() => fetchHospitals({ isManualRefresh: true })}
          className="p-2 rounded-lg bg-content-surface border border-content-border text-slate hover:text-ink hover:bg-content-bg transition-all shadow-card"
          aria-label="Refresh hospitals"
        >
          <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
        </button>
      }
    >
      <div className="space-y-6">
        {refreshNotice && (
          <div className="rounded-card border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
            {refreshNotice}
          </div>
        )}

        {error && (
          <PageSection className="border-red-500/30 bg-danger/5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-danger">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchHospitals()}
                className="inline-flex items-center justify-center gap-2 rounded-card border border-danger/40 px-4 py-2 text-xs font-bold uppercase tracking-wide text-danger hover:bg-danger/10 transition-colors"
              >
                Retry
              </button>
            </div>
          </PageSection>
        )}

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by facility name, location, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-content-surface border border-content-border rounded-card py-3 pl-12 pr-4 text-sm text-ink placeholder:text-slate focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all outline-none"
          />
        </div>

        {loading && hospitals.length === 0 ? (
          <PageSection className="py-24 flex flex-col items-center justify-center border-content-border bg-content-surface/30">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm text-slate">Loading facilities…</p>
          </PageSection>
        ) : !error && hospitals.length === 0 ? (
          <PageSection className="py-20 text-center flex flex-col items-center border-content-border bg-content-surface/30">
            <Building2 className="w-12 h-12 text-slate mb-4" />
            <h3 className="text-lg font-semibold text-charcoal">No hospitals found</h3>
            <p className="text-sm text-slate max-w-xs mt-2">
              Try adjusting your search criteria or check back later.
            </p>
          </PageSection>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="group relative bg-content-surface border border-content-border hover:border-portal-primary/25 rounded-card p-6 transition-all duration-300 shadow-card"
              >
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="p-3 rounded-card bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                        hospital.isActive
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-content-bg text-slate border-content-border',
                      )}
                    >
                      {hospital.isActive ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          Active
                        </>
                      ) : (
                        <>Inactive</>
                      )}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                        riskTierStyles(hospital.governance.riskLevel),
                      )}
                    >
                      Risk: {hospital.governance.riskLevel}
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-charcoal mb-1 group-hover:text-primary transition-colors truncate">
                  {hospital.name}
                </h3>
                <p className="text-sm text-slate mb-3 line-clamp-1">
                  {hospital.specialisation || 'General Facility'}
                </p>

                <div
                  className={cn(
                    'flex items-center gap-2 text-[11px] font-semibold mb-4 px-2 py-1 rounded-lg w-fit',
                    complianceStyles(hospital.governance.complianceStatus),
                  )}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  {complianceLabel(hospital.governance.complianceStatus)}
                  {hospital.governance.complianceImplementedPct != null && (
                    <span className="opacity-80">
                      ({hospital.governance.complianceImplementedPct}% implemented)
                    </span>
                  )}
                </div>

                {hospital.governance.riskFlags.length > 0 && (
                  <ul className="mb-4 space-y-1.5 border-t border-content-border pt-3">
                    {hospital.governance.riskFlags.slice(0, 4).map((f) => (
                      <li
                        key={f.id}
                        className="flex items-start gap-2 text-[11px] text-slate leading-snug"
                      >
                        <span
                          className={cn('mt-1 h-1.5 w-1.5 rounded-full shrink-0', flagSeverityDot(f.severity))}
                        />
                        <span>{f.label}</span>
                      </li>
                    ))}
                    {hospital.governance.riskFlags.length > 4 && (
                      <li className="text-[10px] text-slate pl-3.5">
                        +{hospital.governance.riskFlags.length - 4} more in oversight
                      </li>
                    )}
                  </ul>
                )}

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate">
                    <MapPin className="w-3.5 h-3.5 text-slate shrink-0" />
                    <span className="truncate">{hospital.location || 'Location unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate">
                    <Mail className="w-3.5 h-3.5 text-slate shrink-0" />
                    <span className="truncate">{hospital.email || 'No email provided'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-4 border-t border-content-border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Staff</span>
                    </div>
                    <p className="text-lg font-bold text-charcoal">{hospital._count.profiles}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate">
                      <Activity className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Patients</span>
                    </div>
                    <p className="text-lg font-bold text-charcoal">{hospital._count.patients}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOversightId(hospital.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-card bg-content-surface border border-content-border text-charcoal hover:text-ink hover:border-portal-primary/40 hover:bg-content-bg text-xs font-bold transition-all"
                  >
                    <Eye className="w-4 h-4 text-primary" />
                    Oversight
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-card bg-content-surface border border-content-border text-slate hover:text-ink hover:bg-content-bg transition-all"
                    aria-label="Settings placeholder"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between py-4">
            <span className="text-xs text-slate">
              Showing {(page - 1) * pagination.limit + 1} to{' '}
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} hospitals
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-card border border-content-border text-slate hover:bg-content-bg disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={page === pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-card border border-content-border text-slate hover:bg-content-bg disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {oversightId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="oversight-title"
        >
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-card border border-content-border bg-content-surface shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-content-border bg-content-surface px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                  Governance drill-down
                </p>
                <h2 id="oversight-title" className="text-lg font-bold text-charcoal truncate">
                  {panelData?.hospital.name ?? 'Facility'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="p-2 rounded-card border border-content-border text-slate hover:text-ink hover:bg-content-bg transition-colors"
                aria-label="Close oversight panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {panelLoading && (
                <LoadingState
                  title="Loading oversight data"
                  description="Fetching governance metrics, incidents, and audit activity…"
                />
              )}

              {panelError && !panelLoading && (
                <ErrorState
                  title="Could not load oversight"
                  description={panelError}
                  onRetry={() => void fetchOversightPanel(oversightId)}
                  retryLabel="Retry"
                />
              )}

              {!panelLoading && panelData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-card border border-content-border bg-content-bg p-3">
                      <p className="text-[10px] text-slate uppercase font-bold tracking-wider">Open incidents</p>
                      <p className="text-xl font-bold text-charcoal mt-1">{panelData.governance.openIncidents}</p>
                    </div>
                    <div className="rounded-card border border-content-border bg-content-bg p-3">
                      <p className="text-[10px] text-slate uppercase font-bold tracking-wider">Breaches open</p>
                      <p className="text-xl font-bold text-charcoal mt-1">{panelData.governance.activeBreaches}</p>
                    </div>
                    <div className="rounded-card border border-content-border bg-content-bg p-3">
                      <p className="text-[10px] text-slate uppercase font-bold tracking-wider">Exports (14d)</p>
                      <p className="text-xl font-bold text-charcoal mt-1">
                        {panelData.governance.sensitiveExports14d}
                      </p>
                    </div>
                    <div className="rounded-card border border-content-border bg-content-bg p-3">
                      <p className="text-[10px] text-slate uppercase font-bold tracking-wider">Pending staff</p>
                      <p className="text-xl font-bold text-charcoal mt-1">{panelData.governance.pendingStaff}</p>
                    </div>
                  </div>

                  {noteInsertNotice && (
                    <p className="text-xs text-violet-200 bg-violet-500/10 border border-violet-500/25 rounded-lg px-3 py-2">
                      {noteInsertNotice}
                    </p>
                  )}

                  <section>
                    <h3 className="text-sm font-bold text-charcoal flex items-center gap-2 mb-2">
                      <Radar className="w-4 h-4 text-violet-400" />
                      Automated anomaly signals
                    </h3>
                    {(panelData.drilldown.anomalyAlerts ?? []).length === 0 ? (
                      <p className="text-xs text-slate">
                        No audit-threshold anomalies detected for this facility (PHI volume, access friction, export
                        actor dispersion).
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {(panelData.drilldown.anomalyAlerts ?? []).map((a) => (
                          <li
                            key={a.code}
                            className={cn(
                              'rounded-card border px-3 py-3 text-xs space-y-2',
                              anomalySeverityStyles(a.severity),
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-charcoal text-[13px]">{a.title}</p>
                                <p className="text-[11px] text-slate mt-1">{a.windowLabel}</p>
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{a.code}</span>
                            </div>
                            <p className="text-slate leading-relaxed">{a.narrative}</p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate">
                              {Object.entries(a.metrics).map(([k, v]) => (
                                <span key={k} className="rounded-md bg-black/25 px-2 py-0.5 font-mono">
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                            <p className="text-slate">
                              <span className="font-semibold text-charcoal">Recommended: </span>
                              {a.recommendedAction}
                            </p>
                            {a.evidenceAudits.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate mb-1">
                                  Recent audit evidence
                                </p>
                                <ul className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                  {a.evidenceAudits.map((e) => (
                                    <li
                                      key={e.id}
                                      className="rounded border border-content-border bg-content-surface px-2 py-1 text-[10px] text-slate"
                                    >
                                      <span className="text-charcoal">{e.action}</span>
                                      <span className="text-slate"> · </span>
                                      {e.actorEmail ?? 'unknown'}
                                      <span className="text-slate float-right">
                                        {new Date(e.createdAt).toLocaleString()}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setFollowUpNote(a.followUpNoteTemplate);
                                setNoteInsertNotice('Follow-up note field updated from this anomaly.');
                                window.setTimeout(() => setNoteInsertNotice(null), 4000);
                              }}
                              className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-100 text-[11px] font-bold py-2 px-3 hover:bg-violet-500/15 transition-colors"
                            >
                              Use suggested follow-up wording
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {panelData.drilldown.lastOversightAction && (
                    <div className="rounded-card border border-content-border bg-content-bg px-4 py-3 text-xs text-slate">
                      <span className="text-slate font-semibold">Last oversight action: </span>
                      <span className="text-charcoal">{panelData.drilldown.lastOversightAction.action}</span>
                      <span className="text-slate"> · </span>
                      {new Date(panelData.drilldown.lastOversightAction.createdAt).toLocaleString()}
                      {panelData.drilldown.lastOversightAction.actorEmail && (
                        <>
                          <span className="text-slate"> · </span>
                          {panelData.drilldown.lastOversightAction.actorEmail}
                        </>
                      )}
                    </div>
                  )}

                  <section>
                    <h3 className="text-sm font-bold text-charcoal flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4 text-warning" />
                      Open security incidents
                    </h3>
                    {panelData.drilldown.openIncidents.length === 0 ? (
                      <p className="text-xs text-slate">No open incidents for this facility.</p>
                    ) : (
                      <ul className="space-y-2">
                        {panelData.drilldown.openIncidents.map((inc) => (
                          <li
                            key={inc.id}
                            className="rounded-lg border border-content-border bg-content-bg px-3 py-2 text-xs"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="text-charcoal font-medium">{inc.title}</span>
                              <span className="text-warning shrink-0 uppercase text-[10px] font-bold">
                                {inc.severity}
                              </span>
                            </div>
                            <p className="text-slate mt-1">
                              {inc.category} · {new Date(inc.detectedAt).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                      <FileWarning className="w-4 h-4 text-danger" />
                      Active breach records
                    </h3>
                    {panelData.drilldown.activeBreaches.length === 0 ? (
                      <p className="text-xs text-slate">No unresolved breach records.</p>
                    ) : (
                      <ul className="space-y-2">
                        {panelData.drilldown.activeBreaches.map((b) => (
                          <li
                            key={b.id}
                            className="rounded-lg border border-red-500/20 bg-danger/5 px-3 py-2 text-xs"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="text-charcoal">{b.breachType}</span>
                              <span className="text-danger shrink-0 uppercase text-[10px] font-bold">
                                {b.severity}
                              </span>
                            </div>
                            <p className="text-slate mt-1 line-clamp-2">{b.description}</p>
                            <p className="text-slate mt-1">
                              {b.affectedRecords} records · {new Date(b.detectedAt).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-charcoal mb-2">Sensitive audit activity (30 days)</h3>
                    {panelData.drilldown.sensitiveAudits30d.length === 0 ? (
                      <p className="text-xs text-slate">No export-class audit entries in the last 30 days.</p>
                    ) : (
                      <ul className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {panelData.drilldown.sensitiveAudits30d.map((a) => (
                          <li
                            key={a.id}
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-content-border px-2 py-1.5 text-[11px] text-slate"
                          >
                            <span className="text-charcoal font-mono">{a.action}</span>
                            <span className="text-slate">·</span>
                            <span>{a.actorEmail ?? 'unknown actor'}</span>
                            <span className="text-slate ml-auto">
                              {new Date(a.createdAt).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-charcoal mb-2">ISO control implementation mix</h3>
                    {panelData.drilldown.securityControlBreakdown.length === 0 ? (
                      <p className="text-xs text-slate">No security controls recorded for this facility.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {panelData.drilldown.securityControlBreakdown.map((row) => (
                          <span
                            key={row.implementationStatus}
                            className="rounded-lg border border-content-border bg-content-bg px-2.5 py-1 text-[11px] text-charcoal"
                          >
                            <span className="text-slate">{row.implementationStatus}: </span>
                            {row.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="border-t border-content-border pt-4 space-y-3">
                    <p className="text-xs text-slate">
                      Actions are written to the immutable Prisma audit log for this facility and appear in the
                      platform audit trail.
                    </p>
                    {actionFeedback && (
                      <p className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
                        {actionFeedback}
                      </p>
                    )}
                    {actionError && (
                      <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                        {actionError}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void postOversightAction('mark_reviewed')}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-card bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold py-3 px-4 disabled:opacity-40 transition-colors"
                      >
                        {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                        Mark reviewed
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wide text-slate">
                        Optional note for admin follow-up
                      </label>
                      <textarea
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        rows={2}
                        placeholder="Escalation context for the facility admin…"
                        className="w-full rounded-card border border-content-border bg-content-surface text-sm text-ink placeholder:text-slate p-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void postOversightAction('request_follow_up')}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-card border border-warning/40 bg-warning/10 text-warning text-xs font-bold py-3 px-4 hover:bg-warning/15 disabled:opacity-40 transition-colors"
                      >
                        {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                        Request admin follow-up
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
