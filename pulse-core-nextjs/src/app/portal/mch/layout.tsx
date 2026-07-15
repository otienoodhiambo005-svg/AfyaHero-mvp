import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { parseSignedSession } from '@/lib/session';
import {
  LayoutDashboard, Users, Heart, Baby, Calendar, ShieldCheck, Activity
} from 'lucide-react';

const SESSION_COOKIE = 'afya_session';
const ACCENT = '#2563EB'; // Royal Blue portal nav active state accent
const LOGIN_PATH = '/auth/medical/login';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero — %s',
    default: 'AfyaHero — Maternal & Child Health Portal',
  },
  description: 'Maternal and Child Health (MCH) portal for ANC tracking, immunization registries, and pediatric growth monitoring.',
};

const MCH_NAV = [
  { name: 'MCH Dashboard', href: '/portal/mch', icon: <LayoutDashboard className="w-4 h-4" />, group: '' },
  { name: 'Antenatal Care (ANC)', href: '/portal/mch/anc', icon: <Heart className="w-4 h-4" />, group: 'REGISTRIES' },
  { name: 'Immunization Registry', href: '/portal/mch/immunization', icon: <Baby className="w-4 h-4" />, group: 'REGISTRIES' },
  { name: 'Growth Monitoring', href: '/portal/mch/growth', icon: <Activity className="w-4 h-4" />, group: 'REGISTRIES' },
  { name: 'Appointments', href: '/portal/mch/appointments', icon: <Calendar className="w-4 h-4" />, group: 'SCHEDULING' },
  { name: 'Compliance & Audit', href: '/portal/mch/compliance', icon: <ShieldCheck className="w-4 h-4" />, group: 'QUALITY' },
];

export default async function MchLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) redirect(LOGIN_PATH);

  const session = parseSignedSession(raw);
  if (!session) {
    redirect(LOGIN_PATH);
  }

  // Allow both medical staff and admins to access the MCH portal
  if (session.role !== 'medical' && session.role !== 'admin') {
    redirect(`/portal/${session.role}`);
  }

  return (
    <PortalShell
      session={session}
      accentColor={ACCENT}
      portalLabel="Maternal & Child Health"
      portalRole={session.role}
      navItems={MCH_NAV}
    >
      {children}
    </PortalShell>
  );
}
