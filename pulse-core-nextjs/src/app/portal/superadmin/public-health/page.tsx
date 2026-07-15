/**
 * Public Health Insights Dashboard
 * Aggregate anonymised hospital data for super administrators
 * No individual patient data is exposed
 */
'use client';

import { useEffect, useState } from 'react';
import KPICard from '@/components/ui/KPICard';
import PageLayout from '@/components/ui/PageLayout';
import {
  HeartPulse,
  Activity,
  AlertTriangle,
  Stethoscope,
  Pill,
  Users,
  BedDouble,
} from 'lucide-react';

interface PublicHealthStats {
  totalPatientVisits: number;
  averageOccupancyRate: number;
  activeCovidCases: number;
  averageWaitTimeMinutes: number;
  prescriptionFillRate: number;
  labTurnaroundHours: number;
  diseaseTrends: Array<{
    condition: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export default function PublicHealthInsightsPage() {
  const [stats, setStats] = useState<PublicHealthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch('/api/admin/public-health/insights');
        const data = await response.json();
        setStats(data);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <PageLayout title="Public Health Insights">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-card" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Public Health Insights">
      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Data shown is anonymised aggregate statistics only. No individual patient records are available.</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KPICard
            title="Total Patient Visits"
            value={stats?.totalPatientVisits?.toLocaleString() || 0}
            icon={Users}
            trend={{ value: 5.2, label: 'vs last month' }}
          />
          <KPICard
            title="Average Hospital Occupancy"
            value={`${stats?.averageOccupancyRate || 0}%`}
            icon={BedDouble}
            trend={{ value: 0, label: 'stable' }}
          />
          <KPICard
            title="Average Wait Time"
            value={`${stats?.averageWaitTimeMinutes || 0} min`}
            icon={Activity}
            trend={{ value: -8, label: 'vs last month' }}
          />
          <KPICard
            title="Prescription Fill Rate"
            value={`${stats?.prescriptionFillRate || 0}%`}
            icon={Pill}
            trend={{ value: 3.4, label: 'vs last month' }}
          />
          <KPICard
            title="Lab Turnaround Time"
            value={`${stats?.labTurnaroundHours || 0}h`}
            icon={Stethoscope}
            trend={{ value: -12, label: 'vs last month' }}
          />
          <KPICard
            title="Active COVID Cases"
            value={stats?.activeCovidCases || 0}
            icon={HeartPulse}
            trend={{ value: -24, label: 'vs last month' }}
          />
        </div>

        <div className="bg-content-bg dark:bg-gray-900 rounded-card p-6 border border-content-border dark:border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Disease Trends (National)</h3>
          <div className="space-y-3">
            {stats?.diseaseTrends?.map((trend, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-content-surface dark:bg-gray-800/50 rounded-lg">
                <span className="font-medium">{trend.condition}</span>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold">{trend.count.toLocaleString()}</span>
                  <span className={`text-sm font-medium ${
                    trend.trend === 'up' ? 'text-red-500' :
                    trend.trend === 'down' ? 'text-green-500' :
                    'text-gray-500'
                  }`}>
                    {trend.trend === 'up' ? '↑ Rising' :
                     trend.trend === 'down' ? '↓ Falling' :
                     '→ Stable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}