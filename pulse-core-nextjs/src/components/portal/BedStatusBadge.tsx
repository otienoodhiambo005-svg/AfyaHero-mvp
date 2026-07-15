import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, MoreHorizontal, User, AlertCircle, RefreshCw } from 'lucide-react';
import { BedStatus } from '@/hooks/useRealtimeBeds';

interface BedStatusBadgeProps {
  status: BedStatus;
  className?: string;
}

const statusConfig: Record<BedStatus, { 
    label: string, 
    icon: React.ElementType, 
    colors: string,
    dot: string
}> = {
  available: {
    label: 'Available',
    icon: CheckCircle2,
    colors: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    dot: 'bg-emerald-500'
  },
  occupied: {
    label: 'Occupied',
    icon: User,
    colors: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    dot: 'bg-rose-500'
  },
  reserved: {
    label: 'Reserved',
    icon: MoreHorizontal,
    colors: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    dot: 'bg-blue-500'
  },
  maintenance: {
    label: 'Maintenance',
    icon: AlertCircle,
    colors: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500'
  },
  cleaning: {
    label: 'Cleaning',
    icon: RefreshCw,
    colors: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    dot: 'bg-cyan-500'
  }
};

export function BedStatusBadge({ status, className }: BedStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.available;
  const Icon = config.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-300",
      config.colors,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", config.dot)} />
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
}
