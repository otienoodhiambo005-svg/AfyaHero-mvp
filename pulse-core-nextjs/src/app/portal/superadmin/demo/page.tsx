/**
 * Superadmin Demo Management
 * Generate and manage demo sessions for hospital showcases
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Sparkles, Clock, Building2, Mail, Trash2, Eye } from 'lucide-react';
import PageLayout from '@/components/ui/PageLayout';
import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import type { PortalRole } from '@/types';

interface DemoSession {
  id: string;
  createdAt: string;
  createdBy: string;
  role: PortalRole;
  hospitalName: string;
  prospectEmail: string | null;
  prospectName?: string | null;
  expiresAt: string;
  revokedAt: string | null;
  useCount: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
}

const PORTAL_LABELS: Record<PortalRole, string> = {
  reception: 'Reception',
  medical: 'Medical',
  lab: 'Laboratory',
  pharmacy: 'Pharmacy',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const PORTAL_STYLES: Record<PortalRole, string> = {
  reception: 'border-warning text-warning',
  medical: 'border-primary text-primary',
  lab: 'border-violet-500 text-violet-600',
  pharmacy: 'border-success text-success',
  admin: 'border-danger text-danger',
  super_admin: 'border-portal-primary text-portal-primary',
};

export default function DemoManagementPage() {
  const [recentDemos, setRecentDemos] = useState<DemoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    role: 'reception' as PortalRole,
    hospitalName: '',
    prospectEmail: '',
  });
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchRecentDemos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/demo/token');
      if (res.ok) {
        const data = await res.json();
        setRecentDemos(data.recentDemos || []);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to load demo sessions');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecentDemos();
  }, [fetchRecentDemos]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const res = await fetch('/api/superadmin/demo/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedToken(data.showcaseUrl);
        void fetchRecentDemos();
      }
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this demo session? Prospects will lose access immediately.')) return;
    const res = await fetch(`/api/superadmin/demo/token/${id}`, { method: 'DELETE' });
    if (res.ok) {
      void fetchRecentDemos();
    }
  };

  const statusFor = (demo: DemoSession): { label: string; tone: StatusTone } => {
    if (demo.revokedAt) return { label: 'Revoked', tone: 'danger' };
    if (new Date(demo.expiresAt).getTime() < Date.now()) return { label: 'Expired', tone: 'neutral' };
    if (demo.useCount > 0) return { label: 'Active', tone: 'success' };
    return { label: 'Pending', tone: 'warning' };
  };

  return (
    <PageLayout
      title="Demo Management"
      subtitle="Generate showcase sessions for prospective hospitals"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate Demo Token */}
        <div className="bg-content-bg border border-content-border rounded-card p-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Generate Demo Session</h2>
              <p className="text-sm text-slate">Create a time-limited showcase access</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Portal to Showcase
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as PortalRole })}
                className="w-full px-3 py-2 bg-content-surface border border-content-border rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(PORTAL_LABELS)
                  .filter(([role]) => role !== 'super_admin')
                  .map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Hospital/Facility Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
                <input
                  type="text"
                  value={formData.hospitalName}
                  onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                  placeholder="e.g., Nairobi West Hospital"
                  className="w-full pl-10 pr-3 py-2 bg-content-surface border border-content-border rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Prospect Email (optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
                <input
                  type="email"
                  value={formData.prospectEmail}
                  onChange={(e) => setFormData({ ...formData, prospectEmail: e.target.value })}
                  placeholder="prospect@hospital.com"
                  className="w-full pl-10 pr-3 py-2 bg-content-surface border border-content-border rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={generating || !formData.hospitalName}
              className="w-full py-2.5 px-4 bg-primary text-white rounded-control font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Demo Session
                </>
              )}
            </button>
          </form>

          {generatedToken && (
            <div className="mt-6 p-4 bg-success/5 border border-success/20 rounded-lg relative">
              <button
                type="button"
                onClick={() => setGeneratedToken(null)}
                className="absolute top-2 right-2 p-1.5 text-success/60 hover:text-success hover:bg-success/10 rounded"
                aria-label="Dismiss"
              >
                <span aria-hidden className="text-lg leading-none">&times;</span>
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-success" />
                <span className="font-medium text-success">Demo session created!</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}${generatedToken}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-content-bg border border-success/20 rounded text-sm text-success"
                />
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}${generatedToken}`)}
                  className="p-2 bg-success/10 text-success rounded hover:bg-success/20 transition-colors"
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={generatedToken}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-success/10 text-success rounded hover:bg-success/20 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="mt-2 text-xs text-success">
                Share this URL with the prospect. Session expires in 4 hours.
              </p>
            </div>
          )}
        </div>

        {/* Recent Demo Sessions */}
        <div className="bg-content-bg border border-content-border rounded-card p-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">Recent Demo Sessions</h2>
                <p className="text-sm text-slate">Last 7 days of showcase activity</p>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState title="Loading recent demos" />
          ) : error ? (
            <ErrorState
              title="Could not load sessions"
              description={error}
              onRetry={fetchRecentDemos}
              retryLabel="Retry"
            />
          ) : recentDemos.length === 0 ? (
            <div className="rounded-card border border-content-border bg-content-bg p-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Eye className="h-5 w-5" />
              </div>
              <p className="text-ink font-medium">No demo sessions yet</p>
              <p className="text-sm text-slate">Generate your first demo to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentDemos.map((demo) => {
                const status = statusFor(demo);
                const canRevoke = !demo.revokedAt && new Date(demo.expiresAt).getTime() > Date.now();
                return (
                  <div
                    key={demo.id}
                    className="p-4 bg-content-surface rounded-lg border border-content-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${PORTAL_STYLES[demo.role]}`}
                          >
                            {PORTAL_LABELS[demo.role]}
                          </span>
                          <StatusBadge tone={status.tone} size="sm" dot>
                            {status.label}
                          </StatusBadge>
                          <span className="text-xs text-slate">
                            {new Date(demo.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-medium text-ink truncate">{demo.hospitalName}</p>
                        {demo.prospectEmail && demo.prospectEmail !== 'anonymous' && (
                          <p className="text-sm text-slate truncate">{demo.prospectEmail}</p>
                        )}
                        <p className="mt-1 text-xs text-slate">
                          {demo.useCount > 0
                            ? `${demo.useCount} use${demo.useCount === 1 ? '' : 's'} • last ${
                                demo.lastUsedAt ? new Date(demo.lastUsedAt).toLocaleString() : '—'
                              }`
                            : 'Not yet used'}
                          {' • expires '}
                          {new Date(demo.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      {canRevoke && (
                        <button
                          onClick={() => handleRevoke(demo.id)}
                          className="shrink-0 p-2 text-danger hover:bg-danger/5 rounded transition-colors"
                          title="Revoke demo session"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Demo Features Guide */}
      <div className="mt-8 bg-gradient-to-r from-primary/5 to-portal-primary/5 border border-primary/20 rounded-card p-card">
        <h3 className="font-semibold text-ink mb-4">Demo Showcase Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-content-bg rounded-lg border border-primary/10">
            <h4 className="font-medium text-ink mb-2">Time-Limited Access</h4>
            <p className="text-sm text-slate">
              Demo sessions automatically expire after 4 hours to ensure security.
            </p>
          </div>
          <div className="p-4 bg-content-bg rounded-lg border border-primary/10">
            <h4 className="font-medium text-ink mb-2">Full Portal Experience</h4>
            <p className="text-sm text-slate">
              Prospects can explore all features of the selected portal with realistic demo data.
            </p>
          </div>
          <div className="p-4 bg-content-bg rounded-lg border border-primary/10">
            <h4 className="font-medium text-ink mb-2">Audit Trail</h4>
            <p className="text-sm text-slate">
              All demo sessions are logged for compliance and follow-up tracking.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
