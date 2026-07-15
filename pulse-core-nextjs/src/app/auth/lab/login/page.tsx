import PortalLogin from '@/components/auth/PortalLogin';
import { PORTALS } from '@/types';

export default function LabLoginPage() {
  return <PortalLogin config={PORTALS.lab} />;
}
