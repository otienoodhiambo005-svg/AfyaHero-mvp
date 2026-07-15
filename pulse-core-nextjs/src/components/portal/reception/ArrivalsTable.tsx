'use client';

import React, { useState, useMemo } from 'react';
import { Search, Eye, CheckCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ArrivalRow, 
  PRIORITY_STYLES, 
  STATUS_STYLES 
} from './DashboardTypes';

interface ArrivalsTableProps {
  arrivals: ArrivalRow[];
  accentColor: string;
}

export function ArrivalsTable({ arrivals, accentColor }: ArrivalsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());

  const filteredArrivals = useMemo(() => {
    if (!searchQuery) return arrivals;
    const query = searchQuery.toLowerCase();
    return arrivals.filter((row) =>
      row.patient.toLowerCase().includes(query) ||
      row.token.toLowerCase().includes(query) ||
      row.complaint.toLowerCase().includes(query)
    );
  }, [arrivals, searchQuery]);

  return (
    <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
      <div className="px-6 py-4 border-b border-content-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-ink font-semibold">Today&apos;s Arrivals</h2>
          <span className="text-slate-500 text-sm">{filteredArrivals.length} of {arrivals.length} patients</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients..."
            className="pl-9 pr-3 py-2 rounded-lg border border-content-border text-sm outline-none focus:ring-2 focus:ring-[#2E86AB]/20 w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-content-border bg-content-surface/80">
              {['Token', 'Patient', 'Age/Sex', 'Priority', 'Complaint', 'Wait', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredArrivals.length > 0 ? (
              filteredArrivals.map((row) => (
                <tr key={row.token} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: accentColor }}>{row.token}</td>
                  <td className="px-4 py-3 text-ink font-medium">{row.patient}</td>
                  <td className="px-4 py-3 text-slate-600">{row.ageSex}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_STYLES[row.priority])}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.complaint}</td>
                  <td className="px-4 py-3 text-slate-600">{row.wait}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[row.status])}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-ink transition-colors" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCheckedIn((s) => { const n = new Set(s); n.add(row.token); return n; })}
                        className={cn('p-1.5 rounded-lg transition-colors', checkedIn.has(row.token) ? 'text-emerald-600' : 'text-slate-500 hover:text-ink hover:bg-slate-100')}
                        title="Check In"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-ink transition-colors" title="Bill">
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No patients match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
