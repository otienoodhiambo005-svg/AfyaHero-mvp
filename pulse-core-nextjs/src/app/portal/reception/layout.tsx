import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { parseSignedSession } from '@/lib/session';
import { 
  LayoutDashboard, UserPlus, ClipboardList, CreditCard, Users, 
  CalendarClock, BarChart3, Settings, Fingerprint, Bed, FileText, DollarSign 
} from 'lucide-react';

const SESSION_COOKIE = 'afya_session';
const ACCENT = '#2E86AB'; // Operations theme color matches config
const LOGIN_PATH = '/auth/reception/login';
const PORTAL_ROLE = 'reception';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero — %s',
    default: 'AfyaHero — Operations Portal',
  },
  description: 'Operations workspace for patient reception, queue management, biometric ID-check, bed assignment, billing collection, and financial ledger auditing.',
};

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
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
      name: 'Overview',
      href: '/portal/reception',
      icon: <LayoutDashboard className="w-4 h-4" />,
      group: '',
    },
    // RECEPTION SUBPORTAL
    {
      name: 'Check-In',
      href: '/portal/reception/checkin',
      icon: <UserPlus className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    {
      name: 'Patient Queue',
      href: '/portal/reception/queue',
      icon: <ClipboardList className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    {
      name: 'Patients Directory',
      href: '/portal/reception/patients',
      icon: <Users className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    {
      name: 'Appointments',
      href: '/portal/reception/appointments',
      icon: <CalendarClock className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    {
      name: 'Biometric ID Check',
      href: '/portal/reception/id-check',
      icon: <Fingerprint className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    {
      name: 'Ward Beds',
      href: '/portal/reception/beds',
      icon: <Bed className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    {
      name: 'Service Orders',
      href: '/portal/reception/orders',
      icon: <FileText className="w-4 h-4" />,
      group: 'Reception Subportal',
    },
    // BILLING SUBPORTAL
    {
      name: 'Billing & Invoices',
      href: '/portal/reception/billing',
      icon: <CreditCard className="w-4 h-4" />,
      group: 'Billing Subportal',
    },
    {
      name: 'Finance Operations',
      href: '/portal/reception/finance',
      icon: <DollarSign className="w-4 h-4" />,
      group: 'Billing Subportal',
    },
    {
      name: 'Revenue Reports',
      href: '/portal/reception/reports',
      icon: <BarChart3 className="w-4 h-4" />,
      group: 'Billing Subportal',
    },
    // SYSTEM / GENERAL
    {
      name: 'Settings',
      href: '/portal/reception/settings',
      icon: <Settings className="w-4 h-4" />,
      group: '',
    },
  ];

  return (
    <PortalShell
      session={session}
      accentColor={ACCENT}
      portalLabel="Operations"
      portalRole={PORTAL_ROLE}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
