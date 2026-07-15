'use client';

import React from 'react';
import { Check, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  status: 'completed' | 'current' | 'upcoming';
  sub: string;
  alert?: {
    title: string;
    text: string;
  };
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Personal Information',
    status: 'completed',
    sub: 'Confirmed • John Musyoka',
  },
  {
    id: 2,
    title: 'Insurance & SHA Verify',
    status: 'current',
    sub: 'Checking Social Health Authority...',
    alert: {
      title: 'SHA ALERT: MEMBER INACTIVE',
      text: '',
    },
  },
  {
    id: 3,
    title: 'Biometrics & Digital ID',
    status: 'upcoming',
    sub: 'Awaiting Fingerprint Scanner',
  },
];

export function RegistrationStepper() {
  return (
    <div className="bg-content-bg rounded-3xl p-8 border border-content-border shadow-card relative space-y-8">
      <h3 className="text-xl font-bold text-ink tracking-tight">Current Registration</h3>
      
      <div className="space-y-8 relative">
        {/* Connector Line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100 -z-10" />

        {STEPS.map((step) => (
          <div key={step.id} className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-all",
                step.status === 'completed' ? "bg-[#082C29] border-[#082C29] text-white" :
                step.status === 'current' ? "bg-content-bg border-[#082C29] text-[#082C29]" :
                "bg-content-bg border-content-border/50 text-slate-300"
              )}>
                {step.status === 'completed' ? (
                  <Check className="w-5 h-5 stroke-[3]" />
                ) : (
                  <span className="text-sm font-black">{step.id}</span>
                )}
              </div>
              
              <div className="space-y-1 pt-1">
                <p className="font-bold text-ink text-sm leading-tight">{step.title}</p>
                <p className="text-[12px] font-medium text-slate-400">{step.sub}</p>
              </div>
            </div>

            {step.alert && (
              <div className="ml-14 p-4 rounded-card bg-red-50 border border-red-100">
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-red-500 fill-red-500 mt-0.5" />
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-normal">
                    {step.alert.title}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-4">
        <button className="w-full py-4 rounded-card text-slate-500 font-bold text-sm hover:bg-content-surface transition-colors">
          Save Progress
        </button>
      </div>
    </div>
  );
}
