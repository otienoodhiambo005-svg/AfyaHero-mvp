import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { parseSignedSession } from '@/lib/session';
import { LayoutDashboard, BedDouble, Users, TrendingUp, ShieldCheck, BarChart3, ClipboardList, CreditCard, Settings, Briefcase, AlertTriangle } from 'lucide-react';

const SESSION_COOKIE = 'afya_session';
const ACCENT = '#DC2626';
const LOGIN_PATH = '/auth/admin/login';
const PORTAL_ROLE = 'admin';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero Pulse — %s',
    default: 'AfyaHero Pulse — Admin Portal',
  },
  description: 'Administrative oversight for facility operations, staffing, finance, quality, and reporting in AfyaHero Pulse.',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
      name: 'Executive Dashboard',
      href: '/portal/admin',
      icon: <LayoutDashboard className="w-4 h-4" />,
      group: '',
    },
    {
      name: 'Beds',
      href: '/portal/admin/beds',
      icon: <BedDouble className="w-4 h-4" />,
      group: 'HOSPITAL OPS',
    },
    {
      name: 'Patients',
      href: '/portal/admin/patients',
      icon: <Users className="w-4 h-4" />,
      group: 'HOSPITAL OPS',
    },
    {
      name: 'Queue',
      href: '/portal/admin/queue',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'HOSPITAL OPS',
    },
    {
      name: 'Escalations',
      href: '/portal/admin/escalations',
      icon: <AlertTriangle className="w-4 h-4" />,
      group: 'HOSPITAL OPS',
    },
    {
      name: 'Staff',
      href: '/portal/admin/staff',
      icon: <Briefcase className="w-4 h-4" />,
      group: 'HOSPITAL OPS',
    },
    {
      name: 'Orders',
      href: '/portal/admin/orders',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'HOSPITAL OPS',
    },
    {
      name: 'Finance',
      href: '/portal/admin/finance',
      icon: <TrendingUp className="w-4 h-4" />,
      group: 'FINANCE & BILLING',
    },
    {
      name: 'Billing',
      href: '/portal/admin/billing',
      icon: <CreditCard className="w-4 h-4" />,
      group: 'FINANCE & BILLING',
    },
    {
      name: 'Quality',
      href: '/portal/admin/quality',
      icon: <ShieldCheck className="w-4 h-4" />,
      group: 'QUALITY & COMPLIANCE',
    },
    {
      name: 'Reports',
      href: '/portal/admin/reports',
      icon: <BarChart3 className="w-4 h-4" />,
      group: 'QUALITY & COMPLIANCE',
    },
    {
      name: 'Settings',
      href: '/portal/admin/settings',
      icon: <Settings className="w-4 h-4" />,
      group: '',
    },
  ];

  return (
    <PortalShell
      session={session}
      accentColor={ACCENT}
      portalLabel="Admin"
      portalRole={PORTAL_ROLE}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
