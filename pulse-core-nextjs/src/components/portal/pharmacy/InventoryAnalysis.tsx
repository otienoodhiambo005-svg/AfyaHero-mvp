'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { TrendingUp, AlertCircle, Info, Loader2 } from 'lucide-react';
import logger from '@/lib/logger';


export function InventoryAnalysis() {
  const [chartData, setChartData] = useState<Array<{ name: string; stock: number; predicted: number }>>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pharmacy/inventory/analysis', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load inventory analysis (${res.status})`);
      const data = await res.json();
      setChartData(Array.isArray(data.chartData) ? data.chartData : []);
    } catch (err) {
      logger.error('Failed to load inventory analysis', { error: err });
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
        <p className="text-sm">Loading inventory analysis…</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-content-bg rounded-card border border-content-border p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
              Stock Consumption Velocity
            </h3>
            <p className="text-sm text-slate-500">Real-time vs Predicted Outflow (Last 7 Days)</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-600" />
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400 border-dashed" />
              <span>AI Predicted</span>
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891b2" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="stock" stroke="#0891b2" strokeWidth={2} fillOpacity={1} fill="url(#colorStock)" />
              <Area type="monotone" dataKey="predicted" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-900 rounded-card p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-400 mb-4">Stock Vitality Score</h4>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-5xl font-black">84%</span>
            <span className="text-emerald-400 font-bold text-sm mb-1">+2.4% vs last week</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Your inventory is highly optimized. Drug wastage from expiry has dropped by 12% since AI reordering was enabled.
          </p>
        </div>

        <div className="bg-amber-50 rounded-card p-6 border border-amber-200 shadow-card">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">Endemic Outbreak Warning</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Local clinical data shows a 15% surge in respiratory infections. AI recommends increasing <span className="font-bold">Salbutamol</span> and <span className="font-bold">Azithromycin</span> stock by 20%.
              </p>
              <button className="mt-3 text-xs font-bold text-amber-900 underline underline-offset-4 hover:text-amber-800 transition-colors">
                Apply Global Buffer Adjust
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
