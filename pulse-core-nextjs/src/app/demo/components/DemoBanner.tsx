'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Sparkles } from 'lucide-react';
import type { UserSession } from '@/types';

interface DemoBannerProps {
  session: UserSession;
}

export default function DemoBanner({ session }: DemoBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const issuedAt = session.issuedAt;
      const fourHoursMs = 4 * 60 * 60 * 1000;
      const expiresAt = issuedAt + fourHoursMs;
      const remaining = expiresAt - Date.now();

      if (remaining <= 0) {
        setExpired(true);
        setTimeRemaining('00:00:00');
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [session.issuedAt]);

  if (expired) {
    return (
      <div className="bg-red-600 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Demo session expired. Please request a new demo from AfyaHero.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5" />
          <div>
            <span className="font-semibold">AfyaHero Demo Mode</span>
            <span className="mx-2 text-white/60">|</span>
            <span className="text-sm text-white/90">
              {session.hospitalName} • {session.name} ({session.title})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4" />
          <span>Time remaining: {timeRemaining}</span>
        </div>
      </div>
    </div>
  );
}
