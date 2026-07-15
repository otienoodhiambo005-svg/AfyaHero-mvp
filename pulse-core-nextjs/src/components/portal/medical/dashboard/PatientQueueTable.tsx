'use client';

import { Search, RefreshCw, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientRow, statusColors } from './DashboardTypes';

interface PatientQueueTableProps {
  patients: PatientRow[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function PatientQueueTable({ patients, searchQuery, onSearchChange }: PatientQueueTableProps) {
  return (
    <div className="bg-content-bg rounded-card border border-content-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-8 py-6 border-b border-content-border bg-content-surface/40 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-serif text-charcoal tracking-tight font-medium">Consultation Queue</h2>
          <div className="flex items-center gap-3 mt-2 font-mono">
            <span className="text-[10px] font-black text-slate uppercase tracking-widest">{patients.length} Active in Queue</span>
            <div className="w-1 h-1 rounded-full bg-content-border" />
            <span className="text-[10px] font-black text-ai-confirmed-text uppercase tracking-widest">3 New Results Arrived</span>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate group-focus-within:text-portal-primary transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by UID or Name..."
            className="pl-11 pr-5 py-2.5 rounded-card border border-content-border bg-content-surface text-xs outline-none focus:ring-4 focus:ring-portal-primary/10 focus:border-portal-primary/30 w-72 transition-all font-medium placeholder:text-slate"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-content-border bg-content-surface/60">
              {['#', 'Patient', 'Age/Sex', 'Complaint', 'Vitals', 'Status', 'Action'].map((h) => (
                <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-slate uppercase tracking-[0.2em] font-mono">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? (
              patients.map((p) => (
                <tr key={p.num} className="border-b border-content-border/60 hover:bg-content-surface/60 transition-all duration-300 group cursor-default">
                  <td className="px-8 py-5 text-slate font-mono text-[10px] tracking-widest">{p.num.toString().padStart(3, '0')}</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-serif text-lg text-charcoal tracking-tight leading-none group-hover:text-portal-primary transition-colors">{p.name}</span>
                      <span className="text-[9px] font-black text-slate uppercase tracking-widest mt-1">Visit #{(p.num % 900) + 100}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-slate font-mono tracking-widest text-[10px] uppercase font-bold">{p.ageSex}</td>
                  <td className="px-8 py-5">
                    <span className="text-charcoal font-medium truncate max-w-[200px] block">{p.complaint}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-mist font-black uppercase tracking-widest">BP</span>
                        <span className={cn('font-mono font-black text-[11px] tabular-nums', p.bp.includes('150') || p.bp.includes('140') ? 'text-severity-high' : 'text-ink')}>{p.bp}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-mist font-black uppercase tracking-widest">SpO₂</span>
                        <span className="font-mono font-black text-[11px] text-ink tabular-nums">{p.spo2}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn('px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border shadow-card', statusColors[p.status])}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="h-9 w-9 rounded-card bg-charcoal text-white flex items-center justify-center hover:bg-portal-primary transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-content-border group-hover:shadow-portal-primary/20">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Search className="w-10 h-10 text-content-border mb-2" />
                    <p className="text-slate font-medium">No matching patients in today&apos;s clinic.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-content-surface px-8 py-5 border-t border-content-border flex items-center justify-between">
        <button className="text-[10px] font-black text-slate hover:text-portal-primary flex items-center gap-2 transition-all uppercase tracking-[0.2em] group/refresh">
          <RefreshCw className="w-3.5 h-3.5 group-hover/refresh:rotate-180 transition-transform duration-150" /> 
          Re-Sync Clinical Queue
        </button>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ai-confirmed-text animate-pulse" />
          <span className="text-[9px] font-black text-slate uppercase tracking-[0.2em] font-mono italic">Continuous Sync active</span>
        </div>
      </div>
    </div>
  );
}
