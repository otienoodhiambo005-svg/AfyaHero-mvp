'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Shield, Clock, AlertCircle, Key } from 'lucide-react';

interface TwoFactorVerificationProps {
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
  accentColor?: string;
}

export default function TwoFactorVerification({
  userId,
  onVerified,
  onCancel,
  accentColor = '#10b981'
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all digits entered, auto-submit
    if (newCode.every(c => c) && index === 5) {
      setTimeout(() => verifyCode(newCode.join('')), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (verificationCode: string, method = 'totp') => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: verificationCode,
          method
        }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        onVerified();
      } else {
        setError(data.error || 'Invalid verification code');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (backupCode.length >= 8) {
      verifyCode(backupCode, 'backup');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: `${accentColor}15` }}
        >
          <Shield className="w-8 h-8" style={{ color: accentColor }} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Two Factor Authentication</h2>
        <p className="text-sm text-mist/60">
          {useBackupCode
            ? 'Enter one of your backup codes to continue'
            : 'Enter the 6-digit code from your authenticator app'
          }
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!useBackupCode ? (
        <div className="space-y-6">
          <div className="flex justify-center gap-3">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-xl font-bold bg-forest-mid/30 border border-forest-light/15 rounded-xl text-white outline-none transition-all"
                style={{
                  borderColor: digit ? accentColor : '',
                  boxShadow: digit ? `0 0 0 1px ${accentColor}30` : ''
                }}
                disabled={loading}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-mist/40">
            <Clock className="w-3.5 h-3.5" />
            <span>Codes refresh every 30 seconds</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleBackupSubmit} className="space-y-4">
          <input
            type="text"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            className="w-full bg-forest-mid/30 border border-forest-light/15 rounded-xl px-4 py-3.5 text-white text-center font-mono tracking-widest outline-none transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || backupCode.length < 8}
            className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: accentColor }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              'Verify Backup Code'
            )}
          </button>
        </form>
      )}

      <div className="mt-8 pt-4 border-t border-forest-light/10 text-center">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setError(null);
            setCode(['', '', '', '', '', '']);
            setBackupCode('');
          }}
          className="text-xs text-mist/60 hover:text-mist transition-colors flex items-center gap-2 mx-auto"
        >
          <Key className="w-3.5 h-3.5" />
          {useBackupCode
            ? 'Use authenticator app instead'
            : 'Use backup code instead'
          }
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 text-xs text-mist/40 hover:text-mist transition-colors"
        >
          ← Back to login
        </button>
      </div>
    </div>
  );
}