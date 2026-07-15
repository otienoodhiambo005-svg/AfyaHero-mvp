/**
 * Super Admin Portal Layout
 * ISOLATED - No shared components with hospital portals
 * Only accessible to global super administrators
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { verifySuperAdminSession } from '@/lib/auth';
import SuperAdminSidebar from './components/SuperAdminSidebar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero Pulse — %s',
    default: 'AfyaHero Pulse — Superadmin Portal',
  },
  description: 'Platform-level administration for managing facilities, monitoring system health, and reviewing audit activity.',
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySuperAdminSession();

  if (!session) {
    redirect('/auth/login?redirect=/portal/superadmin');
  }

  // SUPER ADMIN MUST NOT HAVE A HOSPITAL ID
  if (session.hospitalId) {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-content-surface dark:bg-gray-950">
      <SuperAdminSidebar />
      <main className="md:ml-64 p-4 md:p-6">{children}</main>
    </div>
  );
}