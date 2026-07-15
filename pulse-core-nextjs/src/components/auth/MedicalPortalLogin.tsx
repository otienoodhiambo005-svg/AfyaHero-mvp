'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Eye, EyeOff, Stethoscope, Heart, Mail, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { LoginSchema } from '@/lib/schemas';
import DemoAccessPanel, { type DemoCredential } from '@/components/auth/DemoAccessPanel';

const DEFAULT_DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';

const PERSONAS = [
  {
    key: 'doctor',
    label: 'Doctor',
    icon: <Stethoscope className="w-5 h-5" />,
    name: 'Dr. Amina Osei',
    title: 'Senior Medical Officer',
    accent: '#3B8B6E',
    staffId: 'DOC-1002',
    email: 'demo@medical.afyahero.com',
    password: DEFAULT_DEMO_PASSWORD,
    tagline: 'AI-assisted clinical decision support',
  },
  {
    key: 'nurse',
    label: 'Nurse',
    icon: <Heart className="w-5 h-5" />,
    name: 'Nurse Jane Wambui',
    title: 'Registered Nurse',
    accent: '#2A7BBE',
    staffId: 'MED-1001',
    email: 'demo@nurse.afyahero.com',
    password: DEFAULT_DEMO_PASSWORD,
    tagline: 'Vitals, medications & patient care',
  },
];

export default function MedicalPortalLogin() {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const forgotDialogRef = useRef<HTMLDivElement>(null);

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('afyahero_remember_email_medical');
    if (rememberedEmail) {
      setStaffId(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const autofill = (persona: typeof PERSONAS[number]) => {
    setStaffId(persona.staffId);
    setPassword(persona.password);
    setActivePersona(persona.key);
    setError(null);
  };

  const autofillDemoCredential = (credential: DemoCredential) => {
    const persona = PERSONAS.find((item) => item.staffId === credential.identifier);
    if (persona) {
      autofill(persona);
      return;
    }

    setStaffId(credential.identifier);
    setPassword(credential.password);
    setActivePersona(null);
    setError(null);
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      localStorage.removeItem('afyahero_remember_email_medical');
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError(null);
    setForgotPasswordSuccess(false);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: forgotPasswordEmail.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setForgotPasswordSuccess(true);
        setForgotPasswordEmail('');
        
        setTimeout(() => {
          setShowForgotPassword(false);
          setForgotPasswordSuccess(false);
        }, 3000);
      } else {
        setForgotPasswordError(data.error ?? 'Failed to send reset email. Please try again.');
      }
    } catch {
      setForgotPasswordError('Connection error. Please try again.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation
    const validation = LoginSchema.safeParse({
      staffId: staffId.trim(),
      password,
      portal: 'medical',
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Invalid input');
      setLoading(false);
      return;
    }

    // Remember Staff ID if checkbox is checked
    if (rememberMe && staffId) {
      localStorage.setItem('afyahero_remember_email_medical', staffId.trim());
    } else {
      localStorage.removeItem('afyahero_remember_email_medical');
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = data.redirectTo;
        return;
      }

      // Fallback to demo login if production login fails and we have a persona 
      const persona = PERSONAS.find(p => p.key === activePersona);
      if (persona && password) {
        const demoRes = await fetch('/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: persona.email,
            password,
          }),
        });

        const demoData = await demoRes.json();
        if (demoRes.ok && demoData.ok) {
          window.location.href = demoData.redirect;
          return;
        }
      }

      setError(data.error ?? 'Login failed. Check your credentials.');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentPersona = PERSONAS.find(p => p.key === activePersona);
  const accent = currentPersona?.accent ?? '#3B8B6E';
  const demoCredentials: DemoCredential[] = PERSONAS.map((persona) => ({
    label: persona.label,
    identifierLabel: 'Staff ID',
    identifier: persona.staffId,
    password: persona.password,
    meta: `${persona.name} · ${persona.title}`,
  }));
  const loginIdentifierId = 'medical-login-identifier';
  const loginPasswordId = 'medical-login-password';
  const rememberMeId = 'medical-remember-me';
  const loginErrorId = 'medical-login-error';
  const forgotPasswordIdentifierId = 'medical-forgot-password-identifier';
  const forgotPasswordErrorId = 'medical-forgot-password-error';

  useEffect(() => {
    if (!showForgotPassword) return;

    const container = forgotDialogRef.current;
    if (!container) return;

    const focusable = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowForgotPassword(false);
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [showForgotPassword]);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-6 relative overflow-hidden font-sans antialiased">
      {/* Background with gradient fallback */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-[#3282B8] via-[#0F4C75] to-[#89C4E8]"
          style={{ opacity: 0.95 }}
        />
        <Image 
          src="/login-bg.png" 
          alt="" 
          fill 
          className="object-cover opacity-100" 
          priority 
          onError={(e) => {
            // Image failed to load, hide it and show gradient
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] blur-[150px] -mr-80 -mt-80 pointer-events-none rounded-full z-[1]"
        style={{ background: `${accent}12` }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-forest/25 blur-[130px] -ml-80 -mb-80 pointer-events-none rounded-full z-[1]" />

      <div className="w-full max-w-[480px] relative z-10">
        <Link href="/" className="flex items-center gap-2 text-mist/60 hover:text-mist text-xs font-medium mb-8 transition-colors group w-fit">
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          All Portals
        </Link>

        <div
          className="p-10 rounded-[36px] bg-white border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all"
          style={{ borderColor: `${accent}40`, boxShadow: `0 32px 64px -16px rgba(0,0,0,0.5), 0 0 80px ${accent}08` }}
        >
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border text-2xl"
                style={{ background: `${accent}15`, borderColor: `${accent}30` }}>
                🩺
              </div>
              <div className="w-px h-8 bg-white/10" />
              <Image src="/afyahero-icon.jpeg" alt="AfyaHero" width={40} height={40} className="rounded-xl" />
            </div>
            <h1 className="text-3xl font-bold text-emerald mb-1 font-logo drop-shadow-md tracking-tight">AfyaHero</h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-mono border mt-2"
              style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}>
              Medical Portal
            </div>
            <p className="text-mist/60 text-xs mt-2">Clinical tools for doctors and nurses</p>
          </div>

          {/* Persona cards */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-mist/50 uppercase tracking-[0.2em] font-mono mb-3 text-center">
              Try a demo persona
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PERSONAS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => autofill(p)}
                  className="group relative p-4 rounded-2xl border text-left transition-all"
                  style={{
                    borderColor: activePersona === p.key ? `${p.accent}60` : `${p.accent}20`,
                    background: activePersona === p.key ? `${p.accent}18` : `${p.accent}08`,
                    boxShadow: activePersona === p.key ? `0 0 20px ${p.accent}20` : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                      style={{ background: p.accent }}>
                      {p.icon}
                    </div>
                    <span className="text-xs font-bold text-mist/90">{p.label}</span>
                    {activePersona === p.key && (
                      <span className="ml-auto">
                        <Sparkles className="w-3.5 h-3.5" style={{ color: p.accent }} />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold" style={{ color: p.accent }}>{p.name}</p>
                  <p className="text-[10px] text-mist/50 mt-0.5">{p.tagline}</p>
                </button>
              ))}
            </div>
          </div>

          <DemoAccessPanel
            accent={accent}
            credentials={demoCredentials}
            activeIdentifier={staffId}
            onUse={autofillDemoCredential}
          />

          {error && (
            <div
              id={loginErrorId}
              role="alert"
              aria-live="assertive"
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-xs font-medium text-center"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor={loginIdentifierId} className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-2 block">
                Email or Staff ID
              </label>
              <input
                id={loginIdentifierId}
                name="email"
                type="text"
                autoComplete="username"
                required
                value={staffId}
                onChange={e => { setStaffId(e.target.value); setActivePersona(null); }}
                placeholder="e.g. you@hospital.com or DOC-1002"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? loginErrorId : undefined}
                className="w-full bg-slate-50 border border-slate-200 text-ink rounded-2xl px-4 py-3 text-sm outline-none focus:border-slate-300 focus:bg-white transition-all placeholder:text-charcoal/60 font-sans shadow-sm"
              />
            </div>

            <div>
              <label htmlFor={loginPasswordId} className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  id={loginPasswordId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? loginErrorId : undefined}
                  className="w-full bg-slate-50 border border-slate-200 text-ink rounded-2xl px-4 py-3 pr-11 text-sm outline-none focus:border-slate-300 focus:bg-white transition-all placeholder:text-ink/40 font-mono shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-mist/40 hover:text-mist/70 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white tracking-wide transition-all disabled:opacity-50"
              style={{ background: accent }}
            >
              {loading ? 'Signing in…' : `Sign in${currentPersona ? ` as ${currentPersona.label}` : ''}`}
            </button>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    id={rememberMeId}
                    name="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => handleRememberMeChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-4 h-4 rounded border border-mist/30 peer-checked:border-transparent peer-checked:bg-emerald-500 transition-all flex items-center justify-center"
                    style={{ backgroundColor: rememberMe ? accent : 'transparent', borderColor: rememberMe ? accent : '' }}
                  >
                    {rememberMe && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-xs text-mist/60 group-hover:text-mist/80 transition-colors">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: accent }}
              >
                Forgot password?
              </button>
            </div>
          </form>

          <p className="text-center text-[11px] text-mist/40 mt-6">
            Protected health system · AfyaHero v2.0
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowForgotPassword(false)}
          />
          
          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="medical-forgot-password-title"
            aria-describedby="medical-forgot-password-description"
            ref={forgotDialogRef}
            className="relative w-full max-w-md bg-forest rounded-3xl border border-forest-light/20 p-8 shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setForgotPasswordSuccess(false);
                setForgotPasswordError(null);
                setForgotPasswordEmail('');
              }}
              className="absolute top-4 right-4 text-mist/40 hover:text-mist transition-colors"
              aria-label="Close forgot password dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Success State */}
            {forgotPasswordSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 id="medical-forgot-password-title" className="text-xl font-bold text-emerald mb-2">Check your email</h3>
                <p className="text-mist/60 text-sm">
                  We&apos;ve sent password reset instructions to your email address. Please check your inbox and follow the link to reset your password.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${accent}15`, borderColor: `${accent}30` }}>
                    <Mail className="w-6 h-6" style={{ color: accent }} />
                  </div>
                  <h3 id="medical-forgot-password-title" className="text-xl font-bold text-emerald mb-1">Forgot Password?</h3>
                  <p id="medical-forgot-password-description" className="text-mist/60 text-sm">
                    Enter your Staff ID and we&apos;ll send instructions to your registered email to reset your password.
                  </p>
                </div>

                {/* Error Message */}
                {forgotPasswordError && (
                  <div
                    id={forgotPasswordErrorId}
                    role="alert"
                    aria-live="assertive"
                    className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-2"
                  >
                    <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                    {forgotPasswordError}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label htmlFor={forgotPasswordIdentifierId} className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-2 block">
                      Staff ID
                    </label>
                    <input
                      id={forgotPasswordIdentifierId}
                      name="email"
                      type="text"
                      autoComplete="username"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="e.g. DOC-1002"
                      aria-invalid={Boolean(forgotPasswordError)}
                      aria-describedby={forgotPasswordError ? forgotPasswordErrorId : 'medical-forgot-password-description'}
                      className="w-full bg-slate-50 border border-slate-200 text-ink rounded-2xl px-4 py-3 text-sm outline-none focus:border-slate-300 focus:bg-white transition-all placeholder:text-charcoal/60 font-sans shadow-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotPasswordLoading}
                    className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-[0.15em] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg"
                    style={{
                      background: forgotPasswordLoading ? `${accent}80` : accent,
                      boxShadow: `0 4px 16px ${accent}20`,
                    }}
                  >
                    {forgotPasswordLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-forest-light/10 text-center">
              <p className="text-mist/40 text-xs">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="font-bold transition-colors hover:opacity-80"
                  style={{ color: accent }}
                >
                  Back to login
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
