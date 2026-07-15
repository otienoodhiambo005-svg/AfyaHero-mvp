'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, RefreshCw, Loader2, Server, Database, Cpu, HardDrive } from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import KPICard from '@/components/ui/KPICard';
import { cn } from '@/lib/utils';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  dbLatencyMs: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  activeConnections: number;
  lastChecked: string;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const statusColor = health?.status === 'healthy' ? 'text-emerald-500' : health?.status === 'warning' ? 'text-yellow-500' : 'text-red-500';

  return (
    <PageLayout
      title="System Health"
      subtitle="Monitor platform infrastructure and service status"
      actions={
        <button onClick={fetchHealth} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      }
    >
      {loading && !health ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : health ? (
        <>
          <PageSection title="Status">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="System Status"
                value={health.status.toUpperCase()}
                icon={Server}
              />
              <KPICard
                title="CPU Usage"
                value={`${health.cpuPercent}%`}
                icon={Cpu}
              />
              <KPICard
                title="Memory"
                value={`${health.memoryPercent}%`}
                icon={Database}
              />
              <KPICard
                title="Disk"
                value={`${health.diskPercent}%`}
                icon={HardDrive}
              />
            </div>
          </PageSection>

          <PageSection title="Details">
            <div className="rounded-card border border-content-border dark:border-gray-800 p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate">Database Latency</span>
                <span className="font-medium text-ink">{health.dbLatencyMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Active Connections</span>
                <span className="font-medium text-ink">{health.activeConnections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Uptime</span>
                <span className="font-medium text-ink">{Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Last Checked</span>
                <span className="font-medium text-ink">{new Date(health.lastChecked).toLocaleTimeString()}</span>
              </div>
            </div>
          </PageSection>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Unable to load system health data</p>
        </div>
      )}
    </PageLayout>
  );
}
