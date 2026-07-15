'use client';

import { WardDashboard } from '@/components/portal/medical/nurse/wards/WardDashboard';

export default function NurseWardsDashboardPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans transition-colors duration-500">
      <WardDashboard />
    </div>
  );
}
