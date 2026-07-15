'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Search, RefreshCw, Shield } from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  hospitalId?: string;
  approved: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  medical: 'text-emerald-400 bg-emerald-400/10',
  admin: 'text-blue-400 bg-blue-400/10',
  lab: 'text-purple-400 bg-purple-400/10',
  pharmacy: 'text-orange-400 bg-orange-400/10',
  reception: 'text-cyan-400 bg-cyan-400/10',
  super_admin: 'text-red-400 bg-red-400/10',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users ?? []);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed to load users (${res.status})`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <PageLayout
      title="User Management"
      subtitle="Manage platform users across all facilities"
      actions={
        <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      }
    >
      <PageSection title="Search">
        <div className="flex items-center gap-2 bg-content-bg dark:bg-gray-900 border border-content-border dark:border-gray-800 rounded-lg px-3 py-2 max-w-md">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="bg-transparent text-sm outline-none flex-1 text-ink placeholder:text-slate"
          />
        </div>
      </PageSection>

      <PageSection title={`Users (${filtered.length})`}>
        {loading ? (
          <LoadingState title="Loading users" />
        ) : error ? (
          <ErrorState
            title="Could not load users"
            description={error}
            onRetry={fetchUsers}
            retryLabel="Retry"
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-content-border bg-content-bg p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-ink font-medium">No users found</p>
            <p className="text-sm text-slate">Try adjusting your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-content-border dark:border-gray-800">
                  <th className="text-left py-3 px-2 font-semibold text-slate">Name</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate">Email</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate">Role</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-content-surface dark:hover:bg-gray-800/30">
                    <td className="py-3 px-2 font-medium text-ink">{u.name}</td>
                    <td className="py-3 px-2 text-slate">{u.email}</td>
                    <td className="py-3 px-2">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', ROLE_COLORS[u.role] ?? 'text-gray-400 bg-gray-400/10')}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {u.approved ? (
                        <StatusBadge tone="success" size="sm" dot>Approved</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning" size="sm" dot>Pending</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageLayout>
  );
}
