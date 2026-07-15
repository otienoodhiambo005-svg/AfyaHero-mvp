'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Staff management page disabled for medical portal users - use admin portal instead
export default function MedicalStaffRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to dashboard since staff management is not accessible for doctors
    router.replace('/portal/medical');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Access restricted. Redirecting to dashboard...</p>
      </div>
    </div>
  );
}