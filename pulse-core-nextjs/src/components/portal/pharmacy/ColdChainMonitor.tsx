'use client';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { Thermometer, AlertTriangle, CheckCircle2, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';

const data = [
  { time: '00:00', temp: 4.2 },
  { time: '02:00', temp: 4.3 },
  { time: '04:00', temp: 4.1 },
  { time: '06:00', temp: 4.8 },
  { time: '08:00', temp: 5.2 },
  { time: '10:00', temp: 5.8 },
  { time: '12:00', temp: 6.2 },
  { time: '14:00', temp: 5.9 },
  { time: '16:00', temp: 5.4 },
  { time: '18:00', temp: 4.9 },
  { time: '20:00', temp: 4.5 },
  { time: '22:00', temp: 4.2 },
];

export function ColdChainMonitor() {
  const currentTemp = 4.5;
  const isOptimal = currentTemp >= 2 && currentTemp <= 8;

  return (
    <div className="bg-[#080F0C] rounded-[2.5rem] border border-emerald-950 p-8 text-white relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-serif font-bold text-emerald-50 tracking-tight">Cold Chain Telemetry</h3>
            <p className="text-[10px] font-black font-mono text-emerald-500/50 uppercase tracking-widest">Zone: Vaccine Storage C1</p>
          </div>
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-content-bg/5 border border-white/10 flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-emerald-400" />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="p-6 rounded-3xl bg-content-bg/5 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Temperature</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-serif font-bold text-white">{currentTemp}°C</p>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Optimal</span>
                </div>
            </div>
            <div className="p-6 rounded-3xl bg-content-bg/5 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Humidity</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-serif font-bold text-white">42%</p>
                    <Wind className="w-4 h-4 text-blue-400" />
                </div>
            </div>
        </div>

        <div className="h-[200px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: '#475569', fontWeight: 700 }}
                interval={2}
              />
              <YAxis 
                domain={[0, 10]} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: '#475569', fontWeight: 700 }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-card shadow-2xl">
                          <p className="text-[9px] font-black font-mono text-emerald-500 uppercase mb-0.5">{payload[0].payload.time}</p>
                          <p className="text-sm font-bold text-white font-serif">{payload[0].value}°C</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={2} stroke="#334155" strokeDasharray="3 3" />
              <ReferenceLine y={8} stroke="#334155" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="temp" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#tempGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 p-5 rounded-card bg-content-bg/5 border border-white/10 flex items-start gap-4">
            <div className="w-10 h-10 rounded-card bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
                <p className="text-xs font-bold text-white mb-1">Power Backup Active</p>
                <p className="text-[10px] text-slate-500 font-medium leading-normal">
                    Solar redundancy enabled at 09:00 AM. Inverter efficiency is nominal. Battery at 88%.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
