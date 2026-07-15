'use client';

import { useMemo } from 'react';
import { Building2, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from './StatusBadge';

interface TenantStatus {
  id: string;
  name: string;
  county: string;
  status: 'active' | 'onboarding' | 'suspended' | 'critical';
  users: number;
  lastActivity: string;
}

interface TenantHeatmapProps {
  tenants: TenantStatus[];
  className?: string;
  onFilterByStatus?: (status: string) => void;
}

const META = {
  active: { label: 'Active', tone: 'success' as const, icon: CheckCircle2 },
  onboarding: { label: 'Onboarding', tone: 'info' as const, icon: Clock },
  suspended: { label: 'Suspended', tone: 'warning' as const, icon: Ban },
  critical: { label: 'Critical', tone: 'danger' as const, icon: AlertTriangle },
};

export function TenantHeatmap({ tenants, className, onFilterByStatus }: TenantHeatmapProps) {
  const stats = useMemo(() => {
    const byStatus = { active: 0, onboarding: 0, suspended: 0, critical: 0 };
    const byCounty: Record<string, number> = {};
    for (const t of tenants) {
      byStatus[t.status]++;
      byCounty[t.county] = (byCounty[t.county] || 0) + 1;
    }
    return { byStatus, byCounty, total: tenants.length };
  }, [tenants]);

  const topCounties = useMemo(
    () => Object.entries(stats.byCounty).sort((a, b) => b[1] - a[1]).slice(0, 5),
    [stats.byCounty],
  );

  return (
    <div className={cn('rounded-card border border-content-border bg-content-bg shadow-card', className)}>
      <div className="px-5 py-4 border-b border-content-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-portal-primary" />
          <h3 className="text-base font-semibold text-ink">Tenant Landscape</h3>
        </div>
        <span className="text-xs text-slate">{stats.total} facilities</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {Object.entries(META).map(([key, meta]) => {
          const count = stats.byStatus[key as keyof typeof META];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              onClick={() => onFilterByStatus?.(key)}
              className="text-left rounded-lg border border-content-border bg-content-surface p-3 hover:border-mist transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-slate" />
                <StatusBadge tone={meta.tone} size="sm">{meta.label}</StatusBadge>
              </div>
              <p className="text-2xl font-bold text-ink">{count}</p>
              <p className="text-[11px] text-slate">
                {((count / Math.max(stats.total, 1)) * 100).toFixed(0)}% of total
              </p>
            </button>
          );
        })}
      </div>

      {topCounties.length > 0 && (
        <div className="px-4 pb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate mb-2">Top Counties</h4>
          <div className="space-y-2">
            {topCounties.map(([county, count]) => {
              const pct = (count / stats.total) * 100;
              return (
                <div key={county} className="flex items-center gap-3">
                  <span className="text-sm text-charcoal w-32 truncate">{county}</span>
                  <div className="flex-1 h-2 bg-content-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-portal-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate tabular-nums w-10 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-content-border px-4 py-3 flex items-center justify-between text-xs text-slate">
        <span>Click any card to filter hospitals</span>
        <span>{stats.total > 0 ? `${stats.total} facilities tracked` : 'No tenant data available'}</span>
      </div>
    </div>
  );
}

export default TenantHeatmap;
