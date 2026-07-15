import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface ExecutiveMetric {
  id: string;
  name: string;
  currentValue: number;
  previousValue: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  status: 'on-track' | 'at-risk' | 'critical';
  category: 'financial' | 'operational' | 'clinical' | 'strategic';
  unit: string;
  confidence: number;
}

interface Forecast {
  period: string;
  projectedRevenue: number;
  projectedPatientVolume: number;
  projectedStaffing: number;
  riskFactors: string[];
  opportunities: string[];
}

interface StrategicInsight {
  id: string;
  category: 'growth' | 'efficiency' | 'risk' | 'innovation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  recommendedActions: string[];
}

export const GET = withAuthzAndTenant(async (request: NextRequest, { hospitalId }: AuthzContext) => {
  try {

    // Calculate time ranges for comparison
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch data for metrics calculation
    const [
      currentPayments,
      previousPayments,
      currentPatients,
      previousPatients,
      currentAppointments,
      previousAppointments,
      currentConsultations,
      previousConsultations,
      hospitalBeds,
    ] = await Promise.all([
      // Current month payments
      prisma.paymentTransaction.aggregate({
        where: {
          hospitalId,
          createdAt: { gte: currentMonthStart },
          status: 'completed',
        },
        _sum: { amount: true },
      }),
      // Previous month payments
      prisma.paymentTransaction.aggregate({
        where: {
          hospitalId,
          createdAt: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
          status: 'completed',
        },
        _sum: { amount: true },
      }),
      // Current month patients
      prisma.patient.count({
        where: {
          hospitalId,
          createdAt: { gte: currentMonthStart },
        },
      }),
      // Previous month patients
      prisma.patient.count({
        where: {
          hospitalId,
          createdAt: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
        },
      }),
      // Current month appointments
      prisma.appointment.count({
        where: {
          hospitalId,
          appointmentDate: { gte: currentMonthStart },
        },
      }),
      // Previous month appointments
      prisma.appointment.count({
        where: {
          hospitalId,
          appointmentDate: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
        },
      }),
      // Current month consultations
      prisma.consultation.count({
        where: {
          hospitalId,
          createdAt: { gte: currentMonthStart },
        },
      }),
      // Previous month consultations
      prisma.consultation.count({
        where: {
          hospitalId,
          createdAt: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
        },
      }),
      // Bed capacity
      prisma.hospitalBed.findMany({
        where: { hospitalId },
        select: { status: true, wardName: true },
      }),
    ]);

    const currentRevenue = Number(currentPayments._sum.amount || 0);
    const previousRevenue = Number(previousPayments._sum.amount || 0);

    // Calculate metrics
    const metrics: ExecutiveMetric[] = [
      {
        id: 'em-001',
        name: 'Monthly Revenue',
        currentValue: currentRevenue,
        previousValue: previousRevenue,
        target: previousRevenue * 1.2, // 20% growth target
        trend: currentRevenue >= previousRevenue ? 'up' : 'down',
        trendPercentage: previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0,
        status: currentRevenue >= previousRevenue * 1.1 ? 'on-track' : currentRevenue >= previousRevenue ? 'at-risk' : 'critical',
        category: 'financial',
        unit: 'KES',
        confidence: 0.95,
      },
      {
        id: 'em-002',
        name: 'Patient Volume',
        currentValue: currentPatients,
        previousValue: previousPatients,
        target: previousPatients * 1.15, // 15% growth target
        trend: currentPatients >= previousPatients ? 'up' : 'down',
        trendPercentage: previousPatients > 0 ? Math.round(((currentPatients - previousPatients) / previousPatients) * 100) : 0,
        status: currentPatients >= previousPatients * 1.05 ? 'on-track' : currentPatients >= previousPatients ? 'at-risk' : 'critical',
        category: 'operational',
        unit: 'patients',
        confidence: 0.98,
      },
      {
        id: 'em-003',
        name: 'Appointment Utilization',
        currentValue: currentAppointments,
        previousValue: previousAppointments,
        target: previousAppointments * 1.1,
        trend: currentAppointments >= previousAppointments ? 'up' : 'down',
        trendPercentage: previousAppointments > 0 ? Math.round(((currentAppointments - previousAppointments) / previousAppointments) * 100) : 0,
        status: currentAppointments >= previousAppointments * 0.95 ? 'on-track' : currentAppointments >= previousAppointments * 0.8 ? 'at-risk' : 'critical',
        category: 'operational',
        unit: 'appointments',
        confidence: 0.92,
      },
      {
        id: 'em-004',
        name: 'Clinical Consultations',
        currentValue: currentConsultations,
        previousValue: previousConsultations,
        target: previousConsultations * 1.2,
        trend: currentConsultations >= previousConsultations ? 'up' : 'down',
        trendPercentage: previousConsultations > 0 ? Math.round(((currentConsultations - previousConsultations) / previousConsultations) * 100) : 0,
        status: currentConsultations >= previousConsultations * 1.1 ? 'on-track' : currentConsultations >= previousConsultations ? 'at-risk' : 'critical',
        category: 'clinical',
        unit: 'consultations',
        confidence: 0.94,
      },
      {
        id: 'em-005',
        name: 'Bed Utilization',
        currentValue: hospitalBeds.filter(b => b.status === 'occupied').length,
        previousValue: hospitalBeds.filter(b => b.status === 'occupied').length, // Simplified - would need historical data
        target: Math.round(hospitalBeds.length * 0.85), // 85% utilization target
        trend: 'stable',
        trendPercentage: 0,
        status: hospitalBeds.length > 0 ? 
          (hospitalBeds.filter(b => b.status === 'occupied').length / hospitalBeds.length) >= 0.85 ? 'on-track' :
          (hospitalBeds.filter(b => b.status === 'occupied').length / hospitalBeds.length) >= 0.7 ? 'at-risk' : 'critical' : 'critical',
        category: 'operational',
        unit: 'beds',
        confidence: 1.0,
      },
    ];

    // Generate quarterly forecasts
    const forecasts: Forecast[] = await generateForecasts(hospitalId, currentRevenue, currentPatients);

    // Generate strategic insights
    const insights: StrategicInsight[] = await generateStrategicInsights(hospitalId, metrics, forecasts, currentRevenue);

    logger.info('Executive intelligence completed', {
      hospitalId,
      metricsCount: metrics.length,
      forecastsCount: forecasts.length,
      insightsCount: insights.length,
    });

    return NextResponse.json({
      metrics,
      forecasts,
      insights,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Executive intelligence error', { error });
    return NextResponse.json(
      { error: 'Failed to generate executive intelligence' },
      { status: 500 }
    );
  }
}, ['admin']);

async function generateForecasts(hospitalId: string, currentRevenue: number, currentPatientVolume: number): Promise<Forecast[]> {
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const currentQuarter = quarters[Math.floor(new Date().getMonth() / 3)];
  const forecasts: Forecast[] = [];

  // Generate forecasts for next 3 quarters
  for (let i = 1; i <= 3; i++) {
    const quarterIndex = (quarters.indexOf(currentQuarter) + i) % 4;
    const quarter = quarters[quarterIndex];
    const growthFactor = 1.05 + (i * 0.03); // 5-11% growth per quarter

    forecasts.push({
      period: `${quarter} ${new Date().getFullYear() + (quarters.indexOf(currentQuarter) + i > 3 ? 1 : 0)}`,
      projectedRevenue: Math.round(currentRevenue * growthFactor),
      projectedPatientVolume: Math.round(currentPatientVolume * growthFactor),
      projectedStaffing: Math.round(currentPatientVolume * 0.15 * growthFactor), // 1 staff per 6.6 patients
      riskFactors: [
        'Seasonal illness patterns',
        'Staff turnover risk',
        'Supply chain disruptions',
      ],
      opportunities: [
        'Expand telemedicine services',
        'Optimize appointment scheduling',
        'Implement AI-assisted triage',
      ],
    });
  }

  return forecasts;
}

async function generateStrategicInsights(hospitalId: string, metrics: ExecutiveMetric[], forecasts: Forecast[], currentRevenue: number): Promise<StrategicInsight[]> {
  const insights: StrategicInsight[] = [];

  // Analyze revenue trend
  const revenueMetric = metrics.find(m => m.name === 'Monthly Revenue');
  if (revenueMetric) {
    if (revenueMetric.trend === 'up' && revenueMetric.trendPercentage > 10) {
      insights.push({
        id: 'si-001',
        category: 'growth',
        title: 'Strong Revenue Growth Trajectory',
        description: `Revenue increased by ${revenueMetric.trendPercentage}% compared to previous month. This trend indicates strong market position and patient trust.`,
        impact: 'high',
        timeframe: 'Next 6 months',
        recommendedActions: [
          'Invest in capacity expansion',
          'Consider new service lines',
          'Optimize pricing strategy',
        ],
      });
    } else if (revenueMetric.trend === 'down' || revenueMetric.trendPercentage < 5) {
      insights.push({
        id: 'si-002',
        category: 'risk',
        title: 'Revenue Growth Slowing',
        description: `Revenue growth is below target at ${revenueMetric.trendPercentage}%. Immediate action needed to maintain market position.`,
        impact: 'high',
        timeframe: 'Next 3 months',
        recommendedActions: [
          'Review pricing strategy',
          'Analyze competitor activities',
          'Enhance patient experience',
          'Launch marketing campaigns',
        ],
      });
    }
  }

  // Analyze bed utilization
  const bedMetric = metrics.find(m => m.name === 'Bed Utilization');
  if (bedMetric && bedMetric.status === 'critical') {
    insights.push({
      id: 'si-003',
      category: 'efficiency',
      title: 'Bed Capacity Optimization Needed',
      description: 'Bed utilization is below optimal levels. Consider capacity planning to improve resource allocation.',
      impact: 'medium',
      timeframe: 'Next 3 months',
      recommendedActions: [
        'Review bed allocation policies',
        'Implement discharge planning',
        'Optimize admission criteria',
      ],
    });
  }

  // Analyze patient volume
  const patientMetric = metrics.find(m => m.name === 'Patient Volume');
  if (patientMetric && patientMetric.trend === 'up' && patientMetric.trendPercentage > 15) {
    insights.push({
      id: 'si-004',
      category: 'innovation',
      title: 'Rapid Patient Growth Opportunity',
      description: `Patient volume increased by ${patientMetric.trendPercentage}%. This presents an opportunity to expand services and improve market share.`,
      impact: 'high',
      timeframe: 'Next 6 months',
      recommendedActions: [
        'Expand facility capacity',
        'Add new specialty services',
        'Implement AI-powered triage',
        'Enhance digital health services',
      ],
    });
  }

  // Add forecast-based insights
  if (forecasts.length > 0) {
    const avgRevenueGrowth = forecasts.reduce((sum, f) => sum + f.projectedRevenue, 0) / forecasts.length;
    insights.push({
      id: 'si-005',
      category: 'growth',
      title: 'Quarterly Revenue Forecast Analysis',
      description: `Projected quarterly revenue shows ${Math.round((avgRevenueGrowth / (currentRevenue || 1)) * 100)}% growth trajectory. Strategic planning should align with this forecast.`,
      impact: 'medium',
      timeframe: 'Next 12 months',
      recommendedActions: [
        'Align budget with revenue forecast',
        'Plan staffing accordingly',
        'Invest in infrastructure',
        'Develop contingency plans',
      ],
    });
  }

  return insights;
}
