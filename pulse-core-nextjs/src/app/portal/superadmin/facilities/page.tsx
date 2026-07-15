'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, ChevronDown, Loader2, MapPin, Phone, Mail,
  User, Stethoscope, RefreshCw, Filter, Plus
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FacilityApplication {
  id: string;
  facilityName: string;
  facilityType: string;
  ownership: string;
  county: string;
  subCounty?: string | null;
  phone: string;
  facilityEmail: string;
  mflCode?: string | null;
  shifAccepted: boolean;
  adminName: string;
  adminTitle?: string | null;
  adminEmail: string;
  adminPhone?: string | null;
  services: string[];
  insurances: string[];
  bedCount?: number | null;
  operatingHours?: string | null;
  status: 'pending_approval' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string | null;
}

type StatusFilter = 'pending_approval' | 'approved' | 'rejected' | 'all';

const FACILITY_TYPE_LABELS: Record<string, string> = {
  county_referral:  'County Referral Hospital',
  sub_county:       'Sub-County Hospital',
  health_centre:    'Health Centre',
  dispensary:       'Dispensary / Clinic',
  private_hospital: 'Private Hospital',
  faith_based:      'Faith-Based Hospital',
  nursing_home:     'Nursing Home / Maternity',
  specialist_clinic:'Specialist Clinic',
};

const OWNERSHIP_LABELS: Record<string, string> = {
  public:      'Government / County',
  private:     'Private',
  faith_based: 'Faith-Based (FBO)',
  ngo:         'NGO / CBO',
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: FacilityApplication['status'] }) {
  const cfg = {
    pending_approval: { label: 'Pending Review', cls: 'bg-warning/15 text-warning border-warning/30', icon: Clock },
    approved:         { label: 'Approved',        cls: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
    rejected:         { label: 'Rejected',        cls: 'bg-danger/15 text-danger border-danger/30', icon: XCircle },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', cfg.cls)}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({
  open, onClose, onConfirm, title, description, loading,
  confirmLabel, confirmVariant, reason, onReasonChange,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  loading: boolean;
  confirmLabel: string;
  confirmVariant: 'approve' | 'reject';
  reason?: string;
  onReasonChange?: (val: string) => void;
}) {
  if (!open) return null;
  const isReject = confirmVariant === 'reject';
  const isSubmitDisabled = loading || (isReject && !reason?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-card p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6">{description}</p>

        {isReject && onReasonChange && (
          <div className="mb-6 space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Rejection Reason <span className="text-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Incomplete MFL documentation..."
              className="w-full h-24 bg-gray-800 border border-gray-700 rounded-card p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-red-500 transition-all resize-none"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-card border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitDisabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-card text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              confirmVariant === 'approve'
                ? 'bg-success hover:bg-success/90'
                : 'bg-danger hover:bg-danger/90',
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Application detail panel ─────────────────────────────────────────────────
function ApplicationCard({
  app,
  onApprove,
  onReject,
  actionLoading,
}: {
  app: FacilityApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actionLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLoading = actionLoading === app.id;

  return (
    <div className={cn(
      'bg-gray-900 border rounded-card overflow-hidden transition-all',
      app.status === 'pending_approval' ? 'border-warning/20' : 'border-gray-800',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between p-5 gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Icon */}
          <div className={cn(
            'w-11 h-11 rounded-card flex items-center justify-center shrink-0 border',
            app.status === 'pending_approval'
              ? 'bg-warning/10 border-warning/25'
              : app.status === 'approved'
              ? 'bg-success/10 border-success/25'
              : 'bg-danger/10 border-danger/25',
          )}>
            <Building2 className={cn(
              'w-5 h-5',
              app.status === 'pending_approval' ? 'text-warning' :
              app.status === 'approved' ? 'text-success' : 'text-danger',
            )} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white truncate">{app.facilityName}</h3>
              <StatusBadge status={app.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">
                {FACILITY_TYPE_LABELS[app.facilityType] ?? app.facilityType}
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-400">{OWNERSHIP_LABELS[app.ownership] ?? app.ownership}</span>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="w-3 h-3" /> {app.county}{app.subCounty ? `, ${app.subCounty}` : ''}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Submitted {relativeTime(app.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {app.status === 'pending_approval' && (
            <>
              <button
                onClick={() => onReject(app.id)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-all text-xs font-semibold disabled:opacity-40"
              >
                Reject
              </button>
              <button
                onClick={() => onApprove(app.id)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white transition-all text-xs font-bold disabled:opacity-40"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Approve'}
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-all"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 p-5 grid gap-5 sm:grid-cols-2">
          {/* Facility contact */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facility Contact</p>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Phone className="w-3.5 h-3.5 text-gray-500" /> {app.phone}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Mail className="w-3.5 h-3.5 text-gray-500" /> {app.facilityEmail}
            </div>
            {app.mflCode && (
              <div className="text-xs text-gray-400">Reg. No: <span className="text-white font-mono">{app.mflCode}</span></div>
            )}
            <div className="text-xs text-gray-400">
              SHIF / SHA: <span className={app.shifAccepted ? 'text-success' : 'text-gray-500'}>
                {app.shifAccepted ? 'Accepted ✓' : 'Not applicable'}
              </span>
            </div>
            {app.bedCount && (
              <div className="text-xs text-gray-400">Beds: <span className="text-white">{app.bedCount}</span></div>
            )}
            {app.operatingHours && (
              <div className="text-xs text-gray-400">Hours: <span className="text-white">{app.operatingHours}</span></div>
            )}
          </div>

          {/* Administrator */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Administrator</p>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <User className="w-3.5 h-3.5 text-gray-500" /> {app.adminName}
              {app.adminTitle && <span className="text-gray-500">· {app.adminTitle}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Mail className="w-3.5 h-3.5 text-gray-500" /> {app.adminEmail}
            </div>
            {app.adminPhone && (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <Phone className="w-3.5 h-3.5 text-gray-500" /> {app.adminPhone}
              </div>
            )}
          </div>

          {/* Services */}
          {app.services.length > 0 && (
            <div className="sm:col-span-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> Services
              </p>
              <div className="flex flex-wrap gap-1.5">
                {app.services.map((s) => (
                  <span key={s} className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
              {app.insurances && app.insurances.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-3">Insurance Accepted</p>
                  <div className="flex flex-wrap gap-1.5">
                    {app.insurances.map((i) => (
                      <span key={i} className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px]">
                        {i}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Rejection reason if rejected */}
          {app.status === 'rejected' && app.rejectReason && (
            <div className="sm:col-span-2 bg-danger/5 border border-danger/15 rounded-card p-3 text-xs text-danger">
              <span className="font-semibold">Rejection note: </span>{app.rejectReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FacilityApplicationsPage() {
  const [applications, setApplications] = useState<FacilityApplication[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pending_approval');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject';
    applicationId: string;
    facilityName: string;
    reason: string;
  }>({ open: false, type: 'approve', applicationId: '', facilityName: '', reason: '' });

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/facilities?status=${filter}`);
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json() as { applications: FacilityApplication[] };
      setApplications(data.applications);
    } catch {
      setError('Could not load applications. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  // Counts for tabs
  const [counts, setCounts] = useState<Record<StatusFilter, number>>({
    pending_approval: 0, approved: 0, rejected: 0, all: 0,
  });

  useEffect(() => {
    // Load counts for all statuses in background
    void (async () => {
      try {
        const res = await fetch('/api/admin/facilities?status=all');
        if (!res.ok) return;
        const data = await res.json() as { applications: FacilityApplication[] };
        const all = data.applications;
        setCounts({
          pending_approval: all.filter(a => a.status === 'pending_approval').length,
          approved:         all.filter(a => a.status === 'approved').length,
          rejected:         all.filter(a => a.status === 'rejected').length,
          all:              all.length,
        });
      } catch { /* silent */ }
    })();
  }, [applications]); // re-count when applications state changes

  const handleApprove = (id: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    setConfirmDialog({ open: true, type: 'approve', applicationId: id, facilityName: app.facilityName, reason: '' });
  };

  const handleReject = (id: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    setConfirmDialog({ open: true, type: 'reject', applicationId: id, facilityName: app.facilityName, reason: '' });
  };

  const handleConfirm = async () => {
    const { applicationId, type } = confirmDialog;
    setActionLoading(applicationId);
    try {
      const endpoint = type === 'approve'
        ? `/api/admin/facilities/${applicationId}/approve`
        : `/api/admin/facilities/${applicationId}/reject`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: type === 'reject' ? JSON.stringify({ reason: confirmDialog.reason }) : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Action failed');
      }
      setConfirmDialog(d => ({ ...d, open: false }));
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setConfirmDialog(d => ({ ...d, open: false }));
    } finally {
      setActionLoading(null);
    }
  };

  // Filter by search
  const filtered = applications.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.facilityName.toLowerCase().includes(q) ||
      a.county.toLowerCase().includes(q) ||
      a.adminEmail.toLowerCase().includes(q) ||
      a.adminName.toLowerCase().includes(q)
    );
  });

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: 'pending_approval', label: 'Pending' },
    { key: 'approved',         label: 'Approved' },
    { key: 'rejected',         label: 'Rejected' },
    { key: 'all',              label: 'All'      },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Facility Applications
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve hospitals applying to join the AfyaHero platform
          </p>
        </div>
        <button
          onClick={() => void loadApplications()}
          className="flex items-center gap-2 px-4 py-2 rounded-card border border-content-border dark:border-gray-700 text-gray-500 hover:text-ink dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-500 transition-all text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <Link
          href="/portal/superadmin/facilities/register"
          className="flex items-center gap-2 px-4 py-2 rounded-card bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all text-sm font-bold"
        >
          <Plus className="w-4 h-4" />
          Add Facility
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-danger/5 border border-danger/20 text-danger rounded-card p-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-card p-1 gap-1 border border-content-border dark:border-gray-800">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                filter === tab.key
                  ? 'bg-content-bg dark:bg-gray-800 text-ink dark:text-white shadow-card'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                  tab.key === 'pending_approval'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                )}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by facility, county, or admin…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-card border border-content-border dark:border-gray-800 bg-content-bg dark:bg-gray-900 text-sm text-ink dark:text-white placeholder:text-gray-400 outline-none focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {filter === 'pending_approval' && counts.pending_approval > 0 && (
        <div className="flex items-center gap-3 p-3 bg-warning/5 border border-warning/15 rounded-card">
          <Clock className="w-4 h-4 text-warning shrink-0" />
          <p className="text-sm text-warning">
            <strong>{counts.pending_approval}</strong> {counts.pending_approval === 1 ? 'application is' : 'applications are'} waiting for your review.
          </p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Filter className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {search ? 'No applications match your search.' : 'No applications in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <ApplicationCard
              key={app.id}
              app={app}
              onApprove={handleApprove}
              onReject={handleReject}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(d => ({ ...d, open: false, reason: '' }))}
        onConfirm={() => void handleConfirm()}
        loading={actionLoading === confirmDialog.applicationId}
        confirmVariant={confirmDialog.type}
        reason={confirmDialog.reason}
        onReasonChange={(reason) => setConfirmDialog(d => ({ ...d, reason }))}
        title={
          confirmDialog.type === 'approve'
            ? `Approve ${confirmDialog.facilityName}?`
            : `Reject ${confirmDialog.facilityName}?`
        }
        description={
          confirmDialog.type === 'approve'
            ? `This will create the administrator account and send an account activation email. The facility will gain access to AfyaHero.`
            : `The application will be marked as rejected. Please provide a reason to help the applicant understand the decision.`
        }
        confirmLabel={confirmDialog.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
      />
    </div>
  );
}
