import PortalLogin from '@/components/auth/PortalLogin';
import { PORTALS } from '@/types';

export default function ReceptionLoginPage() {
  return <PortalLogin config={PORTALS.reception} />;
}
