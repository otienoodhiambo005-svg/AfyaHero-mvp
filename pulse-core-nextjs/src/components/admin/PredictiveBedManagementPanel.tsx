'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bed, Clock, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Info, Users, Activity, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface BedPrediction {
  bedId: string;
  ward: string;
  bedNumber: string;
  currentPatient?: string;
  predictedDischargeTime: string;
  dischargeProbability: number;
  recommendedAction: 'maintain' | 'prepare' | 'allocate';
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

interface WardCapacity {
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  predictedDischarges24h: number;
  predictedAdmissions24h: number;
  projectedCapacity24h: number;
  utilizationRate: number;
}

interface PredictiveBedManagementPanelProps {
  className?: string;
}

export default function PredictiveBedManagementPanel({ className }: PredictiveBedManagementPanelProps) {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<BedPrediction[]>([]);
  const [wardCapacity, setWardCapacity] = useState<WardCapacity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/beds/predictive-management');
      if (!response.ok) {
        throw new Error('Failed to fetch bed predictions');
      }
      const data = await response.json();
      setPredictions(data.predictions || []);
      setWardCapacity(data.wardCapacity || []);
    } catch (err) {
      logger.error('Failed to fetch bed predictions', { error: err });
      setPredictions([]);
      setWardCapacity([]);
      setError('Live predictions unavailable. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
    // Refresh every 15 minutes for bed management
    const interval = setInterval(fetchPredictions, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);


  const actionColors = {
    maintain: 'bg-[#E8F4FB] border-[#89C4E8] text-[#0F4C75]',
    prepare: 'bg-[#FEF3C7] border-[#F59E0B] text-[#713F12]',
    allocate: 'bg-[#D5EDF8] border-[#3282B8] text-[#0F4C75]'
  };

  const actionBadge = {
    maintain: 'bg-[#3282B8] text-white',
    prepare: 'bg-[#F59E0B] text-white',
    allocate: 'bg-[#3282B8] text-white'
  };

  const priorityColors = {
    low: 'bg-[#D5EDF8] text-[#0F4C75]',
    medium: 'bg-[#FEF3C7] text-[#713F12]',
    high: 'bg-[#FEE2E2] text-[#7F1D1D]'
  };

  return (
    <div className={cn('rounded-2xl border border-content-border bg-content-bg p-6 shadow-card', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3282B8]/10 to-[#0F4C75]/10 text-[#3282B8] shadow-sm">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Bed className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-ink">Predictive Bed Management</h3>
            <p className="text-sm text-slate">AI-powered bed allocation & discharge timing predictions</p>
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

      {/* Ward Capacity Overview */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3282B8]/10 text-[#3282B8]">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-ink">24-Hour Capacity Forecast</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {wardCapacity.map((ward) => (
            <div
              key={ward.wardName}
              className={cn('rounded-xl border p-5 transition-all hover:shadow-lg hover:scale-[1.01]',
                ward.projectedCapacity24h > ward.totalBeds * 0.9 ? 'bg-gradient-to-br from-[#FEE2E2] to-white border-[#EF4444]' :
                ward.projectedCapacity24h > ward.totalBeds * 0.7 ? 'bg-gradient-to-br from-[#FEF3C7] to-white border-[#F59E0B]' :
                'bg-gradient-to-br from-[#D5EDF8] to-white border-[#89C4E8]'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-base">{ward.wardName}</span>
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold',
                  ward.utilizationRate > 90 ? 'bg-[#EF4444] text-white' :
                  ward.utilizationRate > 80 ? 'bg-[#F59E0B] text-white' :
                  'bg-[#3282B8] text-white'
                )}>
                  {ward.utilizationRate}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Current</span>
                  <span className="font-medium">{ward.occupiedBeds}/{ward.totalBeds}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Available</span>
                  <span className="font-semibold text-ink">{ward.availableBeds}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Discharges (24h)</span>
                  <span className="font-semibold text-[#3282B8]">-{ward.predictedDischarges24h}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Admissions (24h)</span>
                  <span className="font-semibold text-[#EF4444]">+{ward.predictedAdmissions24h}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-current/20 pt-2">
                  <span className="text-slate">Projected</span>
                  <span className="text-ink">{ward.projectedCapacity24h}/{ward.totalBeds}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bed Predictions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold">Individual Bed Predictions</span>
        </div>
        <div className="space-y-2">
          {predictions.map((prediction) => (
            <div
              key={prediction.bedId}
              className={cn('rounded-lg border p-4 transition-all hover:shadow-md', actionColors[prediction.recommendedAction])}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{prediction.ward} - {prediction.bedNumber}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', actionBadge[prediction.recommendedAction])}>
                      {prediction.recommendedAction}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', priorityColors[prediction.priority])}>
                      {prediction.priority}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Current Patient</p>
                      <p className="text-sm font-semibold">{prediction.currentPatient || 'Available'}</p>
                    </div>
                    {prediction.predictedDischargeTime && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Predicted Discharge</p>
                        <p className="text-sm font-semibold">{new Date(prediction.predictedDischargeTime).toLocaleString()}</p>
                      </div>
                    )}
                    {prediction.dischargeProbability > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Discharge Probability</p>
                        <p className="text-sm font-bold">{prediction.dischargeProbability}%</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Recommendation</p>
                      <p className="text-sm font-semibold">{prediction.recommendedAction}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate">{prediction.reason}</p>
                </div>

                {prediction.recommendedAction === 'allocate' && (
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3282B8] hover:bg-[#2A6E9E] text-white text-sm font-semibold transition-colors">
                    Allocate
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Recommendations */}
      <div className="mt-4 pt-4 border-t border-current/20">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">AI Recommendations</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-sm">Prepare discharge documentation for patients with &gt;85% discharge probability</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p className="text-sm">ICU projected at 90% capacity - consider escalation protocols</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
            <Users className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            <p className="text-sm">Medical ward expecting high admissions - prioritize bed turnover</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
            <Bed className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
            <p className="text-sm">5 beds available for immediate allocation across all wards</p>
          </div>
        </div>
      </div>
    </div>
  );
}
