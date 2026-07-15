import React from 'react';
import { 
  Users, 
  Clock, 
  Video, 
  Phone, 
  MessageSquare, 
  ArrowRight,
  MoreVertical,
  User,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WaitroomPatient } from '@/hooks/useTeleconsult';

interface Props {
  patients: WaitroomPatient[];
  onAdmit: (patient: WaitroomPatient) => void;
}

const modeIcons = {
  'Video': Video,
  'Call': Phone,
  'Text': MessageSquare,
};

export function TeleconsultWaitroomList({ patients, onAdmit }: Props) {
  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-content-surface/30 rounded-[2rem] border border-dashed border-content-border">
        <div className="w-16 h-16 rounded-3xl bg-content-surface border border-content-border flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-text-secondary/20" />
        </div>
        <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Waitroom is empty</p>
        <p className="text-xs text-text-secondary/60 mt-2">No patients currently in the digital queue.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {patients.map((p) => {
        const ModeIcon = modeIcons[p.mode];
        const isUrgent = p.priority === 'Urgent';
        
        return (
          <div 
            key={p.id} 
            className={cn(
              "group bg-content-bg rounded-3xl border p-5 hover:shadow-xl transition-all flex items-center justify-between",
              isUrgent 
                ? "border-rose-100 bg-rose-50/20 hover:border-rose-200" 
                : "border-content-border hover:border-[var(--portal-primary)]/30"
            )}
          >
            <div className="flex items-center gap-5">
              <div className={cn(
                "w-14 h-14 rounded-card border flex items-center justify-center group-hover:scale-110 transition-transform",
                isUrgent ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-content-surface border-content-border/50 text-[var(--portal-primary)]"
              )}>
                <User className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-text-primary tracking-tight">{p.patient}</h4>
                  {isUrgent && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider">
                      Urgent
                    </span>
                  )}
                  <span className="text-[9px] text-text-secondary/40 font-mono">#{p.id}</span>
                </div>
                <p className="text-xs text-text-secondary font-medium mb-2 opacity-80">{p.waitingFor}</p>
                <div className="flex items-center gap-4 text-[11px] text-text-secondary font-medium">
                  <span className={cn(
                    "flex items-center gap-1.5",
                    p.waitMinutes > 15 ? "text-rose-500 font-bold" : "text-text-secondary"
                  )}>
                    <Timer className="w-3.5 h-3.5" />
                    Waiting {p.waitMinutes}m
                  </span>
                  <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                    <ModeIcon className="w-3.5 h-3.5" />
                    {p.mode}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => onAdmit(p)}
                className="group/btn flex items-center gap-2 px-6 py-3 bg-[#080F0C] text-white rounded-card text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 active:scale-95 shadow-lg shadow-black/10"
              >
                <span>Admit Patient</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
              
              <button className="p-2.5 rounded-card hover:bg-content-surface text-text-secondary/40 hover:text-text-primary transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
