import PortalLogin from '@/components/auth/PortalLogin';
import { PORTALS } from '@/types';

export default function SuperAdminLoginPage() {
  return <PortalLogin config={PORTALS.super_admin} />;
}
