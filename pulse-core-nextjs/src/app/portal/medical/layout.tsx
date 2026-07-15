import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { parseSignedSession } from '@/lib/session';
import {
  LayoutDashboard, Users, FlaskConical, Pill, ArrowLeftRight, Video, BrainCircuit,
  BedDouble, ShieldCheck, ClipboardList, BarChart3, Activity, HeartPulse, Syringe, NotebookPen,
  Package, BookOpen, UserPlus, FileText, Stethoscope,
} from 'lucide-react';

const SESSION_COOKIE = 'afya_session';
const ACCENT = '#2563EB';
const NURSE_ACCENT = '#D97706';
const LOGIN_PATH = '/auth/medical/login';
const PORTAL_ROLE = 'medical';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero — %s',
    default: 'AfyaHero — Medical Portal',
  },
  description: 'Clinical workspace for care teams, including patient review, orders, results, and handover workflows.',
};

const DOCTOR_NAV = [
  { name: 'Dashboard', href: '/portal/medical', icon: <LayoutDashboard className="w-4 h-4" />, group: '' },
  { name: 'Patients', href: '/portal/medical/patients', icon: <Users className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Check-In', href: '/portal/medical/checkin', icon: <UserPlus className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Queue', href: '/portal/medical/queue', icon: <ClipboardList className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Consultation', href: '/portal/medical/consultation', icon: <Stethoscope className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Orders', href: '/portal/medical/orders', icon: <ClipboardList className="w-4 h-4" />, badge: 5, group: 'CLINICAL' },
  { name: 'Results', href: '/portal/medical/results', icon: <FlaskConical className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Prescriptions', href: '/portal/medical/prescriptions', icon: <Pill className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Inventory', href: '/portal/medical/inventory', icon: <Package className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Formulary', href: '/portal/medical/formulary', icon: <BookOpen className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Beds', href: '/portal/medical/beds', icon: <BedDouble className="w-4 h-4" />, group: 'CLINICAL' },
  // { name: 'Teleconsultation', href: '/portal/medical/teleconsultation', icon: <Video className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Clinical Diagnosis', href: '/portal/medical/diagnosis', icon: <BrainCircuit className="w-4 h-4" />, group: 'CLINICAL' },
  { name: 'Handover', href: '/portal/medical/handover', icon: <ArrowLeftRight className="w-4 h-4" />, group: 'HANDOVER' },
  { name: 'Quality', href: '/portal/medical/quality', icon: <ShieldCheck className="w-4 h-4" />, group: 'HANDOVER' },
  { name: 'Reports', href: '/portal/medical/reports', icon: <BarChart3 className="w-4 h-4" />, group: 'HANDOVER' },
];

const NURSE_NAV = [
  { name: 'Dashboard', href: '/portal/medical', icon: <LayoutDashboard className="w-4 h-4" />, group: '' },
  { name: 'My Patients', href: '/portal/medical/patients', icon: <Users className="w-4 h-4" />, group: 'CARE' },
  { name: 'Vitals', href: '/portal/medical/nurse/vitals', icon: <HeartPulse className="w-4 h-4" />, group: 'CARE' },
  { name: 'Medications', href: '/portal/medical/medications', icon: <Syringe className="w-4 h-4" />, group: 'CARE' },
  { name: 'Observations', href: '/portal/medical/observations', icon: <Activity className="w-4 h-4" />, group: 'CARE' },
  { name: 'Check-In', href: '/portal/medical/checkin', icon: <UserPlus className="w-4 h-4" />, group: 'CARE' },
  { name: 'Beds', href: '/portal/medical/beds', icon: <BedDouble className="w-4 h-4" />, group: 'WARD' },
  { name: 'Inventory', href: '/portal/medical/inventory', icon: <Package className="w-4 h-4" />, group: 'WARD' },
  { name: 'Orders', href: '/portal/medical/orders', icon: <ClipboardList className="w-4 h-4" />, group: 'WARD' },
  { name: 'Handover', href: '/portal/medical/handover', icon: <ArrowLeftRight className="w-4 h-4" />, group: 'SHIFT' },
  { name: 'Shift Notes', href: '/portal/medical/shiftnotes', icon: <NotebookPen className="w-4 h-4" />, group: 'SHIFT' },
];

export default async function MedicalLayout({ children }: { children: React.ReactNode }) {
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

  const isNurse = session.subrole === 'nurse';
  const navItems = isNurse ? NURSE_NAV : DOCTOR_NAV;
  const accent = isNurse ? NURSE_ACCENT : ACCENT;
  const portalLabel = isNurse ? 'Nursing' : 'Medical';

  return (
    <PortalShell
      session={session}
      accentColor={accent}
      portalLabel={portalLabel}
      portalRole={PORTAL_ROLE}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}
