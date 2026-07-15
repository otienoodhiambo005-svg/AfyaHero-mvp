'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Eye, EyeOff, Mail, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import type { PortalConfig } from '@/types';
import DemoAccessPanel, { type DemoCredential } from '@/components/auth/DemoAccessPanel';

interface PortalLoginProps {
  config: PortalConfig;
}

const PORTAL_ICONS: Record<string, string> = {
  reception: '🏛️',
  medical: '🩺',
  lab: '🧪',
  pharmacy: '💊',
  admin: '👨‍💼',
  super_admin: '🛡️',
};

export default function PortalLogin({ config }: PortalLoginProps) {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DEFAULT_DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';
  const demoPassword = config.role === 'super_admin'
    ? undefined
    : config.demoPassword ?? DEFAULT_DEMO_PASSWORD;
  const canUseDemoLogin = Boolean(config.demoEmail && demoPassword);

  const demoCredentials: DemoCredential[] = [];
  if (canUseDemoLogin && demoPassword) {
    if (config.demoCredentials && config.demoCredentials.length > 0) {
      config.demoCredentials.forEach((cred) => {
        demoCredentials.push({
          label: cred.label,
          identifierLabel: 'Email',
          identifier: cred.email,
          password: demoPassword,
          meta: `${cred.name} · ${cred.title}`,
        });
      });
    } else {
      demoCredentials.push({
        label: `${config.label} demo`,
        identifierLabel: 'Email',
        identifier: config.demoEmail,
        password: demoPassword,
        meta: `${config.demoName} · ${config.demoTitle}`,
      });
    }
  }
  
  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const forgotDialogRef = useRef<HTMLDivElement>(null);

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem(`afyahero_remember_email_${config.role}`);
    if (rememberedEmail) {
      setStaffId(rememberedEmail);
      setRememberMe(true);
    }
  }, [config.role]);

  const autofillDemo = (credential: DemoCredential) => {
    if (!canUseDemoLogin) return;
    setStaffId(credential.identifier);
    setPassword(credential.password);
    setError(null);
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      // Clear remembered email if unchecked
      localStorage.removeItem(`afyahero_remember_email_${config.role}`);
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
        
        // Auto-close modal after success
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

    // Remember Email or Staff ID if checkbox is checked
    if (rememberMe && staffId) {
      localStorage.setItem(`afyahero_remember_email_${config.role}`, staffId.trim());
    } else {
      localStorage.removeItem(`afyahero_remember_email_${config.role}`);
    }

    try {
      // Try production login via Supabase Auth
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: staffId.trim(),
          password,
          portal: config.role,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = data.redirectTo;
        return;
      }

      // If production login fails, try demo login for exploration
      const enteredEmail = staffId.trim().toLowerCase();
      const isDemoUser = enteredEmail === config.demoEmail?.toLowerCase() || 
        (config.demoCredentials?.some(c => c.email.toLowerCase() === enteredEmail) ?? false);

      if (isDemoUser && demoPassword && password === demoPassword) {
        const demoRes = await fetch('/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: enteredEmail,
            password: password,
          }),
        });

        const demoData = await demoRes.json();
        if (demoRes.ok && demoData.ok) {
          window.location.href = demoData.redirect;
          return;
        }
      }

      setError(data.error ?? 'Invalid credentials. Please check your email and password.');
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const accent = config.accentColor;

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
      {/* Background image with gradient fallback */}
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
      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] blur-[150px] -mr-80 -mt-80 pointer-events-none rounded-full z-[1]"
        style={{ background: `${accent}12` }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-forest/25 blur-[130px] -ml-80 -mb-80 pointer-events-none rounded-full z-[1]" />

      <div className="w-full max-w-[440px] relative z-10">
        {/* Back to portal selector */}
        <Link href="/" className="flex items-center gap-2 text-mist/60 hover:text-mist text-xs font-medium mb-8 transition-colors group w-fit">
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          All Portals
        </Link>

        <div
          className="p-10 rounded-[36px] bg-white border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all"
          style={{ borderColor: `${accent}40`, boxShadow: `0 32px 64px -16px rgba(0,0,0,0.5), 0 0 80px ${accent}08` }}
        >
          {/* Brand + Portal badge */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border text-xl"
                style={{ background: `${accent}15`, borderColor: `${accent}30`, boxShadow: `0 4px 20px ${accent}15` }}>
                {PORTAL_ICONS[config.role]}
              </div>
              <div className="w-px h-8 bg-white/10" />
              <Image src="/afyahero-icon.jpeg" alt="AfyaHero" width={40} height={40} className="rounded-xl" />
            </div>
            <h1 className="text-3xl font-bold text-emerald mb-1 font-logo drop-shadow-md tracking-tight">AfyaHero</h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-mono border mt-2"
              style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}>
              <span>{config.label} Portal</span>
            </div>
            <p className="text-mist/60 text-xs mt-2">{config.subtitle}</p>
          </div>

          {demoCredentials.length > 0 && (
            <DemoAccessPanel
              accent={accent}
              credentials={demoCredentials}
              activeIdentifier={staffId}
              onUse={autofillDemo}
            />
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-xs font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-2 block">
                Email or Staff ID
              </label>
              <input
                type="text"
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. you@hospital.com or MED-1004"
                className="w-full bg-slate-50 border border-slate-200 text-ink rounded-2xl px-5 py-3.5 text-sm outline-none transition-all placeholder:text-charcoal/60 font-sans shadow-sm"
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                onFocus={(e) => e.target.style.borderColor = `${accent}50`}
                onBlur={(e) => e.target.style.borderColor = ''}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-ink text-sm outline-none transition-all placeholder:text-charcoal/60 pr-12 font-sans shadow-sm"
                  onFocus={(e) => e.target.style.borderColor = `${accent}50`}
                  onBlur={(e) => e.target.style.borderColor = ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-mist/40 hover:text-mist transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.15em] text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 shadow-xl mt-2"
              style={{
                background: loading ? `${accent}80` : accent,
                boxShadow: `0 8px 32px ${accent}30`,
              }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Access {config.label} Portal
                  <Sparkles className="w-3.5 h-3.5 opacity-60" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-forest-light/10 text-center space-y-2">
            <p className="text-mist/40 text-xs">
              New staff?{' '}
              <Link href="/auth/register" className="font-bold transition-colors hover:opacity-80" style={{ color: accent }}>
                Request access
              </Link>
            </p>
          </div>
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
            aria-labelledby="forgot-password-title"
            aria-describedby="forgot-password-description"
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
                <h3 className="text-xl font-bold text-emerald mb-2">Check your email</h3>
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
                  <h3 id="forgot-password-title" className="text-xl font-bold text-emerald mb-1">Forgot Password?</h3>
                  <p id="forgot-password-description" className="text-mist/60 text-sm">
                    Enter your Email or Staff ID and we&apos;ll send instructions to your registered email to reset your password.
                  </p>
                </div>

                {/* Error Message */}
                {forgotPasswordError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {forgotPasswordError}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-mist uppercase tracking-[0.2em] font-mono mb-2 block">
                      Email or Staff ID
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="e.g. MED-1004"
                      className="w-full bg-[#0C1510] border border-forest-light/15 rounded-xl px-5 py-3.5 text-white text-sm outline-none transition-all placeholder:text-mist/30 font-sans"
                      style={{ '--tw-ring-color': accent } as React.CSSProperties}
                      onFocus={(e) => e.target.style.borderColor = `${accent}50`}
                      onBlur={(e) => e.target.style.borderColor = ''}
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
