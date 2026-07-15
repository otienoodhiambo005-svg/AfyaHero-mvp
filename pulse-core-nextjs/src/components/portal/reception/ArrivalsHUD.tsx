'use client';

import { 
  Users, 
  UserPlus, 
  Search, 
  Scan, 
  Smartphone, 
  CreditCard, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Activity,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ArrivalsHUD() {
  const stats = [
    { label: 'Total Walk-ins', val: '42', trend: '+12%', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Emergency Admissions', val: '04', trend: 'High', color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'NHIF Polls Active', val: '08', trend: 'Live', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="bg-content-bg rounded-[2.5rem] border border-content-border p-8 shadow-card">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-card bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-serif font-bold text-ink tracking-tight">Registration HUD</h3>
            <p className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">Intake Command Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-content-surface border border-content-border/50 flex items-center gap-2">
                <Scan className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Biometric Link Offline</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-10">
        {stats.map((s) => (
          <div key={s.label} className={cn("p-6 rounded-3xl border border-transparent transition-all hover:shadow-md", s.bg)}>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-mono">{s.label}</p>
            <div className="flex items-baseline justify-between">
                <span className="text-2xl font-serif font-bold text-ink">{s.val}</span>
                <span className={cn("text-[9px] font-black uppercase tracking-widest", s.color)}>{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <button className="w-full flex items-center justify-between p-6 rounded-3xl bg-slate-900 text-white hover:bg-black transition-all group shadow-xl shadow-slate-900/20 active:scale-[0.98]">
            <div className="flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-card bg-content-bg/10 flex items-center justify-center border border-white/5">
                    <UserPlus className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <p className="text-sm font-bold tracking-tight">Initiate Rapid Registration</p>
                    <p className="text-[10px] text-slate-500 font-medium">Auto-populates from Kenyan National ID</p>
                </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 group-hover:text-white transition-all" />
        </button>

        <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center gap-3 p-5 rounded-3xl border border-content-border/50 bg-content-bg hover:bg-content-surface transition-all text-left">
                <Smartphone className="w-5 h-5 text-emerald-500" />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-ink">Verify M-Pesa</p>
                    <p className="text-[9px] text-slate-400 font-medium">Link STK Push code</p>
                </div>
            </button>
            <button className="flex items-center gap-3 p-5 rounded-3xl border border-content-border/50 bg-content-bg hover:bg-content-surface transition-all text-left">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-ink">NHIF/SHIF Portal</p>
                    <p className="text-[9px] text-slate-400 font-medium">Check member status</p>
                </div>
            </button>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Triage Queue: 04 Patients</span>
          </div>
          <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Manage All</button>
      </div>
    </div>
  );
}
