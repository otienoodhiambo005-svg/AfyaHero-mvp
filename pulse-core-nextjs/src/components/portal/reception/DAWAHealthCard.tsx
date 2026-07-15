'use client';

import React from 'react';
import { Heart, Settings } from 'lucide-react';

export function DAWAHealthCard() {
  return (
    <div className="bg-content-bg rounded-3xl border border-content-border overflow-hidden shadow-card relative group transition-all hover:shadow-md">
      {/* Orange Accent Line */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-orange-500 rounded-r-full" />
      
      <div className="p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-card bg-orange-50 flex items-center justify-center border border-orange-100 shadow-inner">
              <Heart className="w-7 h-7 text-orange-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-ink tracking-tight">DAWA Health Tracking</h3>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                View patient health metrics, vital sign logs, and recent activity. Review pending data updates for current patients.
              </p>
            </div>
          </div>
          
          <button className="p-2 rounded-card text-slate-300 hover:bg-content-surface hover:text-slate-500 transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button className="px-8 py-3.5 rounded-card bg-[#082C29] text-white font-bold text-[13px] hover:bg-[#0c3e3a] transition-all shadow-lg shadow-black/5 active:scale-95">
            View Vitals
          </button>
          <button className="px-8 py-3.5 rounded-card bg-[#E0E7E6] text-[#082C29] font-bold text-[13px] hover:bg-slate-200 transition-all active:scale-95">
            Update Logs
          </button>
        </div>
      </div>
    </div>
  );
}
