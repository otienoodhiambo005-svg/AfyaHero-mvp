/**
 * Network Status Banner — Shows connectivity state to users
 *
 * Green (online) → Reassures that patient data is syncing
 * Yellow (slow) → Warns about slow network; queues writes locally
 * Red (offline) → Shows cached data available; warns about stale info
 *
 * Features:
 * - Inline styles for color fallbacks when CSS fails to load
 * - Works in low bandwidth scenarios
 * - Accessible color contrast ratios
 */

'use client';

import { useEffect, useState } from 'react';
import {
  flushQueue,
  getNetworkStatus,
  getQueueSize,
  subscribeToNetworkChanges,
  type ConnectivityStatus,
  type QueuedRequest,
} from '@/lib/network-utils';

// Animation keyframes for banner entrance/exit
const bannerAnimationStyles = `
@keyframes slide-down {
  from { transform: translate(-50%, -100%); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
@keyframes slide-up {
  from { transform: translate(-50%, 0); opacity: 1; }
  to { transform: translate(-50%, -100%); opacity: 0; }
}
@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}
.animate-slide-down {
  animation: slide-down 0.3s ease-out forwards;
}
.animate-slide-up {
  animation: slide-up 0.3s ease-in forwards;
}
.animate-pulse-border {
  animation: pulse-border 2s ease-in-out infinite;
}
`;

// Color configurations with inline style fallbacks for low connectivity
const BANNER_CONFIG = {
  online: {
    className: 'bg-green-50/95 border-green-200',
    textClass: 'text-green-900',
    // Inline style fallback - ensures color shows even if Tailwind CSS fails
    style: {
      backgroundColor: '#f0fdf4',    // green-50
      borderColor: '#bbf7d0',         // green-200
      color: '#166534',               // green-900
    },
    icon: '✓',
    message: 'Connected — All systems operational',
  },
  offline: {
    className: 'bg-red-50/95 border-red-200',
    textClass: 'text-red-900',
    // Inline style fallback - critical for offline scenarios
    style: {
      backgroundColor: '#fef2f2',    // red-50
      borderColor: '#fecaca',         // red-200
      color: '#7f1d1d',               // red-900
    },
    icon: '⚠️',
    message: 'Offline — Using cached data. Changes will sync when reconnected.',
  },
  slow: {
    className: 'bg-yellow-50/95 border-yellow-200',
    textClass: 'text-yellow-900',
    // Inline style fallback for slow network warnings
    style: {
      backgroundColor: '#fefce8',    // yellow-50
      borderColor: '#fde047',         // yellow-200
      color: '#713f12',               // yellow-900
    },
    icon: '📶',
    message: 'Slow Network — Some features may be slow. Data is queued locally.',
  },
  unknown: {
    className: 'bg-gray-50/95 border-gray-200',
    textClass: 'text-gray-900',
    // Inline style fallback for unknown status
    style: {
      backgroundColor: '#f9fafb',    // gray-50
      borderColor: '#e5e7eb',         // gray-200
      color: '#111827',               // gray-900
    },
    icon: '❓',
    message: 'Network status unknown',
  },
};

export function NetworkStatusBanner() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<ConnectivityStatus>('online');
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
    const currentStatus = getNetworkStatus();
    setTimeout(() => setStatus(currentStatus), 0);
    setTimeout(() => setVisible(currentStatus !== 'online'), 0);
    setTimeout(() => setQueueSize(getQueueSize()), 0);

    const unsubscribe = subscribeToNetworkChanges((newStatus) => {
      setStatus(newStatus);
      
      if (newStatus === 'online') {
        flushQueue().finally(() => setQueueSize(getQueueSize()));
        // Animate out before hiding
        if (visible) {
          setIsExiting(true);
          setShowOnlineToast(true);
          setTimeout(() => {
            setVisible(false);
            setIsExiting(false);
          }, 300);
          // Hide online toast after 3 seconds
          setTimeout(() => setShowOnlineToast(false), 3000);
        }
      } else {
        setIsExiting(false);
        setVisible(true);
      }
    });

    const handleQueueUpdated = (event: Event) => {
      const detail = (event as CustomEvent<QueuedRequest[]>).detail;
      setQueueSize(Array.isArray(detail) ? detail.length : getQueueSize());
    };

    const handleFlushRequest = () => {
      flushQueue().finally(() => setQueueSize(getQueueSize()));
    };

    window.addEventListener('afyahero:offline-queue-updated', handleQueueUpdated);
    window.addEventListener('afyahero:flush-offline-queue', handleFlushRequest);

    return () => {
      unsubscribe();
      window.removeEventListener('afyahero:offline-queue-updated', handleQueueUpdated);
      window.removeEventListener('afyahero:flush-offline-queue', handleFlushRequest);
    };
  }, [visible]);

  // Online reconnection toast
  if (showOnlineToast && !visible) {
    return (
      <>
        <style>{bannerAnimationStyles}</style>
        <div
          className="fixed left-1/2 top-4 z-[9999] w-[90vw] -translate-x-1/2 rounded-2xl border border-green-200 bg-green-50/95 p-3 shadow-2xl backdrop-blur-xl animate-slide-down md:w-[450px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-green-900 text-sm">
            <span aria-hidden="true">✓</span>
            <span className="font-semibold">
              Back online — {queueSize > 0 ? `Syncing ${queueSize} queued item${queueSize === 1 ? '' : 's'}...` : 'All data is synced'}
            </span>
          </div>
        </div>
      </>
    );
  }

  if (!mounted || !visible) {
    return null;
  }

  const config = BANNER_CONFIG[status];
  const isCritical = status === 'offline' || status === 'slow';

  // Combine Tailwind classes with inline styles for maximum compatibility
  // Inline styles act as fallback when CSS fails to load in low connectivity
  return (
    <>
      <style>{bannerAnimationStyles}</style>
      <div 
        className={`fixed left-1/2 top-4 z-[9999] w-[90vw] -translate-x-1/2 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl md:w-[450px] ${isCritical ? 'animate-pulse-border' : ''} ${isExiting ? 'animate-slide-up' : 'animate-slide-down'} ${config.className}`}
        style={config.style}
        role="alert"
        aria-live="assertive"
        aria-label={`Network status: ${status}`}
      >
        <div className={`flex items-start gap-3 ${config.textClass} text-sm`} style={{ color: config.style.color }}>
          <span className="text-lg flex-shrink-0" aria-hidden="true">{config.icon}</span>
          <div className="flex-grow">
            <p className="font-semibold">{config.message}</p>
            {status === 'offline' && (
              <p className="text-xs mt-1 opacity-80">
                Patient data is protected. {queueSize > 0 ? `${queueSize} item${queueSize === 1 ? '' : 's'} waiting to sync.` : 'No pending changes.'}
              </p>
            )}
            {status === 'slow' && (
              <p className="text-xs mt-1 opacity-80">
                Try enabling WiFi or moving closer to the router. {queueSize > 0 ? `${queueSize} queued item${queueSize === 1 ? '' : 's'} will retry automatically.` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
