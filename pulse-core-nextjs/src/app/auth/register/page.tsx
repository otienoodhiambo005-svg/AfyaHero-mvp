'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Sparkles, CheckCircle } from 'lucide-react';
import { PORTALS } from '@/types';
import type { PortalRole } from '@/types';
import { StaffRegistrationSchema } from '@/lib/schemas';

const ROLE_OPTIONS: { value: PortalRole; label: string; subtitle: string; emoji: string }[] = [
  { value: 'reception', label: 'Reception Staff', subtitle: 'Front desk, billing, queue management', emoji: '🏛️' },
  { value: 'medical', label: 'Medical Professional', subtitle: 'Doctor, clinical officer, nurse', emoji: '🩺' },
  { value: 'lab', label: 'Lab Technician', subtitle: 'Sample processing, results entry', emoji: '🧪' },
  { value: 'pharmacy', label: 'Pharmacist', subtitle: 'Dispensing, inventory, formulary', emoji: '💊' },
  { value: 'admin', label: 'Hospital Administrator', subtitle: 'Operations, analytics, oversight', emoji: '👨‍💼' },
];

export default function RegisterPage() {
  const [step, setStep] = useState<'role' | 'details' | 'success'>('role');
  const [selectedRole, setSelectedRole] = useState<PortalRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string>('pending');
   const [form, setForm] = useState({
     fullName: '', title: '', department: '', staffId: '',
     hospitalCode: '', email: '', password: '', confirmPassword: '',
   });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);

    // Client-side validation
    const validation = StaffRegistrationSchema.safeParse({
      fullName: form.fullName,
      title: form.title,
      department: form.department,
      staffId: form.staffId,
      hospitalCode: form.hospitalCode,
      email: form.email,
      password: form.password,
      role: selectedRole,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Invalid input');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setSubmissionStatus((body.status as string | undefined) ?? 'pending');
      setStep('success');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const accent = selectedRole ? PORTALS[selectedRole].accentColor : '#10B981';

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center p-6 relative overflow-hidden font-sans antialiased">
      <div className="absolute inset-0 bg-[#080F0C]" />

      <div className="w-full max-w-[520px] relative z-10">
        <Link href="/" className="flex items-center gap-2 text-mist/60 hover:text-mist text-xs font-medium mb-8 transition-colors group w-fit">
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Portal Selector
        </Link>

        <div className="p-10 rounded-[36px] bg-[#0c1410] border border-forest-light/15 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">

          {/* Success state */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald/15 rounded-full flex items-center justify-center border border-emerald/25 mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-emerald" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3 font-serif">Request Submitted</h2>
              <p className="text-mist text-sm leading-relaxed mb-6">
                Your access request has been submitted. A hospital administrator will review and approve your account.
                You will receive an email once approved.
              </p>
              <p className="text-mist/40 text-xs font-mono mb-6">Status: {submissionStatus.toUpperCase()} (Awaiting Hospital Admin Approval)</p>
              <Link
                href={selectedRole ? PORTALS[selectedRole].loginPath : '/'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-emerald/90"
              >
                Go to Login
              </Link>
            </div>
          )}

          {/* Step 1: Select role */}
          {step === 'role' && (
            <>
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-emerald/10 rounded-xl flex items-center justify-center border border-emerald/20 mx-auto mb-5">
                  <Activity className="w-6 h-6 text-emerald" />
                </div>
                <h1 className="text-3xl font-semibold text-white mb-2 font-serif tracking-tight">Request Access</h1>
                <p className="text-mist/60 text-xs">Select your role to begin registration</p>
              </div>

              <div className="space-y-2.5">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRole(opt.value)}
                    className="w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 group"
                    style={{
                      borderColor: selectedRole === opt.value ? `${PORTALS[opt.value].accentColor}50` : 'rgba(255,255,255,0.06)',
                      background: selectedRole === opt.value ? `${PORTALS[opt.value].accentColor}10` : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span className="text-2xl shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{opt.label}</div>
                      <div className="text-xs text-mist/50 mt-0.5">{opt.subtitle}</div>
                    </div>
                    {selectedRole === opt.value && (
                      <CheckCircle className="w-4 h-4 shrink-0" style={{ color: PORTALS[opt.value].accentColor }} />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!selectedRole}
                onClick={() => setStep('details')}
                className="w-full mt-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.15em] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                style={{ background: selectedRole ? accent : '#374151' }}
              >
                Continue <Sparkles className="w-3.5 h-3.5 opacity-60" />
              </button>
            </>
          )}

          {/* Step 2: Personal details */}
          {step === 'details' && selectedRole && (
            <>
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => setStep('role')} className="p-2 rounded-xl bg-forest/30 text-mist/60 hover:text-mist transition-colors text-xs">
                  ←
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-white font-serif">Staff Details</h2>
                  <p className="text-mist/50 text-xs mt-0.5">{PORTALS[selectedRole].label} · Pending Approval</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-xs">{error}</div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                {[
                  { key: 'fullName', label: 'Full Name', placeholder: 'e.g. Dr. Amina Osei', type: 'text' },
                  { key: 'title', label: 'Professional Title', placeholder: 'e.g. Senior Medical Officer', type: 'text' },
                  { key: 'department', label: 'Department', placeholder: 'e.g. Emergency Medicine', type: 'text' },
                  { key: 'staffId', label: 'Staff ID', placeholder: 'Issued on onboarding (e.g. DOC-1002)', type: 'text' },
                  { key: 'hospitalCode', label: 'Hospital Code', placeholder: 'Provided by administrator', type: 'text' },
                  { key: 'email', label: 'Work Email', placeholder: 'you@hospital.com', type: 'email' },
                  { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
                  { key: 'confirmPassword', label: 'Confirm Password', placeholder: '••••••••', type: 'password' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-1.5 block">{field.label}</label>
                    <input
                      type={field.type}
                      required
                      placeholder={field.placeholder}
                      value={form[field.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full bg-forest-mid/25 border border-forest-light/15 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-mist/25 transition-all"
                      onFocus={(e) => e.target.style.borderColor = `${accent}50`}
                      onBlur={(e) => e.target.style.borderColor = ''}
                    />
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.15em] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
                  style={{ background: accent, boxShadow: `0 8px 32px ${accent}30` }}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                    <>Submit for Approval <Sparkles className="w-3.5 h-3.5 opacity-60" /></>
                  )}
                </button>
              </form>
            </>
          )}

          {step !== 'success' && (
            <p className="text-center mt-6 text-mist/30 text-xs font-mono">
              Already approved?{' '}
              <Link href={selectedRole ? PORTALS[selectedRole].loginPath : '/'} className="font-bold transition-colors hover:text-mist/60" style={{ color: accent }}>
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
