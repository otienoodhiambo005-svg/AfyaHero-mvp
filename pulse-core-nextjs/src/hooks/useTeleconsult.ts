import { useState, useEffect, useCallback } from 'react';
import logger from '@/lib/logger';

export type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed';

export interface TeleconsultAppointment {
  id: string;
  patient: string;
  time: string;
  mode: 'Video' | 'Call' | 'Text';
  clinician: string;
  status: AppointmentStatus;
}

export interface WaitroomPatient {
  id: string;
  patient: string;
  waitingFor: string;
  waitMinutes: number;
  mode: 'Video' | 'Call' | 'Text';
  priority: 'Normal' | 'Urgent';
}

export function useTeleconsult() {
  const [appointments, setAppointments] = useState<TeleconsultAppointment[]>([]);
  const [waitroom, setWaitroom] = useState<WaitroomPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch('/api/medical/teleconsultation/appointments');
      const data = await res.json();
      if (data.items) setAppointments(data.items);
    } catch (err) {
      logger.error('Failed to fetch appointments', { error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const fetchWaitroom = useCallback(async () => {
    try {
      const res = await fetch('/api/medical/teleconsultation/waitroom');
      const data = await res.json();
      if (data.items) setWaitroom(data.items);
    } catch (err) {
      logger.error('Failed to fetch waitroom', { error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchAppointments(), fetchWaitroom()]);
    setLoading(false);
  }, [fetchAppointments, fetchWaitroom]);

  useEffect(() => {
    // Defer refresh to avoid synchronous setState in effect
    setTimeout(() => refresh(), 0);
  }, [refresh]);

  const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
    try {
      const res = await fetch('/api/medical/teleconsultation/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      }
    } catch (err) {
      logger.error('Failed to update appointment', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const removeFromWaitroom = async (id: string) => {
    try {
      const res = await fetch(`/api/medical/teleconsultation/waitroom?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWaitroom(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      logger.error('Failed to remove from waitroom', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const createAppointment = async (payload: Omit<TeleconsultAppointment, 'id'>) => {
    try {
      const res = await fetch('/api/medical/teleconsultation/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.item) {
        setAppointments(prev => [...prev, data.item]);
      }
    } catch (err) {
      logger.error('Failed to create appointment', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const addToWaitroom = async (payload: Omit<WaitroomPatient, 'id'>) => {
    try {
      const res = await fetch('/api/medical/teleconsultation/waitroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.item) {
        setWaitroom(prev => [...prev, data.item]);
      }
    } catch (err) {
      logger.error('Failed to add to waitroom', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  return {
    appointments,
    waitroom,
    loading,
    error,
    refresh,
    updateAppointmentStatus,
    removeFromWaitroom,
    createAppointment,
    addToWaitroom,
  };
}
