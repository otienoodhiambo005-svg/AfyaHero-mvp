'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, AlertTriangle, CheckCircle2, Shield, Loader2, Info, BarChart3, Users, Clock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface QualityMetric {
  id: string;
  name: string;
  category: 'clinical' | 'operational' | 'safety' | 'compliance';
  currentValue: number;
  targetValue: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
  status: 'on-track' | 'at-risk' | 'critical';
  benchmark: number;
  outlier: boolean;
  recommendations: string[];
}

interface OutlierAlert {
  id: string;
  metric: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedPatients?: number;
  actionRequired: string;
}

interface QualityIntelligenceDashboardProps {
  className?: string;
}

export default function QualityIntelligenceDashboard({ className }: QualityIntelligenceDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [alerts, setAlerts] = useState<OutlierAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchQualityData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/quality/intelligence');
      if (!response.ok) {
        throw new Error('Failed to fetch quality data');
      }
      const data = await response.json();
      setMetrics(data.metrics || []);
      setAlerts(data.alerts || []);
    } catch (err) {
      logger.error('Failed to fetch quality data', { error: err });
      setMetrics([]);
      setAlerts([]);
      setError('Live quality data unavailable. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQualityData();
    // Refresh every 30 minutes
    const interval = setInterval(fetchQualityData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchQualityData]);


  const statusColors = {
    'on-track': 'bg-emerald-50 border-emerald-200 text-emerald-900',
    'at-risk': 'bg-amber-50 border-amber-200 text-amber-900',
    'critical': 'bg-rose-50 border-rose-200 text-rose-900'
  };

  const statusBadge = {
    'on-track': 'bg-emerald-500 text-white',
    'at-risk': 'bg-amber-500 text-white',
    'critical': 'bg-rose-500 text-white'
  };

  const trendIcon = {
    improving: <TrendingUp className="h-4 w-4 text-emerald-600" />,
    stable: <Activity className="h-4 w-4 text-slate-600" />,
    declining: <TrendingUp className="h-4 w-4 text-rose-600 rotate-180" />
  };

  const categoryColors = {
    clinical: 'bg-blue-100 text-blue-700',
    operational: 'bg-purple-100 text-purple-700',
    safety: 'bg-rose-100 text-rose-700',
    compliance: 'bg-amber-100 text-amber-700'
  };

  return (
    <div className={cn('rounded-2xl border border-content-border bg-content-bg p-5 shadow-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-ink">Quality Intelligence Dashboard</h3>
            <p className="text-xs text-slate">Real-time compliance monitoring & outlier detection</p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs text-amber-800 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Fallback
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">On Track</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{metrics.filter(m => m.status === 'on-track').length}</span>
            <span className="text-sm text-slate">of {metrics.length}</span>
          </div>
        </div>

        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">At Risk</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{metrics.filter(m => m.status === 'at-risk').length}</span>
            <span className="text-sm text-slate">metrics</span>
          </div>
        </div>

        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">Critical</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{metrics.filter(m => m.status === 'critical').length}</span>
            <span className="text-sm text-slate">metrics</span>
          </div>
        </div>

        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">Outliers</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{metrics.filter(m => m.outlier).length}</span>
            <span className="text-sm text-slate">detected</span>
          </div>
        </div>
      </div>

      {/* Outlier Alerts */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span className="text-sm font-semibold">Outlier Alerts</span>
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'rounded-lg border p-3',
                  alert.severity === 'high' ? 'bg-rose-50 border-rose-200' :
                  alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{alert.metric}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',
                        alert.severity === 'high' ? 'bg-rose-500 text-white' :
                        alert.severity === 'medium' ? 'bg-amber-500 text-white' :
                        'bg-blue-500 text-white'
                      )}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm">{alert.description}</p>
                    {alert.affectedPatients && (
                      <p className="text-xs mt-1 text-slate">{alert.affectedPatients} patients affected</p>
                    )}
                    <p className="text-xs mt-2 font-medium">{alert.actionRequired}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality Metrics Grid */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4" />
          <span className="text-sm font-semibold">Quality Metrics</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className={cn('rounded-xl border p-4 transition-all hover:shadow-md', statusColors[metric.status])}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{metric.name}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', categoryColors[metric.category])}>
                      {metric.category}
                    </span>
                    {metric.outlier && (
                      <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-xs font-semibold">
                        Outlier
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {trendIcon[metric.trend]}
                    <span className="text-xs">{metric.trendPercentage}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{metric.currentValue}</span>
                    <span className="text-xs text-slate">/ {metric.targetValue}</span>
                  </div>
                  <span className={cn('text-xs', metric.status === 'on-track' ? 'text-emerald-600' : metric.status === 'at-risk' ? 'text-amber-600' : 'text-rose-600')}>
                    {metric.status === 'on-track' ? 'On track' : metric.status === 'at-risk' ? 'At risk' : 'Critical'}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate">Current</span>
                  <span className="text-slate">Benchmark: {metric.benchmark}</span>
                </div>
                <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all',
                      metric.status === 'on-track' ? 'bg-emerald-500' :
                      metric.status === 'at-risk' ? 'bg-amber-500' :
                      'bg-rose-500'
                    )}
                    style={{ width: `${Math.min((metric.currentValue / metric.targetValue) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Recommendations */}
              {metric.recommendations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Recommendations</p>
                  {metric.recommendations.slice(0, 2).map((rec, idx) => (
                    <p key={idx} className="text-xs flex items-start gap-1">
                      <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                      {rec}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Peer Comparison */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" />
          <span className="text-sm font-semibold">Peer Comparison</span>
        </div>
        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate mb-1">Your Hospital</p>
              <p className="text-2xl font-bold text-ink">82%</p>
              <p className="text-xs text-slate">Overall quality score</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate mb-1">Regional Average</p>
              <p className="text-2xl font-bold text-slate">78%</p>
              <p className="text-xs text-slate">Peer hospitals</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate mb-1">National Benchmark</p>
              <p className="text-2xl font-bold text-slate">85%</p>
              <p className="text-xs text-slate">Target standard</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
