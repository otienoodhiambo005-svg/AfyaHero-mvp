import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface FlowPrediction {
  timeWindow: string;
  predictedArrivals: number;
  confidence: number;
  factors: string[];
  resourceNeeds: {
    doctors: number;
    nurses: number;
    triageStaff: number;
  };
  overflowRisk: 'low' | 'medium' | 'high';
}

export const GET = withAuthzAndTenant(async (request: NextRequest, { hospitalId }: AuthzContext) => {
  try {

    // Get current patient volume
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const currentVolume = await prisma.receptionCheckin.count({
      where: {
        hospitalId,
        checkedInAt: {
          gte: todayStart,
        },
      },
    });

    // Get historical appointment data for pattern analysis
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const historicalAppointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        appointmentDate: {
          gte: sevenDaysAgo,
          lt: now,
        },
      },
      select: {
        appointmentDate: true,
      },
    });

    // Get current queue size
    const queueSize = await prisma.hospitalQueue.count({
      where: { hospitalId, status: 'waiting' },
    });

    // Generate predictions for different time windows
    const predictions: FlowPrediction[] = await generateFlowPredictions(
      historicalAppointments,
      currentVolume,
      queueSize,
      hospitalId
    );

    logger.info('Patient flow prediction completed', {
      hospitalId,
      currentVolume,
      predictionsGenerated: predictions.length,
    });

    return NextResponse.json({
      predictions,
      currentVolume,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Patient flow prediction error', { error });
    return NextResponse.json(
      { error: 'Failed to generate patient flow predictions' },
      { status: 500 }
    );
  }
}, ['admin', 'medical']);

async function generateFlowPredictions(
  historicalAppointments: any[],
  currentVolume: number,
  queueSize: number,
  hospitalId: string
): Promise<FlowPrediction[]> {
  const predictions: FlowPrediction[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  // Calculate average appointments per hour from historical data
  const appointmentsByHour = new Map<number, number>();
  for (const apt of historicalAppointments) {
    const hour = apt.appointmentDate ? new Date(apt.appointmentDate).getHours() : 9;
    appointmentsByHour.set(hour, (appointmentsByHour.get(hour) || 0) + 1);
  }

  const avgAppointmentsPerHour = appointmentsByHour.size > 0
    ? Array.from(appointmentsByHour.values()).reduce((sum, count) => sum + count, 0) / appointmentsByHour.size
    : 5;

  // Generate predictions for different time windows
  const timeWindows = [
    { label: 'Next 30 min', minutes: 30 },
    { label: '30-60 min', minutes: 60 },
    { label: '1-2 hours', minutes: 120 },
    { label: '2-4 hours', minutes: 240 },
    { label: '4-8 hours', minutes: 480 },
  ];

  for (const window of timeWindows) {
    // Base prediction on historical patterns
    let predictedArrivals = Math.round((avgAppointmentsPerHour * window.minutes) / 60);

    // Adjust for time of day
    const hourFactor = getTimeOfDayFactor(currentHour + window.minutes / 60);
    predictedArrivals = Math.round(predictedArrivals * hourFactor);

    // Adjust for current queue size (more queue = more likely arrivals)
    if (queueSize > 20) {
      predictedArrivals = Math.round(predictedArrivals * 1.3);
    } else if (queueSize > 10) {
      predictedArrivals = Math.round(predictedArrivals * 1.1);
    }

    // Add randomness for confidence calculation
    const confidence = 0.9 - (window.minutes / 480) * 0.2; // Confidence decreases with longer predictions

    // Calculate resource needs (1 doctor per 10 patients, 1 nurse per 5 patients, 1 triage per 8 patients)
    const resourceNeeds = {
      doctors: Math.max(1, Math.ceil(predictedArrivals / 10)),
      nurses: Math.max(2, Math.ceil(predictedArrivals / 5)),
      triageStaff: Math.max(1, Math.ceil(predictedArrivals / 8)),
    };

    // Calculate overflow risk
    const currentCapacity = 50; // Assume facility can handle 50 patients per time window
    const utilization = (currentVolume + predictedArrivals) / currentCapacity;
    let overflowRisk: 'low' | 'medium' | 'high' = 'low';
    if (utilization > 0.9) {
      overflowRisk = 'high';
    } else if (utilization > 0.75) {
      overflowRisk = 'medium';
    }

    // Generate factors
    const factors = generatePredictionFactors(currentHour, window.minutes, queueSize);

    predictions.push({
      timeWindow: window.label,
      predictedArrivals,
      confidence,
      factors,
      resourceNeeds,
      overflowRisk,
    });
  }

  return predictions;
}

function getTimeOfDayFactor(hour: number): number {
  // Adjust prediction based on typical hospital traffic patterns
  // Morning (8-12): 1.2x
  // Afternoon (12-16): 1.0x
  // Evening (16-20): 0.8x
  // Night (20-8): 0.3x
  const normalizedHour = hour % 24;

  if (normalizedHour >= 8 && normalizedHour < 12) {
    return 1.2;
  } else if (normalizedHour >= 12 && normalizedHour < 16) {
    return 1.0;
  } else if (normalizedHour >= 16 && normalizedHour < 20) {
    return 0.8;
  } else {
    return 0.3;
  }
}

function generatePredictionFactors(currentHour: number, windowMinutes: number, queueSize: number): string[] {
  const factors: string[] = [];

  // Time of day factor
  const normalizedHour = currentHour % 24;
  if (normalizedHour >= 8 && normalizedHour < 12) {
    factors.push('Morning rush pattern');
  } else if (normalizedHour >= 12 && normalizedHour < 16) {
    factors.push('Afternoon steady flow');
  } else if (normalizedHour >= 16 && normalizedHour < 20) {
    factors.push('Evening decline pattern');
  } else {
    factors.push('Night low-volume period');
  }

  // Day of week factor
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 1) {
    factors.push('Monday surge');
  } else if (dayOfWeek === 5) {
    factors.push('Friday steady flow');
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    factors.push('Weekend reduced volume');
  }

  // Queue factor
  if (queueSize > 20) {
    factors.push('High queue indicating continued arrivals');
  } else if (queueSize > 10) {
    factors.push('Moderate queue');
  }

  // Seasonal factor (simplified - would use historical data in production)
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) {
    factors.push('Spring season - typical increase');
  } else if (month >= 9 && month <= 11) {
    factors.push('Rainy season - potential malaria increase');
  }

  return factors;
}
