'use client';

import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens } from '@/styles/design-tokens';

interface KPICardWithTrendProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  trendValue?: string;
  data: { value: number }[];
  accentColor?: string;
}

export function KPICardWithTrend({
  title,
  value,
  subValue,
  icon,
  trend,
  trendValue,
  data,
  accentColor = tokens.colors.portals.admin,
}: KPICardWithTrendProps) {
  const isPositive = trend === 'up';

  return (
    <div className="relative group bg-content-bg border border-content-border rounded-3xl p-5 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1">
      {/* Background Glow */}
      <div 
        className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-ink tracking-tight">{value}</h3>
          {subValue && (
            <p className="text-slate-400 text-xs font-medium">{subValue}</p>
          )}
        </div>
        <div 
          className="p-3 rounded-card shadow-card bg-content-surface border border-content-border/50 group-hover:scale-110 transition-transform"
          style={{ color: accentColor }}
        >
          {icon}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          {trendValue && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full w-fit',
              isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            )}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendValue}
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider ml-1">last 24h</span>
        </div>
        
        {/* Sparkline */}
        <div className="h-12 w-24 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={accentColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill={`url(#grad-${title})`} 
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
