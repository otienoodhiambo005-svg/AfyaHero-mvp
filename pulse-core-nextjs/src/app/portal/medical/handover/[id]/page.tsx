'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, CheckCircle2, AlertCircle, Clock, 
  ExternalLink, User, ShieldCheck, ClipboardCheck, History, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HandoverRecord } from '@/types';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export default function HandoverDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [handover, setHandover] = useState<HandoverRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    const fetchHandover = async () => {
      try {
        const resp = await fetch(`/api/medical/handover`);
        const data = await resp.json();
        const found = (data.items as HandoverRecord[]).find(h => h.id === id);
        if (found) {
          setHandover(found);
        }
      } catch (err) {
        logger.error('Failed to fetch handover detail', { id });
      } finally {
        setLoading(false);
      }
    };
    fetchHandover();
  }, [id]);

  const handleAcknowledge = async () => {
    if (!handover) return;
    setIsAcknowledging(true);
    try {
      const resp = await fetch(`/api/medical/handover/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Acknowledged' })
      });
      if (resp.ok) {
        toast.success('Handover acknowledged successfully');
        router.push('/portal/medical/handover');
      }
    } catch (err) {
      toast.error('Failed to acknowledge handover');
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        <p className="text-sm font-bold font-mono text-text-secondary uppercase tracking-widest">Loading Clinical Record...</p>
      </div>
    );
  }

  if (!handover) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black font-serif">Handover Not Found</h2>
        <button onClick={() => router.back()} className="mt-6 premium-button-secondary">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => router.back()}
          className="p-3 rounded-2xl border border-content-border bg-content-surface hover:bg-content-bg text-text-secondary transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>
        <div className="flex items-center gap-3">
           <span className={cn(
             "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
             handover.status === 'Pending' ? "bg-amber-100/50 text-amber-600 border-amber-200" : "bg-emerald-100/50 text-emerald-600 border-emerald-200"
           )}>
             {handover.status}
           </span>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Patient Hero */}
        <div className="p-8 border-b border-content-border bg-content-surface/40">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 rounded-[2.5rem] bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center">
                    <User className="w-10 h-10 text-[#2563EB]" />
                 </div>
                 <div>
                    <div className="text-[10px] font-bold text-[#2563EB] uppercase tracking-[0.2em] font-mono mb-1">Active Handover Patient</div>
                    <h2 className="text-4xl font-black text-text-primary tracking-tighter font-serif">{handover.patientName}</h2>
                    <p className="text-sm font-medium text-text-secondary mt-1">ID: {handover.patientId} · Admitted to Critical Care</p>
                 </div>
              </div>
              <button 
                onClick={() => router.push(`/portal/medical/patients?id=${handover.patientId}`)}
                className="premium-button-secondary py-4"
              >
                 <ExternalLink className="w-4 h-4" />
                 Open Full Chart
              </button>
           </div>
        </div>

        {/* SBAR Content */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
           {[
             { label: 'Situation', icon: <AlertCircle className="text-rose-500" />, content: handover.situation },
             { label: 'Background', icon: <History className="text-amber-500" />, content: handover.background },
             { label: 'Assessment', icon: <Activity className="text-blue-500" />, content: handover.assessment },
             { label: 'Recommendation', icon: <CheckCircle2 className="text-emerald-500" />, content: handover.recommendation },
           ].map((item) => (
             <div key={item.label} className="space-y-4 p-6 rounded-3xl bg-content-surface/30 border border-content-border group hover:bg-content-surface/50 transition-all">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-2xl bg-content-bg flex items-center justify-center border border-content-border shadow-card group-hover:scale-110 transition-transform">
                      {item.icon}
                   </div>
                   <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">{item.label}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary font-medium">
                   {item.content || "No information documented."}
                </p>
             </div>
           ))}
        </div>

        {/* Footer Signature Block */}
        <div className="p-8 bg-content-surface/50 border-t border-content-border flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-content-bg border border-content-border flex items-center justify-center shadow-lg">
                 <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                 <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">Authored By</p>
                 <p className="text-sm font-black text-text-primary">{handover.senderName}</p>
                 <p className="text-[10px] font-bold text-text-secondary flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3" /> {new Date(handover.createdAt).toLocaleString()}
                 </p>
              </div>
           </div>

           {handover.status === 'Pending' && (
              <button 
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className="premium-button-primary min-w-[280px] shadow-2xl shadow-emerald-500/20"
                style={{ background: '#10B981' }}
              >
                 {isAcknowledging ? (
                   <span className="flex items-center gap-2">
                     <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                     Signing...
                   </span>
                 ) : (
                   <span className="flex items-center gap-2">
                     <ClipboardCheck className="w-5 h-5" />
                     Acknowledge Responsibility
                   </span>
                 )}
              </button>
           )}
        </div>
      </div>
    </div>
  );
}
