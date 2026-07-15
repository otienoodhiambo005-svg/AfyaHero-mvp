import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { parseSignedSession } from '@/lib/session';
import { LayoutDashboard, FlaskConical, Package, BarChart3, ShieldCheck, Users, ClipboardList, Settings } from 'lucide-react';

const SESSION_COOKIE = 'afya_session';
const ACCENT = '#7C3AED';
const LOGIN_PATH = '/auth/lab/login';
const PORTAL_ROLE = 'lab';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero Pulse — %s',
    default: 'AfyaHero Pulse — Laboratory Portal',
  },
  description: 'Laboratory work queue for orders, specimen processing, results entry, and quality workflows.',
};

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) redirect(LOGIN_PATH);

  const session = parseSignedSession(raw);
  if (!session) {
    redirect(LOGIN_PATH);
  }

  if (session.role !== PORTAL_ROLE) {
    redirect(`/portal/${session.role}`);
  }

  const navItems = [
    {
      name: 'Work Queue',
      href: '/portal/lab',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: 8,
      group: '',
    },
    {
      name: 'Results Entry',
      href: '/portal/lab/results',
      icon: <FlaskConical className="w-4 h-4" />,
      group: 'PROCESSING',
    },
    {
      name: 'Orders',
      href: '/portal/lab/orders',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'PROCESSING',
    },
    {
      name: 'Queue',
      href: '/portal/lab/queue',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'PROCESSING',
    },
    {
      name: 'Patients',
      href: '/portal/lab/patients',
      icon: <Users className="w-4 h-4" />,
      group: 'PROCESSING',
    },
    {
      name: 'Inventory',
      href: '/portal/lab/inventory',
      icon: <Package className="w-4 h-4" />,
      group: 'PROCESSING',
    },
    {
      name: 'Reports',
      href: '/portal/lab/reports',
      icon: <BarChart3 className="w-4 h-4" />,
      group: 'ANALYTICS',
    },
    {
      name: 'Quality',
      href: '/portal/lab/quality',
      icon: <ShieldCheck className="w-4 h-4" />,
      group: 'ANALYTICS',
    },
    {
      name: 'Settings',
      href: '/portal/lab/settings',
      icon: <Settings className="w-4 h-4" />,
      group: '',
    },
  ];

  return (
    <PortalShell
      session={session}
      accentColor={ACCENT}
      portalLabel="Laboratory"
      portalRole={PORTAL_ROLE}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
