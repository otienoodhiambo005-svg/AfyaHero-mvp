'use client';

import {
    Calendar,
    Clock,
    MapPin,
    ChevronLeft,
    ChevronRight,
    Plus,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const appointments = [
    { time: '09:00 AM', patient: 'Alice Thompson', type: 'Consultation', status: 'Confirmed', priority: 'Normal' },
    { time: '11:30 AM', patient: 'Robert Wilson', type: 'Follow-up', status: 'Pending', priority: 'High' },
    { time: '02:00 PM', patient: 'Maria Garcia', type: 'Surgery Prep', status: 'Confirmed', priority: 'Urgent' },
    { time: '04:15 PM', patient: 'James Lee', type: 'Result Review', status: 'Completed', priority: 'Normal' },
];

export default function AppointmentTracker() {
    return (
        <div className="bg-content-bg rounded-3xl border border-content-border shadow-card overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-content-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-indigo-50 text-indigo-500 rounded-card flex items-center justify-center border border-indigo-100 min-h-[44px] min-w-[44px]">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-ink font-outfit">Appointment Tracker</h3>
                        <p className="text-xs text-slate-500 font-medium">Daily clinical schedule</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button aria-label="Previous day" className="p-3 border border-content-border rounded-lg hover:bg-content-surface text-slate-400 min-h-[44px] min-w-[44px]"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest px-2">Feb 26, 2024</span>
                    <button aria-label="Next day" className="p-3 border border-content-border rounded-lg hover:bg-content-surface text-slate-400 min-h-[44px] min-w-[44px]"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {appointments.map((appt, i) => (
                    <div key={i} className="relative pl-10 group">
                        {/* Timeline Line */}
                        {i !== appointments.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-slate-100 group-last:hidden" />
                        )}

                        {/* Timeline Dot */}
                        <div className={cn(
                            'absolute left-0 top-1 w-11 h-11 rounded-full border-4 border-white flex items-center justify-center z-10 transition-all shadow-card min-h-[44px] min-w-[44px]',
                            appt.status === 'Completed' ? 'bg-emerald-500 text-white' :
                                appt.status === 'Confirmed' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'
                        )}>
                            {appt.status === 'Completed' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>

                        <div className="p-5 rounded-card border border-content-border/50 bg-content-surface/50 hover:bg-content-bg hover:shadow-xl hover:shadow-indigo-500/5 transition-all group-hover:border-indigo-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-bold text-ink">{appt.patient}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{appt.type}</span>
                                </div>
                                <span className={cn(
                                    'px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest',
                                    appt.priority === 'Urgent' ? 'bg-rose-50 text-rose-600' :
                                        appt.priority === 'High' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                                )}>
                                    {appt.priority}
                                </span>
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        {appt.time}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        Exam Room 4
                                    </div>
                                </div>
                                <div className="flex -space-x-2">
                                    {[1, 2].map(j => (
                                        <div key={j} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 bg-cover bg-center shadow-card" style={{ backgroundImage: `url('https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 5 + j}')` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 border-t border-content-border/50">
                <button className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-card hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 text-xs uppercase tracking-widest active:scale-95">
                    <Plus className="w-4 h-4" />
                    Schedule Appointment
                </button>
            </div>
        </div>
    );
}
