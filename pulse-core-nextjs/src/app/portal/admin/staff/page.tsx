'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Search, UserPlus, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import InviteStaffModal from '@/components/portal/InviteStaffModal';

type StaffStatus = 'active' | 'pending' | 'suspended' | 'rejected';
// Hospital admin must never see or assign the platform-level super_admin role.
type StaffRole = 'admin' | 'medical' | 'reception' | 'lab' | 'pharmacy';

interface StaffUser {
  id: string;
  fullName: string;
  role: StaffRole;
  department?: string | null;
  email: string;
  staffId?: string | null;
  status: StaffStatus;
  createdAt: string;
}

interface ApiResponse {
  users: StaffUser[];
  pendingApprovals: StaffUser[];
}

const STATUS_STYLES: Record<StaffStatus, string> = {
  active: 'bg-success/5 text-success border-success/20',
  pending: 'bg-warning/5 text-warning border-warning/20',
  suspended: 'bg-danger/5 text-danger border-danger/20',
  rejected: 'bg-slate-200 text-slate-600 border-content-border',
};

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Hospital Admin',
  medical: 'Medical',
  reception: 'Reception',
  lab: 'Laboratory',
  pharmacy: 'Pharmacy',
};

// Defensive filter: exclude any super_admin records that the API may return.
function excludeSuperAdmins<T extends { role: string }>(users: T[]): T[] {
  return users.filter((u) => u.role !== 'super_admin');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StaffManagementPage() {
  const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users?limit=100');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to load staff');
      }
      const body = (await res.json()) as ApiResponse;
      setAllUsers(excludeSuperAdmins(body.users ?? []));
      setPendingApprovals(excludeSuperAdmins(body.pendingApprovals ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((user) =>
      user.fullName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.department ?? '').toLowerCase().includes(q) ||
      (user.staffId ?? '').toLowerCase().includes(q),
    );
  }, [allUsers, search]);

  const counts = useMemo(() => {
    return {
      total: allUsers.length,
      pending: allUsers.filter((u) => u.status === 'pending').length,
      active: allUsers.filter((u) => u.status === 'active').length,
      suspended: allUsers.filter((u) => u.status === 'suspended').length,
      rejected: allUsers.filter((u) => u.status === 'rejected').length,
    };
  }, [allUsers]);

  const handleApprovalAction = useCallback(async (userId: string, action: 'approve_staff' | 'reject_staff') => {
    setActionUserId(userId);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
          reason: action === 'reject_staff' ? 'Rejected by hospital administrator' : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to ${action === 'approve_staff' ? 'approve' : 'reject'} request`);
      }

      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval action failed');
    } finally {
      setActionUserId(null);
    }
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Staff Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Hospital-scoped staff directory and approval queue</p>
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-card text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          <UserPlus className="w-4 h-4" />
          Invite Staff
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Total', counts.total],
          ['Pending', counts.pending],
          ['Active', counts.active],
          ['Suspended', counts.suspended],
          ['Rejected', counts.rejected],
        ].map(([label, value]) => (
          <div key={label} className="bg-content-bg border border-content-border rounded-card p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-card border border-danger/20 bg-danger/5 text-danger text-sm px-4 py-3">
          {error}
        </div>
      )}
      {actionError && (
        <div className="rounded-card border border-danger/20 bg-danger/5 text-danger text-sm px-4 py-3">
          {actionError}
        </div>
      )}

      <section className="bg-content-bg border border-content-border rounded-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            Pending Approval
          </h2>
          <span className="text-xs font-semibold text-warning bg-warning/5 border border-warning/20 px-2 py-0.5 rounded-full">
            {pendingApprovals.length} awaiting hospital admin action
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <p className="text-sm text-slate-500">No pending staff registrations.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingApprovals.map((pending) => (
              <div key={pending.id} className="border border-content-border rounded-card p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{pending.fullName}</p>
                    <p className="text-xs text-slate-500">{ROLE_LABELS[pending.role]}{pending.department ? ` · ${pending.department}` : ''}</p>
                    <p className="text-xs text-slate-500">{pending.email}</p>
                    {pending.staffId && <p className="text-xs text-slate-500">Staff ID: {pending.staffId}</p>}
                  </div>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold', STATUS_STYLES.pending)}>
                    Pending
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Submitted {formatDate(pending.createdAt)}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApprovalAction(pending.id, 'approve_staff')}
                    disabled={actionUserId === pending.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-success text-white text-xs font-semibold hover:bg-success/90 disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprovalAction(pending.id, 'reject_staff')}
                    disabled={actionUserId === pending.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-danger/20 bg-danger/5 text-danger text-xs font-semibold hover:bg-danger/10 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-content-bg border border-content-border rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-content-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Staff Directory</h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, staff ID..."
              className="w-full border border-content-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading staff…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-content-surface border-b border-content-border">
                  {['Name', 'Role', 'Email', 'Status', 'Joined'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-content-border/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{user.fullName}</p>
                      {user.department && <p className="text-xs text-slate-500">{user.department}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{ROLE_LABELS[user.role]}</td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold', STATUS_STYLES[user.status])}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No staff records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <InviteStaffModal isOpen={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
    </div>
  );
}
