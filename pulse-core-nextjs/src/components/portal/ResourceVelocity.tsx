'use client';

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
} from 'recharts';
import { tokens } from '@/styles/design-tokens';

interface ThroughputData {
  time: string;
  inflow: number;
  outflow: number;
}

const data: ThroughputData[] = [
  { time: '08:00', inflow: 12, outflow: 4 },
  { time: '10:00', inflow: 18, outflow: 8 },
  { time: '12:00', inflow: 25, outflow: 15 },
  { time: '14:00', inflow: 22, outflow: 20 },
  { time: '16:00', inflow: 30, outflow: 18 },
  { time: '18:00', inflow: 15, outflow: 22 },
];

export function ResourceVelocity() {
  return (
    <div className="bg-content-bg border border-content-border rounded-3xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-ink font-bold text-lg">Hospital Throughput</h3>
          <p className="text-slate-500 text-xs">Patient Inflow vs. Discharge Velocity (Real-time)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Inflow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Outflow</span>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
            />
            <Tooltip 
              cursor={{ fill: '#F8FAFC' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
            />
            <Bar 
              dataKey="inflow" 
              fill={tokens.colors.portals.admin} 
              radius={[4, 4, 0, 0]} 
              barSize={12} 
            />
            <Bar 
              dataKey="outflow" 
              fill={tokens.colors.status.success} 
              radius={[4, 4, 0, 0]} 
              barSize={12} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 pt-6 border-t border-content-border/50 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg. Admission Time</p>
          <p className="text-xl font-black text-ink">42m <span className="text-xs text-emerald-500 font-bold">(-12%)</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Discharge Efficiency</p>
          <p className="text-xl font-black text-ink">89% <span className="text-xs text-emerald-500 font-bold">(+5%)</span></p>
        </div>
      </div>
    </div>
  );
}
