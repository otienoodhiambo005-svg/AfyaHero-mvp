import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Bed, BedStatus } from '@/hooks/useRealtimeBeds';
import { BedStatusBadge } from './BedStatusBadge';
import { Activity, Clock, User as UserIcon } from 'lucide-react';

interface BedTileProps {
  bed: Bed;
  onClick?: (bed: Bed) => void;
  isAdmin?: boolean;
}

export function BedTile({ bed, onClick, isAdmin }: BedTileProps) {
  const isOccupied = bed.status === 'occupied';
  
  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(bed)}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(bed); } }}
      className={cn(
        "relative p-4 rounded-3xl border transition-all cursor-pointer overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35",
        "bg-[#0D151C] border-white/5 shadow-xl",
        isOccupied ? "ring-1 ring-rose-500/20" : "hover:border-white/10"
      )}
    >
      {/* Glow Effect */}
      <div className={cn(
        "absolute -top-12 -right-12 w-32 h-32 blur-[60px] rounded-full opacity-20 transition-all",
        bed.status === 'available' ? "bg-emerald-500" : 
        bed.status === 'occupied' ? "bg-rose-500" : "bg-amber-500"
      )} />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono mb-1">
              {bed.ward_name}
            </div>
            <div className="text-xl font-bold text-white font-serif">
              Bed {bed.bed_number}
            </div>
          </div>
          <BedStatusBadge status={bed.status} />
        </div>

        {isOccupied ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-card bg-content-bg/5 flex items-center justify-center border border-white/10">
                <UserIcon className="w-4 h-4 text-rose-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white truncate">
                  {isAdmin ? `Patient ID: ...${bed.patient_id?.slice(-6)}` : bed.patient_name}
                </div>
                <div className="text-[9px] text-white/40 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Admitted {new Date(bed.admitted_at || '').toLocaleDateString('en-KE')}
                </div>
              </div>
            </div>

            {/* Sparkline Placeholder / Vitals */}
            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <div className="flex gap-1.5">
                {[40, 60, 45, 70, 55, 80].map((h, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-rose-500/30 rounded-full" 
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-white flex items-center gap-1 justify-end">
                   <Activity className="w-3 h-3 text-emerald-400" /> 72 BPM
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center gap-2 opacity-30 group-hover:opacity-50 transition-opacity">
            <Activity className="w-6 h-6 text-white" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Monitoring Active</span>
          </div>
        )}
      </div>

      {/* Role Notice Overlay */}
      {isAdmin && isOccupied && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-slate-900 border border-white/10 px-2 py-1 rounded-lg text-[8px] font-bold text-white/60 uppercase">
            Surveillance Mode
          </div>
        </div>
      )}
    </motion.div>
  );
}
