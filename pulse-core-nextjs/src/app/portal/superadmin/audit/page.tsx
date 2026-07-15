'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  Activity,
  Info,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditLog {
  id: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  actorId?: string | null;
  ipAddress?: string | null;
  detail: unknown;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'FACILITY_REGISTRATION_SUBMITTED': { label: 'Application Submitted', color: 'text-blue-400 bg-blue-400/10' },
  'FACILITY_APPROVED': { label: 'Facility Approved', color: 'text-emerald-400 bg-emerald-400/10' },
  'FACILITY_REJECTED': { label: 'Facility Rejected', color: 'text-red-400 bg-red-400/10' },
  'USER_LOGIN': { label: 'User Login', color: 'text-purple-400 bg-purple-400/10' },
  'USER_LOGOUT': { label: 'User Logout', color: 'text-slate bg-content-bg' },
  'DATA_EXPORT': { label: 'Data Exported', color: 'text-amber-400 bg-amber-400/10' },
};

// ─── Helper components ────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string | number | boolean | null }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex justify-between py-1 border-b border-content-border last:border-0">
      <span className="text-slate font-medium">{label}</span>
      <span className="text-charcoal text-right">{String(value)}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(
    async (opts?: { isManualRefresh?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
        });
        if (actionFilter !== 'all') params.set('action', actionFilter);
        if (debouncedSearch) params.set('q', debouncedSearch);

        const res = await fetch(`/api/superadmin/audit-logs?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as {
          logs?: AuditLog[];
          pagination?: Pagination;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `Failed to load audit logs (${res.status})`);
        }
        setLogs(data.logs ?? []);
        setPagination(data.pagination ?? null);
        if (opts?.isManualRefresh) {
          setRefreshNotice('Audit log refreshed');
          window.setTimeout(() => setRefreshNotice(null), 2500);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audit logs';
        setError(message);
        logger.error('Failed to load audit logs', { error: err });
      } finally {
        setLoading(false);
      }
    },
    [page, actionFilter, debouncedSearch],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const relativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  };

  return (
    <PageLayout 
      title="Audit Trail" 
      subtitle="Complete history of critical system actions and administrator operations"
      actions={
        <button 
          type="button"
          onClick={() => fetchLogs({ isManualRefresh: true })}
          disabled={loading}
          className="p-2 rounded-lg bg-content-surface border border-content-border text-slate hover:text-ink hover:bg-content-bg transition-all shadow-card disabled:opacity-40"
          title="Refresh logs"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      }
    >
      <div className="space-y-6">
        {refreshNotice && (
          <div className="rounded-card border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {refreshNotice}
          </div>
        )}
        {error && (
          <ErrorState
            title="Could not load audit logs"
            description={error}
            onRetry={fetchLogs}
            retryLabel="Retry"
          />
        )}
        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search by User ID or Resource ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-content-surface border border-content-border rounded-card py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-slate focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-content-surface border border-content-border rounded-card px-3 py-1">
            <Filter className="w-4 h-4 text-slate" />
            <select 
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm text-charcoal outline-none pr-8 appearance-none cursor-pointer py-1.5"
            >
              <option value="all">All Actions</option>
              <option value="FACILITY_REGISTRATION_SUBMITTED">Registrations</option>
              <option value="FACILITY_APPROVED">Approvals</option>
              <option value="FACILITY_REJECTED">Rejections</option>
              <option value="USER_LOGIN">Logins</option>
              <option value="DATA_EXPORT">Exports</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <PageSection className={cn('overflow-hidden border-content-border bg-content-surface relative', loading && logs.length > 0 && 'opacity-70 pointer-events-none')}>
          {loading && logs.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-content-surface/90">
              <LoadingState title="Loading audit trail" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-content-border bg-content-surface/60">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate uppercase tracking-widest">Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate uppercase tracking-widest">Action</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate uppercase tracking-widest">Resource</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-content-border">
                  {!loading && logs.length === 0 && !error ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12">
                        <div className="flex flex-col items-center text-center">
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <FileText className="h-5 w-5" />
                          </div>
                          <p className="text-ink font-medium">No logs found</p>
                          <p className="text-sm text-slate">Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {logs.map((log) => {
                      const actionInfo = ACTION_LABELS[log.action] || { label: log.action.replaceAll('_', ' '), color: 'text-slate bg-content-bg' };
                    return (
                      <tr key={log.id} className="hover:bg-content-bg transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-charcoal">{relativeTime(log.createdAt)}</span>
                            <span className="text-[10px] text-slate font-mono">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase", actionInfo.color)}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-slate" />
                            <span className="text-xs text-slate">{log.resourceType ?? '—'}</span>
                            {log.resourceId && (
                              <span className="px-1.5 py-0.5 rounded bg-content-bg border border-content-border text-[10px] text-slate font-mono">
                                id:{log.resourceId.slice(0, 8)}…
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
                          >
                            <Info className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-content-border bg-content-surface/50">
              <span className="text-xs text-slate">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-content-border text-slate hover:bg-content-bg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  disabled={page === pagination.totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-content-border text-slate hover:bg-content-bg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </PageSection>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <button 
            type="button"
            className="absolute inset-0 bg-black/80" 
            onClick={() => setSelectedLog(null)} 
          />
          <div className="relative bg-content-surface border border-content-border rounded-card w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-content-border bg-content-surface/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-charcoal">Log Entry Details</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate hover:text-ink transition-colors"
              >
                <ChevronDown className="w-6 h-6 rotate-180" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate uppercase tracking-widest">Action</p>
                  <p className="text-sm text-charcoal">{selectedLog.action}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate uppercase tracking-widest">Resource Type</p>
                  <p className="text-sm text-charcoal font-mono">{selectedLog.resourceType ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate uppercase tracking-widest">Actor ID</p>
                  <p className="text-xs text-slate font-mono break-all">{selectedLog.actorId || 'System'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate uppercase tracking-widest">IP Address</p>
                  <p className="text-xs text-slate font-mono">{selectedLog.ipAddress || 'Internal'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate uppercase tracking-widest">Structured Data</p>
                <div className="bg-content-bg border border-content-border rounded-card p-4 overflow-x-auto">
                  <pre className="text-[10px] text-emerald-400 leading-relaxed font-mono">
                    {JSON.stringify(selectedLog.detail ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-content-border bg-content-surface/50 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-card bg-charcoal hover:bg-portal-primary text-white text-sm font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
