'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Activity, Users, TrendingUp, Info } from 'lucide-react';

interface PopulationHealthAnalyticsProps {
  facilityId?: string;
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  reportType?: 'ahi' | 'outbreak' | 'amr' | 'performance';
}

export default function PopulationHealthAnalytics({
  facilityId,
  timeframe = 'month',
  reportType = 'ahi',
}: PopulationHealthAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/population/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId,
          timeframe,
          reportType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate population health analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate population health analytics');
    } finally {
      setLoading(false);
    }
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'outbreak': return <AlertTriangle className="w-4 h-4" />;
      case 'amr': return <Activity className="w-4 h-4" />;
      case 'performance': return <TrendingUp className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-900">Population Health Analytics</h2>
        <p className="text-xs text-slate-500 mt-1">
          AI-driven population health insights, outbreak detection, and AMR surveillance
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <select
            value={reportType}
            onChange={(e) => {
              // In a real implementation, this would update the reportType state
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-violet-500/50"
          >
            <option value="ahi">AHI Report</option>
            <option value="outbreak">Outbreak Detection</option>
            <option value="amr">AMR Surveillance</option>
            <option value="performance">System Performance</option>
          </select>
          <select
            value={timeframe}
            onChange={(e) => {
              // In a real implementation, this would update the timeframe state
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-violet-500/50"
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
          <button
            onClick={generateAnalytics}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Report'
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {analytics && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {getReportIcon(reportType)}
              <span className="text-sm font-semibold text-slate-900 capitalize">
                {reportType} Analytics
              </span>
              <span className="ml-auto text-xs text-slate-500">Timeframe: {timeframe}</span>
            </div>

            {analytics.report ? (
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(analytics.report, null, 2)}</pre>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(analytics, null, 2)}</pre>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <Info className="w-3 h-3" />
              <span>Generated: {analytics.generatedAt || new Date().toISOString()}</span>
              <span>By: {analytics.generatedBy || 'System'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
