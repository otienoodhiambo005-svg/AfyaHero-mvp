'use client';

import { useState, useMemo } from 'react';

export interface InventoryInsight {
  type: 'reorder' | 'expiry' | 'optimization';
  drugName: string;
  reason: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
  actionLabel: string;
}

export function useInventoryIntelligence() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Mock intelligence data based on clinic trends
  const insights: InventoryInsight[] = useMemo(() => [
    {
      type: 'reorder',
      drugName: 'Metformin 500mg',
      reason: 'High consumption linked to current endemic trends',
      recommendation: 'Order 50 packs immediately to avoid stock-out in 48h',
      severity: 'high',
      actionLabel: 'Approve Reorder'
    },
    {
      type: 'expiry',
      drugName: 'Amoxil Syrup',
      reason: 'Batch AMX-221 expires in 14 days',
      recommendation: 'Apply 20% discount or transfer to community clinic',
      severity: 'medium',
      actionLabel: 'Apply Discount'
    },
    {
      type: 'optimization',
      drugName: 'Coartem',
      reason: 'Seasonal malaria peak predicted in 10 days',
      recommendation: 'Increase baseline buffer by 15%',
      severity: 'low',
      actionLabel: 'Adjust Buffer'
    }
  ], []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    // Simulate AI processing queue and stock history
    await new Promise(r => setTimeout(r, 1500));
    setIsAnalyzing(false);
  };

  return {
    insights,
    isAnalyzing,
    runAnalysis
  };
}
