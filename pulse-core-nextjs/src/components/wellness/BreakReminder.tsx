'use client';

import { useEffect, useState } from 'react';
import { Coffee, Clock, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BreakReminder() {
  const [showReminder, setShowReminder] = useState(false);
  const [breakDuration, setBreakDuration] = useState(15); // minutes
  const [dismissed, setDismissed] = useState(false);
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    // Check if user has been working for 2 hours without a break
    const checkBreakReminder = () => {
      const lastBreak = localStorage.getItem('lastBreakTime');
      if (lastBreak) {
        const lastBreakTime = parseInt(lastBreak);
        const hoursSinceBreak = (Date.now() - lastBreakTime) / (1000 * 60 * 60);
        
        if (hoursSinceBreak >= 2 && !dismissed) {
          setShowReminder(true);
        }
      } else {
        // First time or no break recorded, check if session started 2 hours ago
        const sessionStart = localStorage.getItem('sessionStartTime');
        if (sessionStart) {
          const sessionStartTime = parseInt(sessionStart);
          const hoursSinceStart = (Date.now() - sessionStartTime) / (1000 * 60 * 60);
          
          if (hoursSinceStart >= 2 && !dismissed) {
            setShowReminder(true);
          }
        } else {
          // Set session start time
          localStorage.setItem('sessionStartTime', Date.now().toString());
        }
      }
    };

    // Set session start time if not set
    if (!localStorage.getItem('sessionStartTime')) {
      localStorage.setItem('sessionStartTime', Date.now().toString());
    }

    // Check every 5 minutes
    checkBreakReminder();
    const interval = setInterval(checkBreakReminder, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [dismissed]);

  const handleTakeBreak = () => {
    setTaken(true);
    localStorage.setItem('lastBreakTime', Date.now().toString());
    
    // Schedule return reminder
    setTimeout(() => {
      setShowReminder(true);
      setTaken(false);
      setDismissed(false);
    }, breakDuration * 60 * 1000);

    // Hide the current reminder
    setTimeout(() => {
      setShowReminder(false);
    }, 3000);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowReminder(false);
    
    // Check again in 30 minutes
    setTimeout(() => {
      setDismissed(false);
    }, 30 * 60 * 1000);
  };

  if (!showReminder) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl bg-white border border-amber-200 shadow-2xl p-4">
      {taken ? (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-100">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-emerald-900">Break recorded!</p>
            <p className="text-xs text-emerald-600">
              Return in {breakDuration} minutes
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-100">
                <Coffee className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">Break Time!</h3>
                <p className="text-xs text-slate">You&apos;ve been working for 2+ hours</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-amber-900">
              A 15-minute break can improve focus and reduce stress
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleTakeBreak}
              className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <Coffee className="w-4 h-4" />
              Take Break
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Later
            </button>
          </div>
        </>
      )}
    </div>
  );
}
