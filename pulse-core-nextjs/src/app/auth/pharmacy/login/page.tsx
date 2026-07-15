import PortalLogin from '@/components/auth/PortalLogin';
import { PORTALS } from '@/types';

export default function PharmacyLoginPage() {
  return <PortalLogin config={PORTALS.pharmacy} />;
}
