import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { parseSignedSession } from '@/lib/session';
import { LayoutDashboard, Package, BookOpen, BarChart3, Users, ClipboardList, FlaskConical, ShieldCheck } from 'lucide-react';

const SESSION_COOKIE = 'afya_session';
const ACCENT = '#059669';
const LOGIN_PATH = '/auth/pharmacy/login';
const PORTAL_ROLE = 'pharmacy';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero Pulse — %s',
    default: 'AfyaHero Pulse — Pharmacy Portal',
  },
  description: 'Pharmacy dispensing, inventory, and medication safety workflows in AfyaHero Pulse.',
};

export default async function PharmacyLayout({ children }: { children: React.ReactNode }) {
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
      name: 'Dispensing Queue',
      href: '/portal/pharmacy',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: 7,
      group: '',
    },
    {
      name: 'Inventory',
      href: '/portal/pharmacy/inventory',
      icon: <Package className="w-4 h-4" />,
      group: 'INVENTORY',
    },
    {
      name: 'Patients',
      href: '/portal/pharmacy/patients',
      icon: <Users className="w-4 h-4" />,
      group: 'INVENTORY',
    },
    {
      name: 'Orders',
      href: '/portal/pharmacy/orders',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'INVENTORY',
    },
    {
      name: 'Queue',
      href: '/portal/pharmacy/queue',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'INVENTORY',
    },
    {
      name: 'Formulary',
      href: '/portal/pharmacy/formulary',
      icon: <BookOpen className="w-4 h-4" />,
      group: 'INVENTORY',
    },
    {
      name: 'Results',
      href: '/portal/pharmacy/results',
      icon: <FlaskConical className="w-4 h-4" />,
      group: 'ANALYTICS',
    },
    {
      name: 'Quality',
      href: '/portal/pharmacy/quality',
      icon: <ShieldCheck className="w-4 h-4" />,
      group: 'ANALYTICS',
    },
    {
      name: 'Reports',
      href: '/portal/pharmacy/reports',
      icon: <BarChart3 className="w-4 h-4" />,
      group: 'ANALYTICS',
    },
  ];

  return (
    <PortalShell
      session={session}
      accentColor={ACCENT}
      portalLabel="Pharmacy"
      portalRole={PORTAL_ROLE}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
