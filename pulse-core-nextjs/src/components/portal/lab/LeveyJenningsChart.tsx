'use client';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { cn } from '@/lib/utils';

const data = [
  { day: '01', value: 12.2, level: 'L1' },
  { day: '02', value: 12.5, level: 'L1' },
  { day: '03', value: 12.8, level: 'L1' },
  { day: '04', value: 12.4, level: 'L1' },
  { day: '05', value: 13.5, level: 'L1' }, // High but within 2SD
  { day: '06', value: 12.6, level: 'L1' },
  { day: '07', value: 12.2, level: 'L1' },
  { day: '08', value: 11.8, level: 'L1' }, // Low but within 2SD
  { day: '09', value: 12.4, level: 'L1' },
  { day: '10', value: 14.2, level: 'L1' }, // Westgard Rule Violation!
];

const mean = 12.5;
const sd = 0.5;

export function LeveyJenningsChart() {
  return (
    <div className="bg-content-bg rounded-[2.5rem] border border-content-border p-8 shadow-card h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-serif font-bold text-charcoal tracking-tight">Levey-Jennings Chart</h3>
          <p className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">Parameter: Haemoglobin (Control L1)</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">Mean</p>
                <p className="text-xs font-bold text-ink">{mean}</p>
            </div>
            <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">SD</p>
                <p className="text-xs font-bold text-ink">{sd}</p>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-rose-50 border border-rose-100 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Rule 1:3s Violation</span>
            </div>
        </div>
      </div>

      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              domain={[mean - 4*sd, mean + 4*sd]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
              dx={-10}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#080F0C] border border-emerald-950 p-3 rounded-card shadow-2xl">
                        <p className="text-[10px] font-black font-mono text-emerald-500 uppercase mb-1">Day {payload[0].payload.day}</p>
                        <p className="text-sm font-bold text-white font-serif">{payload[0].value} g/dL</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {/* Sigma Lines */}
            <ReferenceLine y={mean} stroke="#94a3b8" strokeWidth={2} label={{ position: 'right', value: 'Mean', fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
            <ReferenceLine y={mean + 1*sd} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'right', value: '+1SD', fill: '#cbd5e1', fontSize: 10 }} />
            <ReferenceLine y={mean - 1*sd} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'right', value: '-1SD', fill: '#cbd5e1', fontSize: 10 }} />
            <ReferenceLine y={mean + 2*sd} stroke="#fed7aa" strokeDasharray="5 5" label={{ position: 'right', value: '+2SD', fill: '#f97316', fontSize: 10 }} />
            <ReferenceLine y={mean - 2*sd} stroke="#fed7aa" strokeDasharray="5 5" label={{ position: 'right', value: '-2SD', fill: '#f97316', fontSize: 10 }} />
            <ReferenceLine y={mean + 3*sd} stroke="#fecaca" strokeWidth={1} label={{ position: 'right', value: '+3SD', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={mean - 3*sd} stroke="#fecaca" strokeWidth={1} label={{ position: 'right', value: '-3SD', fill: '#ef4444', fontSize: 10 }} />

            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#7c3aed" 
              strokeWidth={3} 
              dot={{ r: 6, fill: '#7c3aed', strokeWidth: 2, stroke: '#fff' }} 
              activeDot={{ r: 8, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 flex items-start gap-4 p-5 rounded-card bg-content-surface border border-content-border/50">
          <div className="w-10 h-10 rounded-card bg-violet-100 flex items-center justify-center border border-violet-200 shrink-0">
              <Activity className="w-5 h-5 text-violet-600" />
          </div>
          <div>
              <p className="text-xs font-bold text-ink mb-1">Analyzer Maintenance required</p>
              <p className="text-[10px] text-slate-500 font-medium leading-normal">
                  Values are trending upwards in the last 4 runs. Check for reagent evaporation or perform light-source calibration for Sysmex XN-1000.
              </p>
          </div>
      </div>
    </div>
  );
}

function Activity({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
}
