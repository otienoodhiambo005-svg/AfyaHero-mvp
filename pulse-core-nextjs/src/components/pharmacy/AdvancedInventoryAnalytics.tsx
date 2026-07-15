'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  RefreshCcw,
  Zap,
  Calendar,
  DollarSign,
  Truck,
  Gauge,
  Brain,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

interface AnalysisResult {
  type: string;
  forecasts?: any[];
  optimizations?: any[];
  alerts?: any[];
  suppliers?: any[];
  summary?: any;
  recommendations?: string[];
  generatedAt?: string;
}

export default function SmartInventoryAnalytics() {
  const [analyzing, setAnalyzing] = useState(false);
  type TabId = 'forecasts' | 'optimization' | 'alerts' | 'suppliers';
  const [activeTab, setActiveTab] = useState<TabId>('forecasts');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pharmacy_inventory')
      .select('*')
      .order('medication_name');

    if (!error && data) {
      setInventory(data);
    }
    setLoading(false);
  };

  const runComprehensiveAnalysis = async () => {
    if (inventory.length === 0) return;

    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/smart-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: 'comprehensive',
          data: inventory
        })
      });

      const data = await response.json();
      setAnalysis(data);
      setActiveTab('forecasts');
    } catch (error) {
      logger.error('Analysis Error', { error });
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'medium':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'high':
        return <ArrowUp className="w-4 h-4 text-orange-400" />;
      case 'medium':
        return <Gauge className="w-4 h-4 text-amber-400" />;
      default:
        return <ArrowDown className="w-4 h-4 text-emerald-400" />;
    }
  };

  const categoryColors = {
    A: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    B: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    C: 'bg-slate-500/10 border-slate-500/20 text-slate-400'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Brain className="w-8 h-8 text-emerald" />
            Smart Inventory Analytics
          </h2>
          <p className="text-sage mt-2">AI-powered forecasting, optimization & alerts</p>
        </div>
        <button
          onClick={runComprehensiveAnalysis}
          disabled={analyzing || loading}
          className={cn(
            'px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95',
            analyzing || loading
              ? 'bg-white/5 text-sage cursor-not-allowed'
              : 'bg-emerald text-white hover:bg-emerald/90 shadow-emerald/20 shadow-lg'
          )}
        >
          {analyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {analyzing ? 'Analyzing...' : 'Run Full Analysis'}
        </button>
      </div>

      {/* Summary Cards */}
      {analysis?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-forest/40 border border-white/5 rounded-2xl p-4">
            <div className="text-xs text-sage font-bold uppercase tracking-wide mb-2">Total Items</div>
            <div className="text-2xl font-bold text-white">{analysis.summary.totalItems}</div>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
            <div className="text-xs text-rose-400 font-bold uppercase tracking-wide mb-2">Critical</div>
            <div className="text-2xl font-bold text-rose-300">{analysis.summary.criticalAlerts}</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-2">Overstock</div>
            <div className="text-2xl font-bold text-amber-300">{analysis.summary.overStocked}</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
            <div className="text-xs text-orange-400 font-bold uppercase tracking-wide mb-2">Understock</div>
            <div className="text-2xl font-bold text-orange-300">{analysis.summary.underStocked}</div>
          </div>
        </div>
      )}

      {/* Main Analysis Content */}
      {analysis ? (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/5 overflow-x-auto">
            {([
              { id: 'forecasts' as TabId, label: '📊 Forecasts', icon: TrendingUp },
              { id: 'optimization' as TabId, label: '💰 Optimization', icon: DollarSign },
              { id: 'alerts' as TabId, label: '⚠️ Alerts', icon: AlertTriangle },
              { id: 'suppliers' as TabId, label: '🚚 Suppliers', icon: Truck }
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all',
                  activeTab === tab.id
                    ? 'text-emerald border-emerald'
                    : 'text-sage border-transparent hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Forecasts Tab */}
          {activeTab === 'forecasts' && analysis.forecasts && (
            <div className="grid gap-4">
              {analysis.forecasts.map((forecast, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-6 rounded-2xl border cursor-pointer transition-all',
                    expandedItem === `forecast-${idx}`
                      ? 'bg-forest/40 border-emerald/30'
                      : 'bg-forest/20 border-white/5 hover:border-white/10'
                  )}
                  onClick={() => setExpandedItem(expandedItem === `forecast-${idx}` ? null : `forecast-${idx}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center border',
                        forecast.urgency === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                        forecast.urgency === 'high' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                        forecast.urgency === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      )}>
                        {getUrgencyIcon(forecast.urgency)}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">{forecast.item}</h4>
                        <p className="text-xs text-sage mt-1">Stock: {forecast.currentStock} | Predicted: {forecast.predictedDemand}/mo</p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold border',
                      getSeverityColor(forecast.urgency)
                    )}>
                      {forecast.urgency.toUpperCase()}
                    </span>
                  </div>
                  {expandedItem === `forecast-${idx}` && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                      <div>
                        <div className="text-xs text-sage font-bold mb-1">Recommendation</div>
                        <p className="text-sm text-mist">{forecast.recommendation}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-sage font-bold mb-1">Confidence</div>
                          <div className="text-sm text-emerald">{(forecast.confidence * 100).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-sage font-bold mb-1">Period</div>
                          <div className="text-sm text-mist">{forecast.forecastPeriod}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Optimization Tab */}
          {activeTab === 'optimization' && analysis.optimizations && (
            <div className="grid gap-4">
              {analysis.optimizations.map((opt, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-6 rounded-2xl border cursor-pointer transition-all',
                    expandedItem === `opt-${idx}`
                      ? 'bg-forest/40 border-blue/30'
                      : 'bg-forest/20 border-white/5 hover:border-white/10'
                  )}
                  onClick={() => setExpandedItem(expandedItem === `opt-${idx}` ? null : `opt-${idx}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center border font-bold text-lg',
                        categoryColors[opt.category as keyof typeof categoryColors]
                      )}>
                        {opt.category}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">{opt.item}</h4>
                        <p className="text-xs text-sage mt-1">Optimal Qty: {opt.optimizedQuantity} | Reorder Point: {opt.reorderPoint}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald">Save ${opt.potentialSavings.toFixed(2)}</div>
                      <p className="text-xs text-sage mt-1">ROI: {opt.roi}</p>
                    </div>
                  </div>
                  {expandedItem === `opt-${idx}` && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-sm text-mist">Category {opt.category} items require {'ABC'[opt.category.charCodeAt(0) - 65]} level priority management based on annual value analysis.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && analysis.alerts && (
            <div className="grid gap-4">
              {analysis.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-6 rounded-2xl border cursor-pointer transition-all',
                    expandedItem === `alert-${idx}`
                      ? 'bg-forest/40 border-white/20'
                      : 'bg-forest/20 border-white/5 hover:border-white/10',
                    getSeverityColor(alert.severity).split(' ')[0]
                  )}
                  onClick={() => setExpandedItem(expandedItem === `alert-${idx}` ? null : `alert-${idx}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 border',
                        getSeverityColor(alert.severity)
                      )}>
                        {alert.type === 'expiry' ? <Calendar className="w-4 h-4" /> :
                         alert.type === 'overstock' ? <TrendingDown className="w-4 h-4" /> :
                         alert.type === 'understock' ? <AlertTriangle className="w-4 h-4" /> :
                         <Package className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white">{alert.item}</h4>
                        <p className="text-sm text-mist mt-2">{alert.recommendation}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-4',
                      getSeverityColor(alert.severity)
                    )}>
                      {alert.severity}
                    </span>
                  </div>
                  {expandedItem === `alert-${idx}` && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="text-xs text-sage font-bold mb-1">Estimated Impact</div>
                      <p className="text-sm text-mist">{alert.estimatedImpact}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && analysis.suppliers && (
            <div className="grid gap-4">
              {analysis.suppliers.map((supplier, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-forest/20 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-white">{supplier.item}</h4>
                      <p className="text-xs text-sage mt-1">{supplier.supplier}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald">{supplier.overallRating}</div>
                      <p className="text-xs text-sage mt-1">{supplier.recommendation}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <div className="text-xs text-sage font-bold mb-2">Delivery Time</div>
                      <div className="text-sm text-white">{supplier.deliveryTime}</div>
                    </div>
                    <div>
                      <div className="text-xs text-sage font-bold mb-2">Accuracy</div>
                      <div className="text-sm text-white">{supplier.deliveryAccuracy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-sage font-bold mb-2">Price</div>
                      <div className="text-sm text-white">{supplier.priceCompetitiveness}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && (
            <div className="bg-emerald/10 border border-emerald/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-emerald mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Recommendations
              </h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-mist">
                    <span className="w-1.5 h-1.5 bg-emerald rounded-full mt-2 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-sage text-center py-4">
            Analysis generated: {new Date(analysis.generatedAt || Date.now()).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 bg-forest/20 rounded-2xl border border-white/5 text-center">
          <Package className="w-12 h-12 text-sage/40 mb-4" />
          <p className="text-sage font-medium">Click &quot;Run Full Analysis&quot;ysis&quot; to generate comprehensive inventory insights</p>
        </div>
      )}
    </div>
  );
}
