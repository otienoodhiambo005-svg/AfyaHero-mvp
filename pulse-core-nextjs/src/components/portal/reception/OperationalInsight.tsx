'use client';

import React from 'react';
import { Brain } from 'lucide-react';

interface OperationalInsightProps {
  accentColor: string;
}

export function OperationalInsight({ accentColor }: OperationalInsightProps) {
  return (
    <div
      className="rounded-[2.5rem] p-8 border bg-[#080F0C] shadow-2xl relative overflow-hidden group"
      style={{ borderColor: `${accentColor}20` }}
    >
      {/* Removed decorative gradient background */}
      <div className="flex items-start gap-6 relative z-10">
        <div className="w-12 h-12 rounded-card bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center shrink-0">
          <Brain className="w-6 h-6 text-[#2563EB] animate-pulse" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: accentColor }}>AI Operational Intelligence</p>
          <p className="text-sm text-white/80 leading-relaxed font-medium">
            <strong className="text-white">High Arrival Notice:</strong> Seasonal malaria surge detected via CHW screening trends. 
            Expected overflow for peds urgency scoring at <span className="text-[#2563EB] font-bold">1:30 PM</span>. Active SHIF eligibility rate is <span className="text-emerald-400 font-bold">92%</span> today (+5% vs avg).
          </p>
        </div>
      </div>
    </div>
  );
}
