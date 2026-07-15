'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import { cn } from '@/lib/utils';

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

interface HospitalRow {
  id: string;
  name: string;
  isActive: boolean;
  _count: { profiles: number; patients: number };
  governance: HospitalGovernanceSummary;
}

interface ComplianceEvent {
  id: string;
  action: string;
  hospitalId: string | null;
  hospitalName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  createdAt: string;
  detail: unknown;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedByEmail: string | null;
}

interface CompliancePayload {
  generatedAt?: string;
  windowDays?: number;
  scan?: {
    unresolvedHighRiskInSample: number;
    totalHighRiskMatched30d: number;
    unresolvedScanCap: number;
    scanIncomplete: boolean;
  };
  totals?: {
    hospitalsListed: number;
    byRiskLevel: Record<RiskTier, number>;
    openSecurityIncidents: number;
    criticalOpenIncidents: number;
  };
  hospitals?: HospitalRow[];
  events?: ComplianceEvent[];
  error?: string;
}

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
      return 'text-slate bg-content-bg border border-content-border';
  }
}

function complianceLabel(band: ComplianceBand) {
  switch (band) {
    case 'aligned':
      return 'Aligned';
    case 'partial':
      return 'Partial';
    case 'at_risk':
      return 'At risk';
    default:
      return 'Not assessed';
  }
}

export default function SuperAdminCompliancePage() {
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async (opts?: { manual?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/compliance', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as CompliancePayload;
      if (!res.ok) {
        throw new Error(json.error || `Failed to load compliance (${res.status})`);
      }
      setData(json);
      if (opts?.manual) {
        setRefreshNotice('Compliance data refreshed');
        window.setTimeout(() => setRefreshNotice(null), 2500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load compliance');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markReviewed = async (auditLogId: string) => {
    setBusyId(auditLogId);
    setRowError((r) => ({ ...r, [auditLogId]: '' }));
    setRowMessage((r) => ({ ...r, [auditLogId]: '' }));
    try {
      const res = await fetch('/api/superadmin/compliance/review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setRowMessage((r) => ({ ...r, [auditLogId]: json.message ?? 'Recorded.' }));
      await load();
      window.setTimeout(() => {
        setRowMessage((r) => {
          const next = { ...r };
          delete next[auditLogId];
          return next;
        });
      }, 4000);
    } catch (e) {
      setRowError((r) => ({
        ...r,
        [auditLogId]: e instanceof Error ? e.message : 'Failed to record review',
      }));
    } finally {
      setBusyId(null);
    }
  };

  const totals = data?.totals;
  const scan = data?.scan;
  const hospitals = data?.hospitals ?? [];
  const events = data?.events ?? [];

  return (
    <PageLayout
      title="Compliance Command Center"
      subtitle="Multi-facility governance posture, unresolved high-risk audit activity (30d), and review workflow"
      actions={
        <button
          type="button"
          onClick={() => void load({ manual: true })}
          disabled={loading}
          className="p-2 rounded-lg bg-content-surface border border-content-border text-slate hover:text-ink hover:bg-content-bg transition-all shadow-card disabled:opacity-40"
          aria-label="Refresh compliance"
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
          <PageSection className="border-danger/40 bg-danger/5 py-4 px-4 bg-content-surface border-content-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-danger">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-card border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </PageSection>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['critical', 'high', 'medium', 'low'] as const).map((tier) => (
            <PageSection
              key={tier}
              className="!p-4 bg-content-surface border border-content-border"
              contentClassName="!p-0"
            >
              <p className="text-[10px] font-bold text-slate uppercase tracking-widest">{tier} risk</p>
              <p className="text-2xl font-semibold text-charcoal mt-1">
                {loading && !data ? '—' : (totals?.byRiskLevel?.[tier] ?? 0)}
              </p>
              <p className="text-xs text-slate mt-1">Facilities (sample)</p>
            </PageSection>
          ))}
        </div>

        <PageSection className="border-content-border bg-content-surface" contentClassName="!pt-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-charcoal">Unresolved signals</h2>
            <p className="text-sm text-slate mt-1">
              Open security incidents across listed hospitals, plus high-risk audit rows (last 30 days) not yet
              marked reviewed.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-card border border-content-border bg-content-bg p-4">
              <p className="text-xs text-slate flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-warning" />
                Unreviewed high-risk audits
              </p>
              <p className="text-2xl font-semibold text-charcoal mt-2">
                {loading && !data ? '—' : (scan?.unresolvedHighRiskInSample ?? 0)}
              </p>
              <p className="text-[11px] text-slate mt-1">
                of {scan?.totalHighRiskMatched30d ?? 0} matches (30d)
                {scan?.scanIncomplete ? ' · sample cap reached' : ''}
              </p>
            </div>
            <div className="rounded-card border border-content-border bg-content-bg p-4">
              <p className="text-xs text-slate">Open security incidents</p>
              <p className="text-2xl font-semibold text-charcoal mt-2">
                {loading && !data ? '—' : (totals?.openSecurityIncidents ?? 0)}
              </p>
            </div>
            <div className="rounded-card border border-content-border bg-content-bg p-4">
              <p className="text-xs text-slate">Open critical incidents</p>
              <p className="text-2xl font-semibold text-danger mt-2">
                {loading && !data ? '—' : (totals?.criticalOpenIncidents ?? 0)}
              </p>
            </div>
            <div className="rounded-card border border-content-border bg-content-bg p-4">
              <p className="text-xs text-slate">Hospitals in view</p>
              <p className="text-2xl font-semibold text-charcoal mt-2">
                {loading && !data ? '—' : (totals?.hospitalsListed ?? 0)}
              </p>
            </div>
          </div>
        </PageSection>

        {/* Hospitals table */}
        <PageSection
          className={cn(
            'overflow-hidden border-content-border bg-content-surface relative',
            loading && hospitals.length > 0 && 'opacity-70 pointer-events-none',
          )}
          contentClassName="!pt-2"
        >
          <div className="mb-4 px-2">
            <h2 className="text-lg font-semibold text-charcoal">Facility overview</h2>
            <p className="text-sm text-slate mt-1">
              Risk tier and control band per hospital (same governance engine as Hospitals).
            </p>
          </div>
          {loading && hospitals.length === 0 && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-content-surface/90 rounded-card">
              <div className="flex items-center gap-2 text-sm text-slate">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                Loading compliance overview…
              </div>
            </div>
          )}
          <div className="overflow-x-auto -mx-6 -mt-2">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-content-border bg-content-surface/60">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate uppercase tracking-widest">
                    Facility
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate uppercase tracking-widest">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate uppercase tracking-widest">
                    Controls
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate uppercase tracking-widest text-right">
                    Open / Crit.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-content-border">
                {!loading && hospitals.length === 0 && !error ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate">
                      No hospitals found.
                    </td>
                  </tr>
                ) : null}
                {hospitals.map((h) => {
                  const g = h.governance;
                  return (
                    <tr key={h.id} className="hover:bg-content-bg transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-charcoal">{h.name}</p>
                            <p className="text-[11px] text-slate">
                              {h.isActive ? 'Active' : 'Inactive'} · {h._count.profiles} staff ·{' '}
                              {h._count.patients} patients
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border',
                            riskTierStyles(g.riskLevel),
                          )}
                        >
                          {g.riskLevel}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
                            complianceStyles(g.complianceStatus),
                          )}
                        >
                          {complianceLabel(g.complianceStatus)}
                          {g.complianceImplementedPct != null
                            ? ` · ${g.complianceImplementedPct}%`
                            : ''}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-charcoal">
                        {g.openIncidents}
                        <span className="text-slate"> / </span>
                        <span className={g.criticalOpenIncidents > 0 ? 'text-danger' : ''}>
                          {g.criticalOpenIncidents}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PageSection>

        {/* High-risk events */}
        <PageSection className="border-content-border bg-content-surface" contentClassName="!pt-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-charcoal">Recent high-risk compliance events</h2>
            <p className="text-sm text-slate mt-1">
              PHI access, exports, denials, and related audit actions (30d). Marking reviewed appends
              COMPLIANCE_SUPERADMIN_REVIEW to the audit trail.
            </p>
          </div>
          <div className="space-y-3">
            {events.map((ev) => {
              const open = expanded === ev.id;
              return (
                <div
                  key={ev.id}
                  className="rounded-card border border-content-border bg-content-surface overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate">{new Date(ev.createdAt).toLocaleString()}</p>
                      <p className="text-sm font-semibold text-charcoal truncate">{ev.action}</p>
                      <p className="text-xs text-slate mt-1">
                        {ev.hospitalName ?? 'Unknown facility'}
                        {ev.actorEmail ? ` · ${ev.actorEmail}` : ''}
                      </p>
                      {ev.reviewed && (
                        <p className="text-[11px] text-success mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Reviewed
                          {ev.reviewedAt ? ` · ${new Date(ev.reviewedAt).toLocaleString()}` : ''}
                          {ev.reviewedByEmail ? ` · ${ev.reviewedByEmail}` : ''}
                        </p>
                      )}
                      {rowMessage[ev.id] && (
                        <p className="text-[11px] text-success mt-2">{rowMessage[ev.id]}</p>
                      )}
                      {rowError[ev.id] && (
                        <p className="text-[11px] text-danger mt-2">{rowError[ev.id]}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : ev.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-content-border bg-content-surface px-3 py-2 text-xs text-charcoal hover:bg-content-bg"
                      >
                        {open ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Hide detail
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> Detail
                          </>
                        )}
                      </button>
                      {!ev.reviewed && (
                        <button
                          type="button"
                          disabled={busyId === ev.id}
                          onClick={() => void markReviewed(ev.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-40"
                        >
                          {busyId === ev.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ClipboardList className="w-3.5 h-3.5" />
                          )}
                          Mark reviewed
                        </button>
                      )}
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-content-border px-4 py-3 bg-content-bg/70">
                      <pre className="text-[10px] text-success/90 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(
                          {
                            resourceType: ev.resourceType,
                            resourceId: ev.resourceId,
                            detail: ev.detail,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && events.length === 0 && !error && (
              <p className="text-sm text-slate text-center py-8">No high-risk compliance events in the window.</p>
            )}
          </div>
        </PageSection>

        {data?.generatedAt && (
          <p className="text-[11px] text-slate text-center">
            Snapshot {new Date(data.generatedAt).toLocaleString()}
            {data.windowDays != null ? ` · ${data.windowDays}d event window` : ''}
          </p>
        )}
      </div>
    </PageLayout>
  );
}
