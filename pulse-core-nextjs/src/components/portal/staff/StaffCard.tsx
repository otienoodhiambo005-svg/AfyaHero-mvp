'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, Mail, Hash, Calendar,
  ExternalLink, ShieldCheck, BadgeAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens } from '@/styles/design-tokens';
import { useState, useEffect } from 'react';

interface StaffCardProps {
  member: {
    id: string;
    name: string;
    role: string;
    department: string;
    email: string;
    staffId: string;
    regDate: string;
    licenseExpiry?: string;
  };
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function StaffCard({ member, onApprove, onReject }: StaffCardProps) {
  const ACCENT = tokens.colors.portals.admin;
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  useEffect(() => {
    const licenseExpiry = member.licenseExpiry;
    if (!licenseExpiry) {
      setTimeout(() => setIsExpiringSoon(false), 0);
      return;
    }
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    setTimeout(() => setIsExpiringSoon(new Date(licenseExpiry) < new Date(Date.now() + thirtyDaysInMs)), 0);
  }, [member.licenseExpiry]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="group relative bg-content-bg border border-content-border rounded-[24px] p-6 shadow-card hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
    >
      {/* Background Glow - removed decorative gradient */}

      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div 
              className="w-14 h-14 rounded-card flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20"
              style={{ backgroundColor: ACCENT }}
            >
              {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h3 className="text-ink font-black tracking-tight text-lg">{member.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">{member.role}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">{member.department}</span>
              </div>
            </div>
          </div>
          
          <div className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pending Verification</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Mail className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Official Email</span>
            </div>
            <p className="text-xs font-semibold text-slate-700 truncate">{member.email}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Hash className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Staff ID</span>
            </div>
            <p className="text-xs font-mono font-bold text-ink tracking-tight">{member.staffId}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Registration</span>
            </div>
            <p className="text-xs font-semibold text-slate-700">{member.regDate}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Credentials</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-emerald-600">VERIFIED</span>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            </div>
          </div>
        </div>

        {isExpiringSoon && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-card">
            <BadgeAlert className="w-4 h-4 text-rose-500" />
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">
              License Expiry: {member.licenseExpiry} — Renew immediately
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onApprove(member.id)}
            className="flex-1 group/btn relative flex items-center justify-center gap-2 py-3 bg-slate-900 overflow-hidden rounded-card text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95"
          >
            <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2">
              Approve Access
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </button>
          <button
            onClick={() => onReject(member.id)}
            className="flex items-center justify-center px-4 py-3 bg-content-surface border border-content-border rounded-card text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all active:scale-95"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-content-surface border border-content-border rounded-card text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 transition-all active:scale-95">
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
