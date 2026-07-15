'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Loader2, Search, Filter, ChevronDown } from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import { cn } from '@/lib/utils';

interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  facilityId?: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-blue-400 bg-blue-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  high: 'text-orange-400 bg-orange-400/10',
  critical: 'text-red-400 bg-red-400/10',
};

export default function ErrorMonitoringPage() {
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security-events?type=error');
      if (res.ok) {
        const data = await res.json();
        setErrors(Array.isArray(data) ? data : data.events ?? []);
      }
    } catch {
      // Graceful fallback — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const filtered = filter === 'all' ? errors : errors.filter(e => e.severity === filter);
  const criticalCount = errors.filter(e => e.severity === 'critical' && !e.resolved).length;

  return (
    <PageLayout
      title="Error Monitoring"
      subtitle="Track and resolve application errors across all facilities"
      actions={
        <button onClick={fetchErrors} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      }
    >
      <PageSection title="Filters">
        <div className="flex items-center gap-3 flex-wrap">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          {criticalCount > 0 && (
            <span className="text-xs font-bold text-red-500 ml-2">{criticalCount} unresolved critical</span>
          )}
        </div>
      </PageSection>

      <PageSection title="Recent Errors">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No errors recorded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(err => (
              <div key={err.id} className="rounded-card border border-content-border dark:border-gray-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{err.message}</p>
                    <p className="text-xs text-slate mt-1">{new Date(err.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', SEVERITY_COLORS[err.severity] ?? SEVERITY_COLORS.low)}>
                    {err.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </PageLayout>
  );
}
