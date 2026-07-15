'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  UserPlus,
  Phone,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

const priorityColors = {
  critical: 'bg-red-100 border-red-500 text-red-900',
  urgent: 'bg-orange-100 border-orange-500 text-orange-900',
  normal: 'bg-green-100 border-green-500 text-green-900',
};

const priorityLabels = {
  critical: 'Critical',
  urgent: 'Urgent',
  normal: 'Normal',
};

const statusColors = {
  waiting: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  transferred: 'bg-purple-100 text-purple-800',
};

export default function QueueDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/hospital/queue');
      const data = await response.json();
      setQueue(data.queue || []);
      setStatistics(data.statistics || null);
    } catch (error) {
      logger.error('Failed to load queue', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateQueueStatus = async (queueId: string, status: string) => {
    setUpdatingId(queueId);
    try {
      const response = await fetch(`/api/hospital/queue/${queueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update queue status');
      }

      await loadQueue();
    } catch (error) {
      logger.error('Failed to update queue status', { error: error instanceof Error ? error.message : String(error) });
      alert('Failed to update queue status');
    } finally {
      setUpdatingId(null);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    return today.getFullYear() - birthDate.getFullYear();
  };

  const formatTimeInQueue = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading && queue.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Waiting</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.totalWaiting}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Wait Time</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.averageWaitTime}m</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical/Urgent</p>
                <p className="text-2xl font-bold text-red-600">
                  {(statistics.byPriority?.critical || 0) + (statistics.byPriority?.urgent || 0)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Normal Priority</p>
                <p className="text-2xl font-bold text-green-600">
                  {statistics.byPriority?.normal || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {/* Priority Breakdown */}
      {statistics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue by Priority</h3>
          <div className="grid grid-cols-3 gap-2">
            {['critical', 'urgent', 'normal'].map((priority) => (
              <div
                key={priority}
                className={cn(
                  'border-2 rounded-lg p-3 text-center',
                  priorityColors[priority as keyof typeof priorityColors],
                )}
              >
                <p className="text-2xl font-bold">{statistics.byPriority?.[priority] || 0}</p>
                <p className="text-xs font-medium">{priorityLabels[priority as keyof typeof priorityLabels]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Current Queue</h3>
          <button
            onClick={loadQueue}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {queue.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No patients in queue</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {queue.map((entry) => (
              <div
                key={entry.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-bold border',
                          priorityColors[entry.priority as keyof typeof priorityColors],
                        )}
                      >
                        {priorityLabels[entry.priority as keyof typeof priorityLabels] || entry.priority}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          statusColors[entry.status as keyof typeof statusColors],
                        )}
                      >
                        {entry.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-600">#{entry.position}</span>
                    </div>

                    <h4 className="font-semibold text-gray-900">
                      {entry.patient.firstName} {entry.patient.lastName}
                    </h4>

                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {entry.patient.phoneNumber}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {calculateAge(entry.patient.dateOfBirth)}y
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTimeInQueue(entry.timeInQueue)}
                      </div>
                    </div>
                  </div>

                  {entry.status === 'waiting' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateQueueStatus(entry.id, 'in_progress')}
                        disabled={updatingId === entry.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {updatingId === entry.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          'Call Patient'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
