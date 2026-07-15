import React from 'react';
import { 
  Calendar, 
  Clock, 
  Video, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Play,
  MoreVertical,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeleconsultAppointment, AppointmentStatus } from '@/hooks/useTeleconsult';

interface Props {
  appointments: TeleconsultAppointment[];
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
  onStartCall: (appointment: TeleconsultAppointment) => void;
}

const statusConfig: Record<AppointmentStatus, { color: string, icon: any }> = {
  'Scheduled': { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Calendar },
  'Confirmed': { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  'In Progress': { color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  'Completed': { color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: CheckCircle2 },
};

const modeIcons = {
  'Video': Video,
  'Call': Phone,
  'Text': MessageSquare,
};

export function TeleconsultAppointmentList({ appointments, onUpdateStatus, onStartCall }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-content-surface/30 rounded-[2rem] border border-dashed border-content-border">
        <div className="w-16 h-16 rounded-3xl bg-content-surface border border-content-border flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-text-secondary/20" />
        </div>
        <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">No appointments today</p>
        <p className="text-xs text-text-secondary/60 mt-2">New appointments will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {appointments.map((apt) => {
        const Config = statusConfig[apt.status];
        const ModeIcon = modeIcons[apt.mode];
        
        return (
          <div 
            key={apt.id} 
            className="group bg-content-bg rounded-3xl border border-content-border p-5 hover:border-[var(--portal-primary)]/30 hover:shadow-xl hover:shadow-[var(--portal-primary)]/5 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-card bg-content-surface border border-content-border/50 flex items-center justify-center text-[var(--portal-primary)] group-hover:scale-110 transition-transform">
                <User className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-text-primary tracking-tight">{apt.patient}</h4>
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5",
                    Config.color
                  )}>
                    <Config.icon className="w-3 h-3" />
                    {apt.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-text-secondary font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {apt.time}
                  </span>
                  <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                    <ModeIcon className="w-3.5 h-3.5" />
                    {apt.mode}
                  </span>
                  <span className="text-[9px] text-text-secondary/40 font-mono">#{apt.id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {apt.status !== 'Completed' && apt.status !== 'In Progress' && (
                <button 
                  onClick={() => onUpdateStatus(apt.id, 'Confirmed')}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-card text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors"
                >
                  Confirm
                </button>
              )}
              
              <button 
                onClick={() => onStartCall(apt)}
                disabled={apt.status === 'Completed'}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-card text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
                  apt.status === 'In Progress' 
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" 
                    : "bg-[var(--portal-primary)] text-white shadow-lg shadow-[var(--portal-primary)]/20 hover:-translate-y-0.5"
                )}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {apt.status === 'In Progress' ? 'Resume Visit' : 'Start Visit'}
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
