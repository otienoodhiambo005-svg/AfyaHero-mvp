/**
 * Inventory Management Configuration
 * 
 * Centralized settings for the smart inventory system.
 * Adjust these values based on your hospital's needs.
 */

export const INVENTORY_CONFIG = {
  // Forecast Settings
  forecast: {
    predictionDays: 30,
    seasonalityEnabled: true,
    bufferDays: 7,
    confidenceThreshold: 0.75
  },

  // EOQ and Ordering
  ordering: {
    standardOrderingCost: 100,        // $ per order
    holdingCostPercentage: 0.25,      // 25% of unit cost
    leadTimeDays: 3,
    safetyStockDays: 2,
    maxOrderDaysOfStock: 90
  },

  // ABC Analysis Thresholds
  abcAnalysis: {
    categoryAPercentage: 70,
    categoryBPercentage: 20,
    categoryCPercentage: 10,
    categoryAManagementLevel: 'high',
    categoryBManagementLevel: 'medium',
    categoryCManagementLevel: 'low'
  },

  // Alert Thresholds
  alerts: {
    critical: {
      stockoutDays: 0,
      expiryDays: 0,
      costThreshold: 1000
    },
    high: {
      lowStockDays: 7,
      expiryDays: 14,
      overstockMultiplier: 5
    },
    medium: {
      expiryDays: 30,
      slowMovingDays: 180,
      overstockMultiplier: 3
    },
    low: {
      expiryDays: 60,
      slowMovingDays: 365
    }
  },

  // Slow-Moving Inventory Detection
  slowMoving: {
    thresholdDays: 180,
    minPriceThreshold: 5,
    minStockMultiplier: 2,
    actionRequired: true
  },

  // Expiry Management
  expiry: {
    warningPeriodDays: 60,
    criticalPeriodDays: 14,
    actionablePeriodDays: 30,
    fifoEnabled: true
  },

  // Supplier Settings
  supplier: {
    defaultLeadTime: 3,
    defaultDeliveryAccuracy: 95,
    minSupplierRating: 3.5,
    evaluationPeriodDays: 90
  },

  // Cost Optimization
  costOptimization: {
    minOrderQuantity: 10,
    roundOrderTo: 10,
    overallocationPercentage: 15,
    wasteReductionTarget: 5
  },

  // Health Score Calculation
  healthScore: {
    stockoutPenalty: 10,
    overstockPenalty: 5,
    expiredItemPenalty: 10,
    expiringItemPenalty: 3,
    perfectScore: 100
  },

  // Reporting
  reporting: {
    generateMonthlyReports: true,
    includeFinancialData: true,
    includeSupplierMetrics: true,
    exportFormats: ['pdf', 'csv', 'json']
  },

  // Performance
  performance: {
    cacheAnalysisResults: true,
    cacheExpirationMinutes: 60,
    maxItemsPerPage: 50,
    enableVirtualization: true
  },

  // Notifications
  notifications: {
    enableCriticalAlerts: true,
    enableHighAlerts: true,
    enableMediumAlerts: false,
    alertChannels: ['dashboard', 'email', 'sms']
  }
};

/**
 * Get alert severity level for given conditions
 */
export function getAlertSeverity(
  days: number,
  threshold: 'critical' | 'high' | 'medium' | 'low',
  reason: 'stockout' | 'expiry' | 'overstock' | 'slow_moving'
): 'critical' | 'high' | 'medium' | 'low' {
  const config = INVENTORY_CONFIG.alerts;

  if (reason === 'stockout') {
    if (days === 0) return 'critical';
    if (days <= config.high.lowStockDays) return 'high';
    return 'medium';
  }

  if (reason === 'expiry') {
    if (days <= config.critical.expiryDays) return 'critical';
    if (days <= config.high.expiryDays) return 'high';
    if (days <= config.medium.expiryDays) return 'medium';
    return 'low';
  }

  if (reason === 'overstock') {
    if (days > config.high.overstockMultiplier) return 'high';
    if (days > config.medium.overstockMultiplier) return 'medium';
    return 'low';
  }

  if (reason === 'slow_moving') {
    if (days > INVENTORY_CONFIG.slowMoving.thresholdDays) return 'medium';
    return 'low';
  }

  return threshold;
}

/**
 * Calculate environmental impact score (0-100)
 * Based on waste reduction, efficiency, and sustainability
 */
export function calculateEnvironmentalScore(
  wasteReduction: number,
  optimizationLevel: number,
  supplierEcoRating: number
): number {
  const weights = {
    waste: 0.4,
    optimization: 0.35,
    ecoSuppliers: 0.25
  };

  return Math.round(
    (wasteReduction * weights.waste) +
    (optimizationLevel * weights.optimization) +
    (supplierEcoRating * weights.ecoSuppliers)
  );
}

/**
 * Estimate financial impact of inventory issues
 */
export function estimateFinancialImpact(
  items: Array<{ stock: number; unitPrice: number; type: 'overstock' | 'understock' | 'expiry' }>,
  daysRemaining: number = 30
): {
  totalCost: number;
  costPerDay: number;
  recommendations: string[];
} {
  let totalCost = 0;
  const recommendations: string[] = [];

  items.forEach(item => {
    const itemCost = item.stock * item.unitPrice;

    if (item.type === 'overstock') {
      const holdingCost = itemCost * INVENTORY_CONFIG.ordering.holdingCostPercentage;
      totalCost += (holdingCost / 365) * daysRemaining;
      recommendations.push(`Review overstock policies for items with carrying cost > $${holdingCost.toFixed(2)}`);
    }

    if (item.type === 'understock') {
      totalCost += itemCost * 0.1; // 10% emergency cost premium
      recommendations.push('Increase safety stock for critical items');
    }

    if (item.type === 'expiry') {
      totalCost += itemCost * 0.5; // 50% loss of expired goods
      recommendations.push('Implement FIFO and accelerate usage');
    }
  });

  return {
    totalCost,
    costPerDay: totalCost / daysRemaining,
    recommendations
  };
}

/**
 * Priority matrix for action items
 * Combines urgency and financial impact
 */
export function prioritizeActions(
  items: Array<{
    id: string;
    name: string;
    type: 'order' | 'review' | 'dispose' | 'consolidate';
    urgency: 'critical' | 'high' | 'medium' | 'low';
    financialImpact: number;
  }>
): typeof items {
  const urgencyScores = { critical: 4, high: 3, medium: 2, low: 1 };
  const typeWeights = { order: 1.0, dispose: 0.9, review: 0.7, consolidate: 0.5 };

  return items.sort((a, b) => {
    const scoreA = (urgencyScores[a.urgency] * 2 + a.financialImpact) * typeWeights[a.type];
    const scoreB = (urgencyScores[b.urgency] * 2 + b.financialImpact) * typeWeights[b.type];
    return scoreB - scoreA;
  });
}

/**
 * Get recommended order date based on lead time and safety stock
 */
export function getRecommendedOrderDate(
  currentStock: number,
  dailyUsage: number,
  leadTimeDays: number = INVENTORY_CONFIG.ordering.leadTimeDays,
  safetyStockDays: number = INVENTORY_CONFIG.ordering.safetyStockDays
): Date {
  const reorderPoint = (dailyUsage * leadTimeDays) + (dailyUsage * safetyStockDays);
  const daysUntilReorder = (currentStock - reorderPoint) / dailyUsage;
  
  return new Date(Date.now() + daysUntilReorder * 24 * 60 * 60 * 1000);
}

/**
 * Calculate inventory turnover ratio
 * Higher = faster sales/usage (generally better)
 */
export function calculateTurnoverRatio(
  annualCostOfGoodsSold: number,
  averageInventoryValue: number
): number {
  if (averageInventoryValue === 0) return 0;
  return annualCostOfGoodsSold / averageInventoryValue;
}

/**
 * Get inventory classification based on ABC analysis
 */
export function classifyInventory(
  items: Array<{ name: string; annualValue: number }>,
  distribution = INVENTORY_CONFIG.abcAnalysis
): {
  [key: string]: { name: string; annualValue: number; category: 'A' | 'B' | 'C' }[];
} {
  const sorted = [...items].sort((a, b) => b.annualValue - a.annualValue);
  const totalValue = sorted.reduce((sum, item) => sum + item.annualValue, 0);

  let aPercentage = 0;
  let bPercentage = 0;
  const result: { A: any[]; B: any[]; C: any[] } = { A: [], B: [], C: [] };

  sorted.forEach(item => {
    const cumulativePercentage = (aPercentage + bPercentage + item.annualValue) / totalValue;

    if (cumulativePercentage <= distribution.categoryAPercentage / 100) {
      result.A.push({ ...item, category: 'A' });
      aPercentage += item.annualValue / totalValue;
    } else if (cumulativePercentage <= (distribution.categoryAPercentage + distribution.categoryBPercentage) / 100) {
      result.B.push({ ...item, category: 'B' });
      bPercentage += item.annualValue / totalValue;
    } else {
      result.C.push({ ...item, category: 'C' });
    }
  });

  return result;
}

// Export utility function to reset config to defaults
export function resetToDefaults() {
  return INVENTORY_CONFIG;
}

// Export function to validate configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (INVENTORY_CONFIG.forecast.predictionDays <= 0) {
    errors.push('Forecast prediction days must be positive');
  }

  if (INVENTORY_CONFIG.ordering.standardOrderingCost <= 0) {
    errors.push('Ordering cost must be positive');
  }

  if (INVENTORY_CONFIG.abcAnalysis.categoryAPercentage + 
      INVENTORY_CONFIG.abcAnalysis.categoryBPercentage + 
      INVENTORY_CONFIG.abcAnalysis.categoryCPercentage !== 100) {
    errors.push('ABC analysis percentages must sum to 100%');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
