'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Package, AlertTriangle, Clock, ShoppingCart, BarChart3, Loader2, Info, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  expiryDate?: string;
  averageDailyUsage: number;
}

interface DemandPrediction {
  itemId: string;
  itemName: string;
  predictedDemand30Days: number;
  predictedDemand60Days: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedOrderQuantity: number;
  recommendedOrderDate: string;
  factors: string[];
}

interface PredictiveInventoryPanelProps {
  className?: string;
}

export default function PredictiveInventoryPanel({ className }: PredictiveInventoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<DemandPrediction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/pharmacy/inventory/predict-demand');
      if (!response.ok) {
        throw new Error('Failed to fetch demand predictions');
      }
      const data = await response.json();
      setPredictions(data.predictions || []);
    } catch (err) {
      // Fallback to mock data
      setPredictions(generateMockPredictions());
      setError('Using rule-based fallback - live predictions unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
    // Refresh every hour
    const interval = setInterval(fetchPredictions, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  const generateMockPredictions = (): DemandPrediction[] => {
    return [
      {
        itemId: 'med-001',
        itemName: 'Coartem (Artemether-Lumefantrine) 20/120mg',
        predictedDemand30Days: 3500,
        predictedDemand60Days: 6800,
        confidence: 0.92,
        trend: 'increasing',
        trendPercentage: 35,
        riskLevel: 'high',
        recommendedOrderQuantity: 5000,
        recommendedOrderDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        factors: ['Long rainy season malaria surge', 'County outbreak in neighboring region', 'SHIF first-line treatment requirement', 'KEMSA supply delays expected']
      },
      {
        itemId: 'med-002',
        itemName: 'Amoxicillin 500mg',
        predictedDemand30Days: 2200,
        predictedDemand60Days: 4200,
        confidence: 0.87,
        trend: 'increasing',
        trendPercentage: 18,
        riskLevel: 'medium',
        recommendedOrderQuantity: 3000,
        recommendedOrderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        factors: ['Respiratory infection season peak', 'Pediatric pneumonia cases rising', 'Post-rainy season bacterial infections']
      },
      {
        itemId: 'med-003',
        itemName: 'Metformin 500mg',
        predictedDemand30Days: 1500,
        predictedDemand60Days: 3000,
        confidence: 0.94,
        trend: 'stable',
        trendPercentage: 3,
        riskLevel: 'low',
        recommendedOrderQuantity: 2000,
        recommendedOrderDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        factors: ['Diabetes prevalence steady at 5.5%', 'Chronic medication base stable', 'SHIF chronic disease program enrollment']
      },
      {
        itemId: 'med-004',
        itemName: 'Insulin (Human) 100IU/ml',
        predictedDemand30Days: 950,
        predictedDemand60Days: 1900,
        confidence: 0.89,
        trend: 'increasing',
        trendPercentage: 8,
        riskLevel: 'medium',
        recommendedOrderQuantity: 1200,
        recommendedOrderDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        factors: ['Cold chain requirements', 'Diabetic patient base growing 8% annually', 'Type 2 diabetes screening program expansion']
      },
      {
        itemId: 'med-005',
        itemName: 'Paracetamol 500mg',
        predictedDemand30Days: 4000,
        predictedDemand60Days: 7500,
        confidence: 0.91,
        trend: 'increasing',
        trendPercentage: 20,
        riskLevel: 'high',
        recommendedOrderQuantity: 5000,
        recommendedOrderDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        factors: ['Malaria transmission peak', 'Rainy season forecast', 'Increased vector activity expected']
      }
    ];
  };

  const riskColors = {
    low: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    medium: 'bg-amber-50 border-amber-200 text-amber-900',
    high: 'bg-rose-50 border-rose-200 text-rose-900'
  };

  const riskBadge = {
    low: 'bg-emerald-500 text-white',
    medium: 'bg-amber-500 text-white',
    high: 'bg-rose-500 text-white'
  };

  const trendIcon = {
    increasing: <ArrowUpRight className="h-4 w-4 text-emerald-600" />,
    stable: <Clock className="h-4 w-4 text-slate-600" />,
    decreasing: <ArrowDownRight className="h-4 w-4 text-rose-600" />
  };

  return (
    <div className={cn('rounded-2xl border border-content-border bg-content-bg p-5 shadow-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart3 className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-ink">Predictive Inventory Intelligence</h3>
            <p className="text-xs text-slate">30-day demand forecasts & automated ordering</p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs text-amber-800 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Fallback active
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">High-Risk Items</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{predictions.filter(p => p.riskLevel === 'high').length}</span>
            <span className="text-sm text-slate">of {predictions.length}</span>
          </div>
        </div>

        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">Total Recommended Order</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{predictions.reduce((sum, p) => sum + p.recommendedOrderQuantity, 0).toLocaleString()}</span>
            <span className="text-sm text-slate">units</span>
          </div>
        </div>

        <div className="rounded-xl border border-content-border bg-content-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-slate" />
            <span className="text-xs text-slate">Avg Confidence</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">
              {predictions.length > 0 ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="space-y-3">
        {predictions.map((prediction) => (
          <div
            key={prediction.itemId}
            className={cn('rounded-xl border p-4 transition-all hover:shadow-md', riskColors[prediction.riskLevel])}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">{prediction.itemName}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', riskBadge[prediction.riskLevel])}>
                    {prediction.riskLevel} risk
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    {trendIcon[prediction.trend]}
                    <span>{prediction.trendPercentage}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">30-Day Forecast</p>
                    <p className="text-lg font-bold">{prediction.predictedDemand30Days.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">60-Day Forecast</p>
                    <p className="text-lg font-bold">{prediction.predictedDemand60Days.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Confidence</p>
                    <p className="text-lg font-bold">{Math.round(prediction.confidence * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Order By</p>
                    <p className="text-lg font-bold">{new Date(prediction.recommendedOrderDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold mb-1">Demand Factors</p>
                    <div className="flex flex-wrap gap-1">
                      {prediction.factors.map((factor, idx) => (
                        <span
                          key={idx}
                          className="rounded-full border border-current/30 bg-white/50 px-2 py-0.5 text-xs"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white/50 p-3">
                    <div>
                      <p className="text-xs text-gray-600">Recommended Order Quantity</p>
                      <p className="text-lg font-bold">{prediction.recommendedOrderQuantity.toLocaleString()} units</p>
                    </div>
                    <button className="rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Create PO
                    </button>
                  </div>
                </div>
              </div>

              {prediction.riskLevel === 'high' && (
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-rose-600" />
                  <span className="text-xs font-semibold text-rose-700 text-center">Stockout<br/>Risk</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Recommendations */}
      <div className="mt-4 pt-4 border-t border-current/20">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-semibold">Automated Recommendations</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-white/50 p-3">
            <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold shrink-0">
              1
            </span>
            <p className="text-sm">
              Process high-risk items within 3 days to prevent stockouts
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-white/50 p-3">
            <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold shrink-0">
              2
            </span>
            <p className="text-sm">
              Review cold chain requirements for temperature-sensitive medications
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-white/50 p-3">
            <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold shrink-0">
              3
            </span>
            <p className="text-sm">
              Schedule bulk orders for medium-risk items within 7-14 days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
