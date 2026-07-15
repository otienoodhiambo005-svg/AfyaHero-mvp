'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { QueuePatient, CLINICAL_STATUS_STYLES } from './DashboardTypes';

interface LiveQueueItemProps {
  patient: QueuePatient;
}

export function LiveQueueItem({ patient }: LiveQueueItemProps) {
  const initials = patient.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="bg-content-bg rounded-3xl p-6 flex items-center justify-between border border-transparent hover:border-content-border/50 transition-all hover:shadow-card">
      <div className="flex items-center gap-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-card bg-[#E0E7E6] flex items-center justify-center border border-content-border/50 shadow-card shrink-0">
          <span className="text-xl font-bold text-slate-700 tracking-tighter">{initials}</span>
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <h4 className="text-xl font-bold text-ink tracking-tight">{patient.name}</h4>
          <p className="text-sm font-medium text-slate-400 font-mono tracking-wider">
            ID: <span className="opacity-60">{patient.patientId}</span> • {patient.phone}
          </p>
        </div>
      </div>

      {/* Statuses */}
      <div className="flex items-center gap-8">
        <div className="space-y-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">M-Pesa Status</p>
          <div className={cn(
            "px-4 py-1.5 rounded-full text-[13px] font-bold border",
            patient.mpesaStatus === 'Paid' 
              ? "bg-[#E0F2F1] text-emerald-600 border-[#C8E6C9]" 
              : "bg-[#FFF3E0] text-orange-600 border-[#FFE0B2]"
          )}>
            {patient.mpesaStatus === 'Paid' ? `Paid: ${patient.mpesaAmount}` : "Pending Payment"}
          </div>
        </div>

        <div className={cn(
          "px-8 py-2.5 rounded-full text-sm font-bold border transition-colors",
          CLINICAL_STATUS_STYLES[patient.clinicalStatus]
        )}>
          {patient.clinicalStatus}
        </div>
      </div>
    </div>
  );
}
