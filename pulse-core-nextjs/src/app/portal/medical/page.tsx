import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { parseSignedSession } from '@/lib/session';
import DoctorDashboard from './DoctorDashboard';
import NurseDashboard from './NurseDashboard';

export const metadata: Metadata = {
  title: 'AfyaHero Pulse — Medical Dashboard',
  description: 'Clinical workspace for patient review, orders, results, and handover workflows.',
};

export default async function MedicalDashboardPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('afya_session')?.value;
  const session = raw ? parseSignedSession(raw) : null;
  const isNurse = session?.subrole === 'nurse';

  return isNurse ? <NurseDashboard /> : <DoctorDashboard />;
}
