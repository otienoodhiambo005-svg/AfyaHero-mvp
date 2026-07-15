'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Hospital, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { PORTALS } from '@/types';
import type { PortalRole } from '@/types';

interface InviteInfo {
  success: boolean;
  hospitalName: string;
  location?: string;
  role: PortalRole;
  department?: string;
  error?: string;
}

export default function OnboardPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    title: '',
    staffId: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/staff/verify-invite?token=${token}`);
        const data = await res.json();
        if (res.ok) {
          setInvite(data);
        } else {
          setError(data.error ?? 'Invalid or expired invitation.');
        }
      } catch {
        setError('Connection error. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setRegistering(true);
    setError(null);

    try {
      const res = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          invitationToken: token,
          // hospitalCode and role are inferred from token on backend, but we send them to be safe if schema requires (backend now handles it)
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error ?? 'Registration failed.');
      }
    } catch {
      setError('Registration failed. Please check your connection.');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080F0C] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Verifying Secure Invitation...</p>
      </main>
    );
  }

  if (error && !invite) {
    return (
      <main className="min-h-screen bg-[#080F0C] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <Hospital className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invitation Error</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-8">{error}</p>
        <Link href="/" className="px-8 py-3 bg-white text-black font-bold rounded-2xl text-sm transition-transform hover:scale-105 active:scale-95">
          Back to Portal
        </Link>
      </main>
    );
  }

  const roleConfig = invite ? PORTALS[invite.role] : null;
  const accent = roleConfig?.accentColor ?? '#2563EB';

  if (success) {
    return (
      <main className="min-h-screen bg-[#080F0C] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8 animate-in fade-in zoom-in duration-500">
          <CheckCircle className="w-12 h-12 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Onboarding Complete</h1>
        <p className="text-slate-400 text-sm max-w-md mb-10 leading-relaxed">
          Welcome to the team at <span className="text-white font-bold">{invite?.hospitalName}</span>. 
          Your account is now <span className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">Active</span>. 
          You can now sign in to your dashboard.
        </p>
        <Link 
          href={roleConfig?.loginPath ?? '/'} 
          className="px-10 py-4 bg-white text-black font-extrabold rounded-2xl text-sm transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95 flex items-center gap-2"
        >
          Sign In to Portal <Sparkles className="w-4 h-4" />
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080F0C] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-10 space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3" /> Secure Invitation Verified
              </span>
            </div>
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Join {invite?.hospitalName}</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            You&apos;ve been invited as a <span className="text-white font-bold">{roleConfig?.label}</span>
            {invite?.department ? ` in the ${invite.department} department` : ''}.
            Complete your profile to get started.
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-[#0c1410] border border-white/5 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16" />
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-2xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Full Name</label>
              <input
                required
                type="text"
                placeholder="Dr. Amina Osei"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full bg-[#111b16] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Professional Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Surgeon"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#111b16] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Staff ID</label>
              <input
                required
                type="text"
                placeholder="e.g. DOC-1002"
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                className="w-full bg-[#111b16] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Work Email</label>
              <input
                required
                type="email"
                placeholder="you@hospital.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[#111b16] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Password</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[#111b16] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Confirm</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full bg-[#111b16] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>

            <button
              type="submit"
              disabled={registering}
              style={{ background: accent }}
              className="md:col-span-2 mt-4 py-4 rounded-2xl font-extrabold text-xs uppercase tracking-[0.2em] text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-blue-900/10"
            >
              {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>Complete Onboarding <UserCheck className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-10 text-slate-600 text-[10px] font-medium uppercase tracking-[0.1em]">
          Powered by AfyaHero Digital Health Platform
        </p>
      </div>
    </main>
  );
}
