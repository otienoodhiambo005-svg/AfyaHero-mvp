import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';

// Hospital-side portals only. Super Admin login is intentionally excluded —
// platform administrators access `/auth/superadmin/login` directly via a
// non-discoverable URL (or via standalone superadmin mode).
const PORTAL_LINKS = [
  { label: 'Reception', href: '/auth/reception/login' },
  { label: 'Medical', href: '/auth/medical/login' },
  { label: 'Laboratory', href: '/auth/lab/login' },
  { label: 'Pharmacy', href: '/auth/pharmacy/login' },
  { label: 'Admin', href: '/auth/admin/login' },
];

export const metadata: Metadata = {
  title: 'AfyaHero Pulse — Login',
  description: 'Select your AfyaHero Pulse portal to sign in securely.',
};

export default function LoginPage() {
  if (isStandaloneSuperAdminMode()) {
    redirect('/auth/superadmin/login');
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Choose Login Portal</h1>
        <p className="text-sm text-slate-600">Select your hospital role to continue.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PORTAL_LINKS.map((portal) => (
            <Link
              key={portal.href}
              href={portal.href}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              {portal.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
