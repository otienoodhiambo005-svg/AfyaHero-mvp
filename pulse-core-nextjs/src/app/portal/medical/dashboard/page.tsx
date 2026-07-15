'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Users, Clock, Activity, Stethoscope, Plus, Loader2 } from 'lucide-react';
import logger from '@/lib/logger';

interface AlertItem {
  id: string;
  patient: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
}

interface RecentNote {
  date: string;
  patient: string;
  author: string;
  assessment: string;
  status: 'In Consult' | 'Admitted' | 'Done';
}


function KPICard({
  icon: Icon,
  label,
  value,
  change,
  color,
}: {
   
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  change: string;
  color: 'success' | 'info' | 'warning' | 'danger';
}) {
  const colorMap = {
    success: { bg: 'bg-success/5', border: 'border-success/20', text: 'text-success', icon: 'text-success' },
    info: { bg: 'bg-info/5', border: 'border-info/20', text: 'text-info', icon: 'text-info' },
    warning: { bg: 'bg-warning/5', border: 'border-warning/20', text: 'text-warning', icon: 'text-warning' },
    danger: { bg: 'bg-danger/5', border: 'border-danger/20', text: 'text-danger', icon: 'text-danger' },
  };

  const { bg, border, text, icon } = colorMap[color];

  return (
    <div className={`rounded-card border ${border} ${bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-ink">{value}</p>
          <p className={`text-xs mt-2 ${text} font-medium`}>{change}</p>
        </div>
        <Icon className={`w-8 h-8 ${icon}`} />
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  switch (severity) {
    case 'critical':
      return <span className="inline-block w-2 h-2 rounded-full bg-danger mr-2"></span>;
    case 'warning':
      return <span className="inline-block w-2 h-2 rounded-full bg-warning mr-2"></span>;
    case 'info':
      return <span className="inline-block w-2 h-2 rounded-full bg-info mr-2"></span>;
  }
}

export default function MedicalDashboardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/medical/dashboard', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`);
      const data = await res.json();
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setRecentNotes(Array.isArray(data.recentNotes) ? data.recentNotes : []);
    } catch (err) {
      logger.error('Failed to load medical dashboard', { error: err });
      setAlerts([]);
      setRecentNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
          <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
          <p className="text-sm">Loading dashboard…</p>
        </div>
      )}

      {!loading && (
      <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Medical Dashboard</h1>
          <p className="text-sm text-slate-600">Real-time clinical workflow overview</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-portal-primary hover:bg-portal-primary-hover text-white text-sm font-medium transition-colors w-fit">
          <Plus className="w-4 h-4" /> New Consultation
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Active Patients" value="6" change="↑ 2 since yesterday" color="success" />
        <KPICard icon={Clock} label="Waiting" value="3" change="Avg wait: 18 min" color="warning" />
        <KPICard icon={Activity} label="In Consult" value="2" change="Est. 15 min each" color="info" />
        <KPICard icon={AlertTriangle} label="Critical Alerts" value="2" change="⚠ Require immediate action" color="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinical Alerts */}
        <div className="lg:col-span-2 rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-content-border flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <h2 className="font-semibold text-ink">Clinical Alerts</h2>
            <span className="ml-auto text-xs font-medium text-danger bg-danger/5 px-2 py-1 rounded">{alerts.length}</span>
          </div>
          <div className="divide-y divide-slate-200">
            {alerts.map((alert) => (
              <div key={alert.id} className="px-5 py-3 hover:bg-content-surface transition-colors cursor-pointer">
                <div className="flex gap-3">
                  <SeverityBadge severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{alert.patient}</p>
                    <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{alert.message}</p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="rounded-card bg-content-bg border border-content-border p-4 shadow-card">
            <h3 className="font-semibold text-ink text-sm mb-3">Patient Status Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">In Consult:</span>
                <span className="font-semibold text-success">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Admitted:</span>
                <span className="font-semibold text-info">1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Waiting:</span>
                <span className="font-semibold text-warning">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discharged Today:</span>
                <span className="font-semibold text-slate-700">1</span>
              </div>
            </div>
          </div>

          <div className="rounded-card bg-content-bg border border-content-border p-4 shadow-card">
            <h3 className="font-semibold text-ink text-sm mb-3">Orders Due</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Lab Results:</span>
                <span className="font-semibold text-success">4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Imaging:</span>
                <span className="font-semibold text-success">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Prescriptions:</span>
                <span className="font-semibold text-warning">3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notes */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-content-border flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-success" />
          <h2 className="font-semibold text-ink">Recent Clinical Notes</h2>
        </div>
        <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
          {recentNotes.map((note, idx) => (
            <div key={idx} className="px-5 py-3 hover:bg-content-surface transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-ink text-sm">{note.patient}</p>
                    <span className="text-xs text-slate-500">by {note.author}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{note.assessment}</p>
                  <p className="text-xs text-slate-500 mt-1">{note.date}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap font-medium ${
                  note.status === 'In Consult' ? 'bg-success/5 text-success' :
                  note.status === 'Admitted' ? 'bg-info/5 text-info' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {note.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
