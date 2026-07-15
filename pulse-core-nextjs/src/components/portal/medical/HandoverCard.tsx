'use client';

import { motion } from 'framer-motion';
import { User, Clock, ChevronRight, AlertCircle, CheckCircle2, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HandoverRecord } from '@/types';

interface HandoverCardProps {
  handover: HandoverRecord;
  onClick?: () => void;
  accentColor?: string;
}

const statusConfig: Record<string, { icon: any, color: string, bg: string }> = {
  'Pending': { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  'Acknowledged': { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  'Completed': { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export default function HandoverCard({ handover, onClick, accentColor = '#2563EB' }: HandoverCardProps) {
  const status = statusConfig[handover.status] || statusConfig['Pending'];
  const StatusIcon = status.icon;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); } }}
      className="glass-card p-6 cursor-pointer group relative overflow-hidden transition-all duration-300 border-content-border hover:shadow-2xl hover:shadow-[var(--portal-primary)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-card bg-content-surface flex items-center justify-center border border-content-border group-hover:border-[var(--portal-primary)]/30 transition-colors shadow-card">
            <UserCircle2 className="w-7 h-7 text-text-secondary group-hover:text-[var(--portal-primary)] transition-colors" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-text-primary font-serif tracking-tight">{handover.patientName}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest font-mono">ID: {handover.patientId}</span>
              <div className="w-1 h-1 rounded-full bg-content-border" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest font-mono">From: {handover.senderName}</span>
            </div>
          </div>
        </div>
        <div className={cn('px-3 py-1 rounded-full flex items-center gap-1.5 border border-current/10', status.bg, status.color)}>
          <StatusIcon className="w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-widest">{handover.status}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-card bg-content-surface/50 border border-content-border group-hover:bg-content-bg transition-colors">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#2563EB] mb-1.5 opacity-70">Situation</div>
          <p className="text-sm text-text-primary font-medium line-clamp-2 leading-relaxed">{handover.situation}</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-text-secondary">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold font-mono">
              {new Date(handover.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2563EB] group-hover:gap-2 transition-all">
            Review Details <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Decorative accent */}
      <div 
        className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity group-hover:opacity-[0.07]" 
        style={{ backgroundColor: accentColor }}
      />
    </motion.div>
  );
}
