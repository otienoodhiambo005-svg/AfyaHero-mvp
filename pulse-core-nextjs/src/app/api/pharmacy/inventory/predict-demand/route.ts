import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface DemandPrediction {
  itemId: string;
  itemName: string;
  predictedDemand30Days: number;
  predictedDemand60Days: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedOrderQuantity: number;
  recommendedOrderDate: string;
  factors: string[];
}

export const GET = withAuthzAndTenant(async (request: NextRequest, { hospitalId }: AuthzContext) => {
  try {

    // Fetch pharmacy inventory
    const inventory = await prisma.pharmacyInventory.findMany({
      where: {
        hospitalId,
      },
      select: {
        id: true,
        medicationName: true,
        category: true,
        stockQuantity: true,
        unit: true,
        expiryDate: true,
      },
    });

    // Fetch prescription history for demand analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [prescriptionsLast30Days, prescriptionsLast60Days] = await Promise.all([
      prisma.prescription.findMany({
        where: {
          hospitalId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          items: true,
        },
      }),
      prisma.prescription.findMany({
        where: {
          hospitalId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        select: {
          items: true,
        },
      }),
    ]);

    // Calculate demand for each drug
    const drugUsageLast30Days = new Map<string, number>();
    const drugUsageLast60Days = new Map<string, number>();

    for (const prescription of prescriptionsLast30Days) {
      for (const med of (prescription.items as Array<{ name?: string; medication?: string; quantity?: number }> || [])) {
        const drugName = med.name || med.medication || 'Unknown';
        drugUsageLast30Days.set(drugName, (drugUsageLast30Days.get(drugName) || 0) + (med.quantity || 1));
      }
    }

    for (const prescription of prescriptionsLast60Days) {
      for (const med of (prescription.items as Array<{ name?: string; medication?: string; quantity?: number }> || [])) {
        const drugName = med.name || med.medication || 'Unknown';
        drugUsageLast60Days.set(drugName, (drugUsageLast60Days.get(drugName) || 0) + (med.quantity || 1));
      }
    }

    // Generate predictions for each inventory item
    const predictions: DemandPrediction[] = inventory
      .map((item) => {
        const usage30Days = drugUsageLast30Days.get(item.medicationName) || 0;
        const usage60Days = drugUsageLast60Days.get(item.medicationName) || 0;
        const avgDailyUsage30Days = usage30Days / 30;
        const avgDailyUsage60Days = usage60Days / 30;

        // Calculate trend
        let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        let trendPercentage = 0;

        if (avgDailyUsage30Days > avgDailyUsage60Days * 1.1) {
          trend = 'increasing';
          trendPercentage = Math.round(((avgDailyUsage30Days - avgDailyUsage60Days) / avgDailyUsage60Days) * 100);
        } else if (avgDailyUsage30Days < avgDailyUsage60Days * 0.9) {
          trend = 'decreasing';
          trendPercentage = Math.round(((avgDailyUsage60Days - avgDailyUsage30Days) / avgDailyUsage60Days) * 100);
        } else {
          trendPercentage = 0;
        }

        // Predict demand for next 30 and 60 days
        const predictedDemand30Days = Math.round(avgDailyUsage30Days * 30);
        const predictedDemand60Days = Math.round(avgDailyUsage30Days * 60);

        // Calculate confidence based on data availability
        const confidence = usage30Days > 0 ? 0.85 : 0.5;

        // Calculate risk level based on current stock vs predicted demand
        const daysOfStock = item.stockQuantity > 0 ? item.stockQuantity / (avgDailyUsage30Days || 1) : 0;
        let riskLevel: 'low' | 'medium' | 'high' = 'low';

        if (daysOfStock < 7) {
          riskLevel = 'high';
        } else if (daysOfStock < 14) {
          riskLevel = 'medium';
        }

        // Calculate recommended order quantity
        const targetDaysOfStock = 30; // Target 30 days of stock
        const recommendedOrderQuantity = Math.max(0, Math.round((targetDaysOfStock * avgDailyUsage30Days) - item.stockQuantity));

        // Calculate recommended order date
        const daysUntilReorder = item.stockQuantity > 0 ? Math.round(item.stockQuantity / (avgDailyUsage30Days || 1)) - 14 : 0; // Order when 14 days of stock left
        const recommendedOrderDate = new Date();
        recommendedOrderDate.setDate(recommendedOrderDate.getDate() + Math.max(1, daysUntilReorder));

        // Generate factors
        const factors = generateDemandFactors(item.medicationName, trend, trendPercentage, daysOfStock);

        return {
          itemId: item.id,
          itemName: item.medicationName,
          predictedDemand30Days,
          predictedDemand60Days,
          confidence,
          trend,
          trendPercentage,
          riskLevel,
          recommendedOrderQuantity,
          recommendedOrderDate: recommendedOrderDate.toISOString().split('T')[0],
          factors,
        };
      })
      .sort((a, b) => b.riskLevel === 'high' ? 1 : -1); // Sort high risk first

    logger.info('Inventory demand prediction completed', {
      hospitalId,
      predictionsGenerated: predictions.length,
    });

    return NextResponse.json({
      predictions: predictions.slice(0, 20), // Return top 20 predictions
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Inventory demand prediction error', { error });
    return NextResponse.json(
      { error: 'Failed to generate inventory demand predictions' },
      { status: 500 }
    );
  }
}, ['admin', 'pharmacy']);

function generateDemandFactors(
  drugName: string,
  trend: 'increasing' | 'stable' | 'decreasing',
  trendPercentage: number,
  daysOfStock: number
): string[] {
  const factors: string[] = [];

  // Trend factor
  if (trend === 'increasing') {
    factors.push(`Demand increasing by ${trendPercentage}%`);
  } else if (trend === 'decreasing') {
    factors.push(`Demand decreasing by ${trendPercentage}%`);
  } else {
    factors.push('Demand stable');
  }

  // Seasonal factor
  const month = new Date().getMonth();
  const drugLower = drugName.toLowerCase();

  if (drugLower.includes('malaria') || drugLower.includes('antimalarial')) {
    if (month >= 3 && month <= 5) {
      factors.push('Malaria season approaching - increased demand expected');
    } else if (month >= 10 && month <= 12) {
      factors.push('Rainy season - potential malaria increase');
    }
  }

  if (drugLower.includes('antibiotic') || drugLower.includes('amoxicillin') || drugLower.includes('azithromycin')) {
    factors.push('Seasonal respiratory infections may increase demand');
  }

  if (drugLower.includes('paracetamol') || drugLower.includes('analgesic')) {
    factors.push('Consistent year-round demand pattern');
  }

  // Stock level factor
  if (daysOfStock < 7) {
    factors.push('Critical stock level - immediate reorder recommended');
  } else if (daysOfStock < 14) {
    factors.push('Low stock level - reorder soon');
  } else if (daysOfStock > 60) {
    factors.push('Adequate stock level - no immediate action needed');
  }

  // Drug-specific factors
  if (drugLower.includes('insulin') || drugLower.includes('diabetes')) {
    factors.push('Chronic medication - consistent demand expected');
  }

  if (drugLower.includes('vaccine') || drugLower.includes('immunization')) {
    factors.push('Vaccination schedule may influence demand');
  }

  return factors;
}
