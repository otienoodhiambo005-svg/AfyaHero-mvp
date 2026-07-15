/**
 * Demo Landing Page
 * Redirects to appropriate portal based on token
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';

function DemoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(() => (
    token ? null : 'Invalid demo access. Please request a demo from AfyaHero.'
  ));

  useEffect(() => {
    if (!token) {
      return;
    }

    // Set the session cookie and redirect to the portal
    const setupDemo = async () => {
      try {
        const res = await fetch('/api/auth/demo-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          const data = await res.json();
          router.push(data.redirectUrl);
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to setup demo session');
        }
      } catch {
        setError('Network error. Please try again.');
      }
    };

    void setupDemo();
  }, [token, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-content-canvas">
        <div className="text-center max-w-md p-8 bg-content-bg rounded-card border border-content-border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-ink mb-2">Demo Access Error</h1>
          <p className="text-slate mb-6">{error}</p>
          <a
            href="/auth/login"
            className="inline-block px-6 py-2 bg-violet-600 text-white rounded-control hover:bg-violet-700 transition-colors"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-content-canvas">
      <div className="text-center">
        <Loader2 className="w-12 h-12 mx-auto mb-4 text-violet-600 animate-spin" />
        <h1 className="text-xl font-semibold text-ink mb-2">Setting up your demo...</h1>
        <p className="text-slate">Please wait while we prepare the showcase experience.</p>
      </div>
    </div>
  );
}

export default function DemoLandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-content-canvas">
          <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
        </div>
      }
    >
      <DemoContent />
    </Suspense>
  );
}
