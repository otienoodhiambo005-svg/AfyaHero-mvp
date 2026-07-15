import { cookies } from 'next/headers';
import { parseSignedSession } from '@/lib/session';
import WardConsumablesClient from './WardConsumablesClient';

export default async function MedicalInventoryPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('afya_session')?.value;
  const session = raw ? parseSignedSession(raw) : null;
  const isNurse = session?.subrole === 'nurse';

  return <WardConsumablesClient isNurse={isNurse} />;
}
