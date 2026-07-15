'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Users, Bed, Package, Info, Settings } from 'lucide-react';

interface ResourceAllocationUIProps {
  resourceType?: 'staff' | 'beds' | 'equipment' | 'supplies';
  facilityId?: string;
  currentAllocation?: Record<string, unknown>;
  demandData?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  optimizationGoal?: 'efficiency' | 'cost' | 'quality' | 'balance';
}

export default function ResourceAllocationUI({
  resourceType = 'staff',
  facilityId,
  currentAllocation,
  demandData,
  constraints,
  optimizationGoal = 'efficiency',
}: ResourceAllocationUIProps) {
  const [optimization, setOptimization] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimizeResources = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/resource-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType,
          facilityId,
          currentAllocation,
          demandData,
          constraints,
          optimizationGoal,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize resource allocation');
      }

      const data = await response.json();
      setOptimization(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize resource allocation');
    } finally {
      setLoading(false);
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'staff': return <Users className="w-4 h-4" />;
      case 'beds': return <Bed className="w-4 h-4" />;
      case 'equipment': return <Settings className="w-4 h-4" />;
      case 'supplies': return <Package className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-900">Resource Allocation Optimization</h2>
        <p className="text-xs text-slate-500 mt-1">
          AI-driven resource allocation for staff, beds, equipment, and supplies
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <select
            value={resourceType}
            onChange={(e) => {
              // In a real implementation, this would update the resourceType state
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-violet-500/50"
          >
            <option value="staff">Staff</option>
            <option value="beds">Beds</option>
            <option value="equipment">Equipment</option>
            <option value="supplies">Supplies</option>
          </select>
          <select
            value={optimizationGoal}
            onChange={(e) => {
              // In a real implementation, this would update the optimizationGoal state
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-violet-500/50"
          >
            <option value="efficiency">Efficiency</option>
            <option value="cost">Cost</option>
            <option value="quality">Quality</option>
            <option value="balance">Balance</option>
          </select>
          <button
            onClick={optimizeResources}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                Optimizing...
              </>
            ) : (
              'Optimize'
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {optimization && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {getResourceIcon(resourceType)}
              <span className="text-sm font-semibold text-slate-900 capitalize">
                {resourceType} Optimization Results
              </span>
              <span className="ml-auto text-xs text-slate-500">Goal: {optimizationGoal}</span>
            </div>

            {optimization.optimization ? (
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(optimization.optimization, null, 2)}</pre>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                <pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(optimization, null, 2)}</pre>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <Info className="w-3 h-3" />
              <span>Generated: {optimization.metadata?.generatedAt || new Date().toISOString()}</span>
              <span>By: {optimization.metadata?.generatedBy || 'System'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
