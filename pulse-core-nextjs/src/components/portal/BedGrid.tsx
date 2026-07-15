'use client';

import React from 'react';
import { Bed, User, Wrench, Sparkles, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';

export interface BedData {
  id: string;
  wardId?: string | null;
  wardName: string;
  bedNumber: string;
  status: BedStatus;
  patientId?: string | null;
  patientName?: string | null;
  admittedAt?: Date | null;
  expectedDischarge?: Date | null;
  notes?: string | null;
}

interface BedGridProps {
  beds: BedData[];
  onBedClick?: (bed: BedData) => void;
  className?: string;
  maxColumns?: number;
}

const statusConfig: Record<BedStatus, { icon: React.ReactNode; bgClass: string; textClass: string; borderClass: string; label: string }> = {
  available: {
    icon: <Bed className="w-5 h-5 text-emerald-500" />,
    bgClass: 'bg-[#080F0C] hover:bg-emerald-950/30',
    textClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/20 hover:border-emerald-500/50',
    label: 'Available',
  },
  occupied: {
    icon: <User className="w-5 h-5 text-blue-500" />,
    bgClass: 'bg-blue-950/20 hover:bg-blue-950/40',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500/30 hover:border-blue-500/60',
    label: 'Occupied',
  },
  reserved: {
    icon: <Clock className="w-5 h-5 text-purple-500" />,
    bgClass: 'bg-[#080F0C] hover:bg-purple-950/30',
    textClass: 'text-purple-500',
    borderClass: 'border-purple-500/20 hover:border-purple-500/50',
    label: 'Reserved',
  },
  maintenance: {
    icon: <Wrench className="w-5 h-5 text-orange-500" />,
    bgClass: 'bg-[#080F0C] hover:bg-orange-950/30',
    textClass: 'text-orange-500',
    borderClass: 'border-orange-500/20 hover:border-orange-500/50',
    label: 'Maintenance',
  },
  cleaning: {
    icon: <Sparkles className="w-5 h-5 text-stone-400" />,
    bgClass: 'bg-[#080F0C] hover:bg-stone-900',
    textClass: 'text-stone-400',
    borderClass: 'border-stone-800 hover:border-stone-600',
    label: 'Cleaning',
  },
};

export function BedGrid({ beds, onBedClick, className, maxColumns = 6 }: BedGridProps) {
  // Compute basic metrics for the header
  const total = beds.length;
  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const available = beds.filter((b) => b.status === 'available').length;
  const maintenance = beds.filter(b => ['maintenance', 'cleaning'].includes(b.status)).length;
  
  // Group by Ward
  const wardGroups = beds.reduce((acc, bed) => {
    if (!acc[bed.wardName]) acc[bed.wardName] = [];
    acc[bed.wardName].push(bed);
    return acc;
  }, {} as Record<string, BedData[]>);

  return (
    <div className={cn('flex flex-col space-y-6', className)}>
      {/* High-Level KPI Strip (Inline view for BedGrid specifically) */}
      <div className="grid grid-cols-4 gap-4 p-4 rounded-card border border-stone-800 bg-[#080F0C]">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Beds</span>
          <span className="text-2xl font-bold font-mono text-stone-200 mt-1">{total}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider">Available</span>
          <span className="text-2xl font-bold font-mono text-emerald-500 mt-1">{available}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-blue-500/80 uppercase tracking-wider">Occupied</span>
          <span className="text-2xl font-bold font-mono text-blue-500 mt-1">{occupied}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-orange-500/80 uppercase tracking-wider">Maint/Clean</span>
          <span className="text-2xl font-bold font-mono text-orange-500 mt-1">{maintenance}</span>
        </div>
      </div>

      {/* Ward Renderings */}
      {Object.entries(wardGroups).map(([wardName, wardBeds]) => (
        <div key={wardName} className="flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <h3 className="text-md font-medium text-stone-200 font-serif leading-none tracking-tight">{wardName}</h3>
            <span className="text-xs font-mono text-stone-500">{wardBeds.length} beds</span>
          </div>
          
          <div 
            className="grid gap-3" 
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}
          >
            {wardBeds.map((bed) => {
              const cfg = statusConfig[bed.status];
              return (
                <button
                  key={bed.id}
                  onClick={() => onBedClick?.(bed)}
                  className={cn(
                    'group flex flex-col p-3 rounded-lg border transition-all duration-200 w-full text-left',
                    cfg.bgClass,
                    cfg.borderClass
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-sm font-semibold text-stone-300">
                      {bed.bedNumber}
                    </span>
                    {cfg.icon}
                  </div>
                  
                  <div className="mt-3 flex flex-col space-y-1">
                    <span className={cn('text-[10px] uppercase font-bold tracking-widest', cfg.textClass)}>
                      {cfg.label}
                    </span>
                    
                    {bed.status === 'occupied' && bed.patientName ? (
                      <div className="flex flex-col mt-1">
                        <span className="text-sm font-medium text-stone-200 truncate" title={bed.patientName}>
                          {bed.patientName}
                        </span>
                        {bed.expectedDischarge && (
                          <div className="flex items-center text-[10px] text-stone-500 mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            DC: {formatDate(new Date(bed.expectedDischarge))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-stone-600 italic">Empty</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
