'use client';

import { useEffect, useState } from 'react';
import { 
  AlertTriangle, HeartPulse, Clock, Coffee, 
  ShieldCheck, TrendingUp, Activity, Flame,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface BurnoutRiskScore {
  overall: number;
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: {
    workload: { score: number; label: string; recommendation: string };
    schedule: { score: number; label: string; recommendation: string };
    recovery: { score: number; label: string; recommendation: string };
  };
  alerts: string[];
  recommendations: string[];
  immediateActions: string[];
}

const levelColors = {
  low: 'bg-emerald-500',
  moderate: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const levelBgColors = {
  low: 'bg-emerald-50 border-emerald-200',
  moderate: 'bg-amber-50 border-amber-200',
  high: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200',
};

export function BurnoutMonitor() {
  const [riskScore, setRiskScore] = useState<BurnoutRiskScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadBurnoutRisk();
    const interval = setInterval(loadBurnoutRisk, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadBurnoutRisk = async () => {
    try {
      const response = await fetch('/api/wellness/burnout-risk');
      if (response.ok) {
        const data = await response.json();
        setRiskScore(data.riskScore);
      }
    } catch (error) {
      logger.error('Failed to load burnout risk', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !riskScore || dismissed) return null;

  // Only show if risk is moderate or higher
  if (riskScore.level === 'low') return null;

  return (
    <div className={cn(
      'fixed top-4 right-4 z-50 w-96 rounded-xl border shadow-2xl p-4',
      levelBgColors[riskScore.level]
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', levelColors[riskScore.level])}>
            {riskScore.level === 'critical' ? (
              <AlertTriangle className="w-5 h-5 text-white" />
            ) : (
              <HeartPulse className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-ink">Burnout Risk Alert</h3>
            <p className="text-xs text-slate">Level: {riskScore.level.toUpperCase()}</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/50 rounded-lg transition-colors"
        >
          <XCircle className="w-4 h-4 text-slate" />
        </button>
      </div>

      {/* Risk Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate">Overall Risk Score</span>
          <span className="text-2xl font-bold text-ink">{riskScore.overall}%</span>
        </div>
        <div className="w-full bg-white rounded-full h-2 overflow-hidden">
          <div
            className={cn('h-full transition-all duration-500', levelColors[riskScore.level])}
            style={{ width: `${riskScore.overall}%` }}
          />
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-slate" />
            <span className="text-slate">Workload</span>
          </div>
          <span className="font-medium text-ink">{riskScore.factors.workload.label}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-slate" />
            <span className="text-slate">Schedule</span>
          </div>
          <span className="font-medium text-ink">{riskScore.factors.schedule.label}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Coffee className="w-3 h-3 text-slate" />
            <span className="text-slate">Recovery</span>
          </div>
          <span className="font-medium text-ink">{riskScore.factors.recovery.label}</span>
        </div>
      </div>

      {/* Immediate Actions */}
      {riskScore.immediateActions.length > 0 && (
        <div className="mb-4 p-3 bg-white/50 rounded-lg border border-white">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-semibold text-orange-900">Immediate Actions</span>
          </div>
          <ul className="space-y-1">
            {riskScore.immediateActions.map((action, idx) => (
              <li key={idx} className="text-xs text-slate flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {riskScore.recommendations.length > 0 && (
        <div className="p-3 bg-white/50 rounded-lg border border-white">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-900">Recommendations</span>
          </div>
          <ul className="space-y-1">
            {riskScore.recommendations.map((rec, idx) => (
              <li key={idx} className="text-xs text-slate flex items-start gap-2">
                <span className="text-emerald-600">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => {
          // Open wellness resources or take a break
          window.open('/wellness/resources', '_blank');
        }}
        className="mt-4 w-full py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-ink hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
      >
        <HeartPulse className="w-4 h-4" />
        View Wellness Resources
      </button>
    </div>
  );
}
