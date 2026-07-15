/**
 * Inventory Management Utilities
 * 
 * Real-time inventory optimization, automated ordering, and predictive restocking
 */

import { supabase } from '@/lib/supabase';

export interface InventoryItem {
  id: string;
  medication_name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit_price: number;
  unit: string;
  expiry_date: string;
}

export interface OrderRecommendation {
  itemId: string;
  itemName: string;
  quantity: number;
  urgency: 'immediate' | 'high' | 'normal' | 'low';
  estimatedDays: number;
  estimatedCost: number;
  reason: string;
}

export interface InventoryOptimizationResult {
  recommendations: OrderRecommendation[];
  totalCost: number;
  estimatedSavings: number;
  wasteReductionPotential: number;
  actionItems: string[];
}

/**
 * Calculate days remaining in stock
 */
export function calculateDaysInStock(
  currentStock: number,
  dailyConsumption: number
): number {
  if (dailyConsumption <= 0) return 999;
  return Math.ceil(currentStock / dailyConsumption);
}

/**
 * Determine reorder urgency based on days remaining
 */
export function getReorderUrgency(
  daysRemaining: number,
  leadTimeDays: number = 3
): 'immediate' | 'high' | 'normal' | 'low' {
  if (daysRemaining <= leadTimeDays) return 'immediate';
  if (daysRemaining <= leadTimeDays * 2) return 'high';
  if (daysRemaining <= leadTimeDays * 3) return 'normal';
  return 'low';
}

/**
 * Calculate Economic Order Quantity (EOQ)
 */
export function calculateEOQ(
  annualDemand: number,
  orderingCost: number = 100,
  holdingCostPerUnit: number = 2
): number {
  if (annualDemand <= 0 || holdingCostPerUnit <= 0) return 0;
  const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
  return Math.ceil(eoq);
}

/**
 * Generate reorder point using formula: (average daily demand × lead time) + safety stock
 */
export function calculateReorderPoint(
  averageDailyDemand: number,
  leadTimeDays: number = 3,
  safetyStockDays: number = 2
): number {
  const safetyStock = averageDailyDemand * safetyStockDays;
  const reorderPoint = (averageDailyDemand * leadTimeDays) + safetyStock;
  return Math.ceil(reorderPoint);
}

/**
 * Detect slow-moving inventory
 */
export function identifySlowMovingItems(
  items: InventoryItem[],
  thirtyDayUsage: Map<string, number>
): { item: InventoryItem; daysOfStock: number; status: 'critical' | 'high' | 'normal' | 'excellent' }[] {
  return items.map(item => {
    const usage = thirtyDayUsage.get(item.id) || item.stock_quantity / 30;
    const daysOfStock = calculateDaysInStock(item.stock_quantity, usage / 30);
    
    let status: 'critical' | 'high' | 'normal' | 'excellent' = 'normal';
    if (daysOfStock > 180) status = 'excellent';
    else if (daysOfStock > 90) status = 'high';
    else if (daysOfStock < 7) status = 'critical';

    return { item, daysOfStock, status };
  }).sort((a, b) => b.daysOfStock - a.daysOfStock);
}

/**
 * Detect expiry risks
 */
export function identifyExpiryRisks(
  items: InventoryItem[],
  _warningDays: number = 60
): {
  item: InventoryItem;
  daysUntilExpiry: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}[] {
  const today = new Date();
  
  return items
    .map(item => {
      if (!item.expiry_date) return null;
      
      const expiryDate = new Date(item.expiry_date);
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (daysUntilExpiry < 0) riskLevel = 'critical';
      else if (daysUntilExpiry < 14) riskLevel = 'high';
      else if (daysUntilExpiry < 30) riskLevel = 'medium';

      return { item, daysUntilExpiry, riskLevel };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Generate comprehensive inventory optimization recommendations
 */
export async function generateInventoryOptimizations(
  hospitalId: string
): Promise<InventoryOptimizationResult> {
  // Fetch current inventory
  const { data: inventory, error: invError } = await supabase
    .from('pharmacy_inventory')
    .select('*')
    .eq('hospital_id', hospitalId);

  if (invError || !inventory) {
    throw new Error('Failed to fetch inventory');
  }

  // Fetch recent usage data (mock for now)
  const thirtyDayUsage = new Map<string, number>();
  inventory.forEach(item => {
    const dailyUsage = Math.max(5, Math.floor(Math.random() * 50));
    thirtyDayUsage.set(item.id, dailyUsage * 30);
  });

  const recommendations: OrderRecommendation[] = [];
  let totalCost = 0;
  let estimatedSavings = 0;
  const actionItems: string[] = [];

  // Analyze each item
  inventory.forEach(item => {
    const usage = thirtyDayUsage.get(item.id) || item.stock_quantity / 30;
    const dailyUsage = usage / 30;
    const daysRemaining = calculateDaysInStock(item.stock_quantity, dailyUsage);
    const reorderPoint = calculateReorderPoint(dailyUsage);
    const urgency = getReorderUrgency(daysRemaining);

    // Generate order if needed
    if (item.stock_quantity < reorderPoint) {
      const eoq = calculateEOQ(usage, 100, item.unit_price * 0.25);
      const orderQuantity = Math.max(eoq, item.min_stock_level * 2);
      const estimatedDays = calculateDaysInStock(item.stock_quantity + orderQuantity, dailyUsage);

      recommendations.push({
        itemId: item.id,
        itemName: item.medication_name,
        quantity: orderQuantity,
        urgency,
        estimatedDays,
        estimatedCost: orderQuantity * item.unit_price,
        reason: `Current: ${item.stock_quantity}, Min: ${item.min_stock_level}, EOQ: ${eoq}`
      });

      totalCost += orderQuantity * item.unit_price;
    }

    // Check for overstock
    if (item.stock_quantity > item.min_stock_level * 5) {
      const excessValue = (item.stock_quantity - item.min_stock_level * 3) * item.unit_price;
      estimatedSavings += excessValue * 0.1; // 10% cost reduction potential
      actionItems.push(`Review ${item.medication_name}: ${item.stock_quantity}${item.unit} (${(item.stock_quantity / item.min_stock_level).toFixed(1)}x min level)`);
    }
  });

  // Detect waste potential
  const slowMoving = identifySlowMovingItems(inventory, thirtyDayUsage)
    .filter(s => s.status === 'excellent' && s.item.stock_quantity > 0);
  
  const wasteReductionPotential = slowMoving.reduce(
    (sum, item) => sum + ((item.item.stock_quantity - item.item.min_stock_level * 2) * item.item.unit_price),
    0
  );

  // Add action items for expirying stock
  const expiryRisks = identifyExpiryRisks(inventory, 60);
  expiryRisks.forEach(risk => {
    if (risk.riskLevel === 'critical' || risk.riskLevel === 'high') {
      actionItems.push(
        `URGENT: ${risk.item.medication_name} expires in ${risk.daysUntilExpiry} days (${risk.item.stock_quantity}${risk.item.unit})`
      );
    }
  });

  return {
    recommendations: recommendations.sort((a, b) => {
      const urgencyOrder: Record<string, number> = { immediate: 0, high: 1, normal: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }),
    totalCost,
    estimatedSavings,
    wasteReductionPotential,
    actionItems
  };
}

/**
 * Predict stock availability for critical items
 */
export function predictStockAvailability(
  items: InventoryItem[],
  usageData: Map<string, number>,
  _forecastDays: number = 30
): Map<string, { daysUntilStockout: number; riskLevel: 'critical' | 'high' | 'medium' | 'safe' }> {
  const predictions = new Map();

  items.forEach(item => {
    const monthlyUsage = usageData.get(item.id) || item.stock_quantity;
    const dailyUsage = monthlyUsage / 30;
    const daysUntilStockout = calculateDaysInStock(item.stock_quantity, dailyUsage);

    let riskLevel: 'critical' | 'high' | 'medium' | 'safe' = 'safe';
    if (daysUntilStockout <= 3) riskLevel = 'critical';
    else if (daysUntilStockout <= 7) riskLevel = 'high';
    else if (daysUntilStockout <= 14) riskLevel = 'medium';

    predictions.set(item.id, {
      daysUntilStockout,
      riskLevel
    });
  });

  return predictions;
}

/**
 * Get inventory health score (0-100)
 */
export function calculateInventoryHealthScore(
  inventory: InventoryItem[],
  _usageData: Map<string, number>
): number {
  if (inventory.length === 0) return 0;

  let healthScore = 100;

  // Check for stockouts
  const stockoutItems = inventory.filter(i => i.stock_quantity === 0 || i.stock_quantity < i.min_stock_level);
  healthScore -= stockoutItems.length * 10;

  // Check for overstock
  const overstockItems = inventory.filter(i => i.stock_quantity > i.min_stock_level * 5);
  healthScore -= overstockItems.length * 5;

  // Check for expired items
  const today = new Date();
  const expiredItems = inventory.filter(i => {
    if (!i.expiry_date) return false;
    return new Date(i.expiry_date) < today;
  });
  healthScore -= expiredItems.length * 10;

  // Check for items expiring soon
  const expiringItems = inventory.filter(i => {
    if (!i.expiry_date) return false;
    const daysToExpiry = Math.floor((new Date(i.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysToExpiry > 0 && daysToExpiry <= 30;
  });
  healthScore -= expiringItems.length * 3;

  return Math.max(0, healthScore);
}

/**
 * Generate inventory report
 */
export function generateInventoryReport(
  inventory: InventoryItem[],
  optimizations: InventoryOptimizationResult,
  usageData: Map<string, number>
): string {
  const healthScore = calculateInventoryHealthScore(inventory, usageData);
  const slowMoving = identifySlowMovingItems(inventory, usageData);
  const expiryRisks = identifyExpiryRisks(inventory, 60);

  const report = `
===========================================
INVENTORY MANAGEMENT REPORT
===========================================

HEALTH SCORE: ${healthScore}/100

SUMMARY:
- Total Items: ${inventory.length}
- Low Stock Items: ${inventory.filter(i => i.stock_quantity < i.min_stock_level).length}
- Overstock Items: ${inventory.filter(i => i.stock_quantity > i.min_stock_level * 5).length}
- Expiring Soon (< 60 days): ${expiryRisks.length}

FINANCIAL SUMMARY:
- Reorder Cost: $${optimizations.totalCost.toFixed(2)}
- Estimated Savings: $${optimizations.estimatedSavings.toFixed(2)}
- Waste Reduction Potential: $${optimizations.wasteReductionPotential.toFixed(2)}

IMMEDIATE ACTIONS:
${optimizations.actionItems.map(action => `- ${action}`).join('\n')}

SLOW-MOVING INVENTORY:
${slowMoving.slice(0, 5).map(item => `- ${item.item.medication_name}: ${item.daysOfStock} days supply`).join('\n')}

EXPIRY ALERTS:
${expiryRisks.slice(0, 5).map(risk => `- ${risk.item.medication_name}: ${risk.daysUntilExpiry} days`).join('\n')}

Generated: ${new Date().toLocaleString()}
  `;

  return report;
}
