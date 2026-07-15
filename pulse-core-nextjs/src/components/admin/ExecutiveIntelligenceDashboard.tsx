'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, Activity, AlertTriangle, CheckCircle2, Loader2, Info, BarChart3, Target, Zap, Calendar, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveMetric {
  id: string;
  name: string;
  currentValue: number;
  previousValue: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  status: 'on-track' | 'at-risk' | 'critical';
  category: 'financial' | 'operational' | 'clinical' | 'strategic';
  unit: string;
  confidence: number;
}

interface Forecast {
  period: string;
  projectedRevenue: number;
  projectedPatientVolume: number;
  projectedStaffing: number;
  riskFactors: string[];
  opportunities: string[];
}

interface StrategicInsight {
  id: string;
  category: 'growth' | 'efficiency' | 'risk' | 'innovation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  recommendedActions: string[];
}

interface ExecutiveIntelligenceDashboardProps {
  className?: string;
}

export default function ExecutiveIntelligenceDashboard({ className }: ExecutiveIntelligenceDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ExecutiveMetric[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [insights, setInsights] = useState<StrategicInsight[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutiveData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/executive/intelligence');
      if (!response.ok) {
        throw new Error('Failed to fetch executive data');
      }
      const data = await response.json();
      setMetrics(data.metrics || []);
      setForecasts(data.forecasts || []);
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executive data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutiveData();
    // Refresh every hour for executive dashboard
    const interval = setInterval(fetchExecutiveData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchExecutiveData]);

  const statusColors = {
    'on-track': 'bg-[#D5EDF8] border-[#89C4E8] text-[#0F4C75]',
    'at-risk': 'bg-[#FEF3C7] border-[#F59E0B] text-[#713F12]',
    'critical': 'bg-[#FEE2E2] border-[#EF4444] text-[#7F1D1D]'
  };

  const statusBadge = {
    'on-track': 'bg-[#3282B8] text-white',
    'at-risk': 'bg-[#F59E0B] text-white',
    'critical': 'bg-[#EF4444] text-white'
  };

  const categoryColors = {
    financial: 'bg-[#D5EDF8] text-[#0F4C75]',
    operational: 'bg-[#E8F4FB] text-[#0F4C75]',
    clinical: 'bg-[#BBE1FA] text-[#0F4C75]',
    strategic: 'bg-[#89C4E8] text-[#0F4C75]'
  };

  const categoryIcon = {
    financial: <DollarSign className="h-4 w-4" />,
    operational: <Activity className="h-4 w-4" />,
    clinical: <Users className="h-4 w-4" />,
    strategic: <Target className="h-4 w-4" />
  };

  const insightColors = {
    growth: 'bg-[#D5EDF8] border-[#89C4E8]',
    efficiency: 'bg-[#E8F4FB] border-[#3282B8]',
    risk: 'bg-[#FEE2E2] border-[#EF4444]',
    innovation: 'bg-[#BBE1FA] border-[#0F4C75]'
  };

  return (
    <div className={cn('rounded-2xl border border-content-border bg-content-bg p-6 shadow-card', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3282B8]/10 to-[#0F4C75]/10 text-[#3282B8] shadow-sm">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <BarChart3 className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-ink">Executive Intelligence Dashboard</h3>
            <p className="text-sm text-slate">Predictive KPIs, forecasting & strategic insights</p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-[#FEF3C7] border border-[#F59E0B] px-4 py-2 text-sm text-[#713F12] flex items-center gap-2">
            <Info className="h-4 w-4" />
            Fallback
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] px-4 py-3 text-sm text-[#713F12]">
          {error}
        </div>
      )}

      {/* Executive Metrics */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3282B8]/10 text-[#3282B8]">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-ink">Key Performance Indicators</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className={cn('rounded-xl border p-5 transition-all hover:shadow-lg hover:scale-[1.01] bg-gradient-to-br from-white to-content-surface', statusColors[metric.status])}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn('rounded-lg p-2', categoryColors[metric.category])}>
                    {categoryIcon[metric.category]}
                  </div>
                  <span className="font-semibold text-base">{metric.name}</span>
                </div>
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusBadge[metric.status])}>
                  {metric.status}
                </span>
              </div>
              
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-ink">
                  {metric.unit === 'KES' ? 'KES ' : ''}
                  {metric.currentValue.toLocaleString()}
                  {metric.unit !== 'KES' && metric.unit !== 'patients' && metric.unit !== 'days' ? metric.unit : ''}
                </span>
                <div className="flex items-center gap-1">
                  {metric.trend === 'up' ? (
                    <TrendingUp className={cn('h-4 w-4', metric.category === 'clinical' && metric.name.includes('Length') ? 'text-[#3282B8]' : 'text-[#3282B8]')} />
                  ) : metric.trend === 'down' ? (
                    <TrendingDown className={cn('h-4 w-4', metric.category === 'clinical' && metric.name.includes('Length') ? 'text-[#3282B8]' : 'text-[#EF4444]')} />
                  ) : (
                    <Activity className="h-4 w-4 text-[#4A6B7A]" />
                  )}
                  <span className={cn('text-xs font-semibold',
                    metric.trend === 'up' ? 'text-[#3282B8]' :
                    metric.trend === 'down' ? 'text-[#EF4444]' :
                    'text-[#4A6B7A]'
                  )}>
                    {metric.trendPercentage}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate mb-2">
                <span>Target: {metric.target.toLocaleString()}{metric.unit === '%' ? '%' : metric.unit}</span>
                <span>Confidence: {Math.round(metric.confidence * 100)}%</span>
              </div>

              {/* Progress to target */}
              <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                <div 
                  className={cn('h-full rounded-full transition-all',
                    metric.status === 'on-track' ? 'bg-[#3282B8]' :
                    metric.status === 'at-risk' ? 'bg-[#F59E0B]' :
                    'bg-[#EF4444]'
                  )}
                  style={{ width: `${Math.min((metric.currentValue / metric.target) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Forecast */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-semibold">Quarterly Forecast</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {forecasts.map((forecast) => (
            <div key={forecast.period} className="rounded-xl border border-content-border bg-content-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{forecast.period}</span>
                <span className="text-xs text-slate">Projected</span>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Revenue</span>
                  <span className="font-bold">KES {(forecast.projectedRevenue / 1000000).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Patients</span>
                  <span className="font-bold">{forecast.projectedPatientVolume.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Staffing</span>
                  <span className="font-bold">{forecast.projectedStaffing}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold mb-1 text-rose-700">Risk Factors</p>
                  {forecast.riskFactors.slice(0, 2).map((risk, idx) => (
                    <p key={idx} className="text-xs flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      {risk}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1 text-emerald-700">Opportunities</p>
                  {forecast.opportunities.slice(0, 2).map((opportunity, idx) => (
                    <p key={idx} className="text-xs flex items-start gap-1">
                      <Zap className="h-3 w-3 shrink-0 mt-0.5" />
                      {opportunity}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4" />
          <span className="text-sm font-semibold">Strategic AI Insights</span>
        </div>
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={cn('rounded-xl border p-4 transition-all hover:shadow-md', insightColors[insight.category])}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{insight.title}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',
                      insight.impact === 'high' ? 'bg-[#EF4444] text-white' :
                      insight.impact === 'medium' ? 'bg-[#F59E0B] text-white' :
                      'bg-[#4A6B7A] text-white'
                    )}>
                      {insight.impact} impact
                    </span>
                    <span className="text-xs text-slate">{insight.timeframe}</span>
                  </div>
                  <p className="text-sm mb-3">{insight.description}</p>
                  <div>
                    <p className="text-xs font-semibold mb-2">Recommended Actions</p>
                    <div className="space-y-1">
                      {insight.recommendedActions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded-lg bg-white/50 p-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                          <span className="text-sm">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Award className="h-6 w-6" />
                  <span className="text-xs font-semibold capitalize">{insight.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
