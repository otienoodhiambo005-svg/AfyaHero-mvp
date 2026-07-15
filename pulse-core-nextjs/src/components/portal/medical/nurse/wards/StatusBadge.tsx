'use client';

import { cn } from '@/lib/utils';

export type StatusType = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'emergency';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusStyles: Record<StatusType, { bg: string; text: string; dot: string; label: string }> = {
  available: { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-700', 
    dot: 'bg-emerald-500',
    label: 'Available'
  },
  occupied: { 
    bg: 'bg-rose-500/10', 
    text: 'text-rose-700', 
    dot: 'bg-rose-500',
    label: 'Occupied'
  },
  cleaning: { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-700', 
    dot: 'bg-amber-500',
    label: 'Cleaning'
  },
  maintenance: { 
    bg: 'bg-slate-500/10', 
    text: 'text-slate-700', 
    dot: 'bg-slate-500',
    label: 'Maintenance'
  },
  emergency: { 
    bg: 'bg-red-600/10', 
    text: 'text-red-700', 
    dot: 'bg-red-600',
    label: 'Emergency'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.available;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current shadow-card",
      style.bg,
      style.text,
      className
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", style.dot)} />
      {style.label}
    </div>
  );
}
