'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RefreshCw, Save, Link2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import OutbreakDetectionPanel from '@/components/admin/OutbreakDetectionPanel';

type FeedRole = 'all' | 'reception' | 'medical' | 'lab' | 'pharmacy' | 'admin';

type FeedSource = {
  id: string;
  name: string;
  url: string;
  role: FeedRole;
  region_codes: string[];
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type NewSourceForm = {
  name: string;
  url: string;
  role: FeedRole;
  regions: string;
  priority: number;
  enabled: boolean;
};

const ACCENT = '#3B82F6';

const ROLE_OPTIONS: FeedRole[] = ['all', 'reception', 'medical', 'lab', 'pharmacy', 'admin'];

const INITIAL_FORM: NewSourceForm = {
  name: '',
  url: '',
  role: 'all',
  regions: 'KE',
  priority: 70,
  enabled: true,
};

function toRegionArray(regionsCsv: string): string[] {
  return regionsCsv
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

export default function AdminHealthFeedSourcesPage(): React.ReactElement {
  const [items, setItems] = useState<FeedSource[]>([]);
  const [form, setForm] = useState<NewSourceForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/health-feeds', { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load feed sources');
      }

      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed sources');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  const activeCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);
  const showConfigHint = Boolean(error && error.toLowerCase().includes('missing supabase configuration'));

  async function onCreateSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/health-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          role: form.role,
          priority: form.priority,
          region_codes: toRegionArray(form.regions),
          enabled: form.enabled,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create feed source');
      }

      setSuccess('Feed source created successfully.');
      setForm(INITIAL_FORM);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create feed source');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleEnabled(item: FeedSource) {
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/admin/health-feeds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, enabled: !item.enabled }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || 'Failed to update source');
      return;
    }

    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, enabled: !item.enabled } : entry)),
    );
    setSuccess(`Source ${item.enabled ? 'disabled' : 'enabled'} successfully.`);
  }

  async function onDelete(id: string) {
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/admin/health-feeds?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || 'Failed to delete source');
      return;
    }

    setItems((current) => current.filter((entry) => entry.id !== id));
    setSuccess('Source deleted successfully.');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Health Feed Source Manager</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure trusted online sources for role-specific health updates across all dashboards.
          </p>
        </div>
        <button
          onClick={() => void loadItems()}
          className="inline-flex items-center gap-2 rounded-card border border-content-border bg-content-bg px-4 py-2 text-sm font-semibold text-slate-700 shadow-card transition-colors hover:bg-content-surface"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Sources</p>
          <p className="mt-2 text-3xl font-bold text-ink">{items.length}</p>
        </div>
        <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Active</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Security</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Allowlist + Priority
          </p>
        </div>
      </div>

      {/* Epidemiological Intelligence - Desktop/Tablet Optimized */}
      <OutbreakDetectionPanel />

      <form onSubmit={onCreateSource} className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Add Feed Source</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Source Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="WHO Alerts"
              className="w-full rounded-card border border-content-border px-3 py-2 text-ink focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-2">
            <span className="font-medium text-slate-700">Feed URL</span>
            <input
              required
              type="url"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://example.org/feed.xml"
              className="w-full rounded-card border border-content-border px-3 py-2 text-ink focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Role</span>
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as FeedRole }))}
              className="w-full rounded-card border border-content-border px-3 py-2 text-ink focus:outline-none"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Region Codes (CSV)</span>
            <input
              value={form.regions}
              onChange={(event) => setForm((prev) => ({ ...prev, regions: event.target.value }))}
              placeholder="KE,UG,TZ"
              className="w-full rounded-card border border-content-border px-3 py-2 text-ink focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Priority (1-100)</span>
            <input
              min={1}
              max={100}
              type="number"
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value || 70) }))}
              className="w-full rounded-card border border-content-border px-3 py-2 text-ink focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enabled
          </label>

          <button
            type="submit"
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 rounded-card px-4 py-2 text-sm font-semibold text-white transition-opacity',
              saving && 'opacity-70',
            )}
            style={{ backgroundColor: ACCENT }}
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving...' : 'Add Source'}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {showConfigHint && (
        <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          System configuration is incomplete. Contact platform support to resolve.
        </div>
      )}
      {success && (
        <div className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      <div className="rounded-card border border-content-border bg-content-bg shadow-card">
        <div className="border-b border-content-border px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">Configured Sources</h2>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-slate-500">Loading feed sources...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">No feed sources configured yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-content-border bg-content-surface/80">
                  {['Name', 'URL', 'Role', 'Regions', 'Priority', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-content-border/50">
                    <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-ink"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span className="max-w-[360px] truncate">{item.url}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-600">{item.role}</td>
                    <td className="px-4 py-3 text-slate-600">{(item.region_codes || []).join(', ') || 'ALL'}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{item.priority}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void onToggleEnabled(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-content-border bg-content-bg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-content-surface"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {item.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => void onDelete(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
