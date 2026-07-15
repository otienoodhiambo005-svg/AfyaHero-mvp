'use client';

import { Video, ShieldAlert } from 'lucide-react';

export default function MedicalTeleconsultationPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/20 shadow-sm">
        <Video className="w-10 h-10" />
      </div>
      
      <div className="max-w-md bg-white border border-content-border rounded-[2rem] p-8 shadow-card space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-mono border text-blue-600 border-blue-500/20 bg-blue-500/5">
          <ShieldAlert className="w-3.5 h-3.5" /> Feature Deferred
        </div>
        
        <h1 className="text-3xl font-bold text-ink tracking-tight">Telemedicine &amp; Teleconsultation</h1>
        
        <p className="text-sm text-slate-500 leading-relaxed font-sans">
          Google Meet and Vertex AI-powered telemedicine consultation workstations are deferred in this deployment version. Front-line queue operations and bedside/in-patient clinical documentation are prioritized.
        </p>

        <div className="pt-4">
          <button
            onClick={() => window.location.href = '/portal/medical'}
            className="px-6 py-2.5 rounded-full bg-portal-primary hover:bg-portal-primary-hover text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-md active:scale-[0.98]"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
