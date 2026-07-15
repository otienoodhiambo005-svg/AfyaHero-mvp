import PortalLogin from '@/components/auth/PortalLogin';
import { PORTALS } from '@/types';

export default function AdminLoginPage() {
  return <PortalLogin config={PORTALS.admin} />;
}
