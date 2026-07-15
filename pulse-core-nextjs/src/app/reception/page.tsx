'use client';

import { useState } from 'react';
import PatientCheckInForm from '@/components/reception/PatientCheckInForm';
import QueueDashboard from '@/components/reception/QueueDashboard';
import { UserPlus, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReceptionPage() {
  const [activeTab, setActiveTab] = useState('queue');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reception Desk</h1>
              <p className="text-sm text-gray-600">Patient registration and queue management</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Custom Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('queue')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 font-medium transition-colors',
                activeTab === 'queue'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Queue Dashboard
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 font-medium transition-colors',
                activeTab === 'checkin'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <UserPlus className="w-4 h-4" />
              Patient Check-in
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <QueueDashboard />
          </div>
        )}

        {activeTab === 'checkin' && (
          <div className="space-y-6">
            <PatientCheckInForm />
          </div>
        )}
      </div>
    </div>
  );
}
