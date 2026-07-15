'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Pill, Activity, Info, Bell } from 'lucide-react';

interface ClinicalAlertsDashboardProps {
  patientId?: string;
  vitals?: Record<string, number>;
  medications?: string[];
  labResults?: Record<string, unknown>;
  allergies?: string[];
  conditions?: string[];
}

export default function ClinicalAlertsDashboard({
  patientId,
  vitals,
  medications,
  labResults,
  allergies,
  conditions,
}: ClinicalAlertsDashboardProps) {
  const [alerts, setAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAlerts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clinical/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          context: {},
          vitals,
          medications,
          labResults,
          allergies,
          conditions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate clinical alerts');
      }

      const data = await response.json();
      setAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate clinical alerts');
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (category: string) => {
    switch (category) {
      case 'drug_interaction': return <Pill className="w-4 h-4" />;
      case 'allergy': return <AlertTriangle className="w-4 h-4" />;
      case 'vital_sign': return <Activity className="w-4 h-4" />;
      case 'lab_result': return <Info className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-900';
      case 'high': return 'border-amber-500 bg-amber-50 text-amber-900';
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-900';
      default: return 'border-slate-500 bg-slate-50 text-slate-900';
    }
  };

  return (
    <div className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-900">Clinical Decision Alerts</h2>
        <p className="text-xs text-slate-500 mt-1">
          Real-time AI-powered alerts for drug interactions, vital signs, and lab results
        </p>
      </div>
      <div className="p-5 space-y-4">
        <button
          onClick={generateAlerts}
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
              Generating Alerts...
            </>
          ) : (
            'Generate Alerts'
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {alerts && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                <div className="text-lg font-bold text-red-600">{alerts.summary.critical}</div>
                <div className="text-xs text-red-700">Critical</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-lg font-bold text-amber-600">{alerts.summary.high}</div>
                <div className="text-xs text-amber-700">High</div>
              </div>
              <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="text-lg font-bold text-yellow-600">{alerts.summary.medium}</div>
                <div className="text-xs text-yellow-700">Medium</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-600">{alerts.summary.low}</div>
                <div className="text-xs text-slate-700">Low</div>
              </div>
            </div>

            {/* Alerts List */}
            {alerts.alerts && alerts.alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.alerts.map((alert: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${getAlertColor(alert.type)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getAlertIcon(alert.category)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold uppercase">{alert.category}</span>
                          <span className="text-xs font-bold uppercase">{alert.type}</span>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs mt-1 font-medium">{alert.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-emerald-700">No alerts detected</p>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Generated: {alerts.metadata?.generatedAt || new Date().toISOString()}</span>
              <span>By: {alerts.metadata?.generatedBy || 'System'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}
