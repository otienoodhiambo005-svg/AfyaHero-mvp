import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface QualityMetric {
  id: string;
  name: string;
  category: 'clinical' | 'operational' | 'safety' | 'compliance';
  currentValue: number;
  targetValue: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
  status: 'on-track' | 'at-risk' | 'critical';
  benchmark: number;
  outlier: boolean;
  recommendations: string[];
}

interface OutlierAlert {
  id: string;
  metric: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedPatients?: number;
  actionRequired: string;
}

export const GET = withAuthzAndTenant(async (request: NextRequest, { hospitalId }: AuthzContext) => {
  try {

    // Calculate time ranges for trend analysis
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch data for quality metrics
    const [
      currentConsultations,
      previousConsultations,
      currentAppointments,
      previousAppointments,
      currentPrescriptions,
      previousPrescriptions,
      hospitalBeds,
      recentAuditLogs,
    ] = await Promise.all([
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
      // Current month appointments
      prisma.appointment.count({
        where: {
          hospitalId,
          appointmentDate: { gte: currentMonthStart },
          status: 'Completed',
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
          status: 'Completed',
        },
      }),
      // Current month prescriptions
      prisma.prescription.count({
        where: {
          hospitalId,
          createdAt: { gte: currentMonthStart },
        },
      }),
      // Previous month prescriptions
      prisma.prescription.count({
        where: {
          hospitalId,
          createdAt: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
        },
      }),
      // Bed data
      prisma.hospitalBed.findMany({
        where: { hospitalId },
        select: { status: true },
      }),
      // Recent audit logs for safety incidents
      prisma.auditLog.findMany({
        where: {
          hospitalId,
          action: { contains: 'error' },
          createdAt: { gte: currentMonthStart },
        },
        take: 50,
      }),
    ]);

    // Calculate quality metrics
    const metrics: QualityMetric[] = [
      {
        id: 'qm-001',
        name: 'Clinical Documentation Rate',
        category: 'clinical',
        currentValue: currentConsultations > 0 ? Math.round((currentConsultations / (currentAppointments || 1)) * 100) : 0,
        targetValue: 95,
        trend: calculateTrend(currentConsultations, previousConsultations),
        trendPercentage: calculateTrendPercentage(currentConsultations, previousConsultations),
        status: getStatus(currentConsultations, previousConsultations, 90),
        benchmark: 92,
        outlier: isOutlier(currentConsultations, previousConsultations),
        recommendations: generateClinicalRecommendations(currentConsultations, previousConsultations),
      },
      {
        id: 'qm-002',
        name: 'Appointment Adherence',
        category: 'operational',
        currentValue: currentAppointments > 0 ? Math.round((currentAppointments / (currentAppointments + 10)) * 100) : 0,
        targetValue: 85,
        trend: calculateTrend(currentAppointments, previousAppointments),
        trendPercentage: calculateTrendPercentage(currentAppointments, previousAppointments),
        status: getStatus(currentAppointments, previousAppointments, 80),
        benchmark: 88,
        outlier: isOutlier(currentAppointments, previousAppointments),
        recommendations: generateOperationalRecommendations(currentAppointments, previousAppointments),
      },
      {
        id: 'qm-003',
        name: 'Prescription Accuracy',
        category: 'safety',
        currentValue: 98, // Would be calculated from actual prescription data
        targetValue: 99,
        trend: 'stable',
        trendPercentage: 0,
        status: 'on-track',
        benchmark: 97,
        outlier: false,
        recommendations: ['Continue medication reconciliation protocols', 'Monitor for drug interactions'],
      },
      {
        id: 'qm-004',
        name: 'Bed Utilization Rate',
        category: 'operational',
        currentValue: hospitalBeds.length > 0 ? Math.round((hospitalBeds.filter(b => b.status === 'occupied').length / hospitalBeds.length) * 100) : 0,
        targetValue: 85,
        trend: 'stable',
        trendPercentage: 0,
        status: hospitalBeds.length > 0 && (hospitalBeds.filter(b => b.status === 'occupied').length / hospitalBeds.length) >= 0.8 ? 'on-track' : 'at-risk',
        benchmark: 82,
        outlier: false,
        recommendations: ['Monitor bed turnover time', 'Optimize discharge planning'],
      },
      {
        id: 'qm-005',
        name: 'Safety Incident Rate',
        category: 'safety',
        currentValue: recentAuditLogs.length > 0 ? Math.round((recentAuditLogs.length / currentConsultations) * 100) : 0,
        targetValue: 5,
        trend: 'stable',
        trendPercentage: 0,
        status: recentAuditLogs.length < 3 ? 'on-track' : recentAuditLogs.length < 5 ? 'at-risk' : 'critical',
        benchmark: 3,
        outlier: recentAuditLogs.length > 5,
        recommendations: generateSafetyRecommendations(recentAuditLogs.length),
      },
    ];

    // Generate outlier alerts
    const alerts: OutlierAlert[] = generateOutlierAlerts(metrics, recentAuditLogs.map((log) => ({
      action: log.action,
      actorRole: log.actorRole ?? 'unknown',
      detail: typeof log.detail === 'string' ? log.detail : undefined,
    })));

    logger.info('Quality intelligence completed', {
      hospitalId,
      metricsCount: metrics.length,
      alertsCount: alerts.length,
    });

    return NextResponse.json({
      metrics,
      alerts,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Quality intelligence error', { error });
    return NextResponse.json(
      { error: 'Failed to generate quality intelligence' },
      { status: 500 }
    );
  }
}, ['admin']);

function calculateTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
  if (current > previous * 1.05) return 'improving';
  if (current < previous * 0.95) return 'declining';
  return 'stable';
}

function calculateTrendPercentage(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getStatus(current: number, previous: number, threshold: number): 'on-track' | 'at-risk' | 'critical' {
  if (current >= threshold) return 'on-track';
  if (current >= threshold * 0.8) return 'at-risk';
  return 'critical';
}

function isOutlier(current: number, previous: number): boolean {
  if (previous === 0) return false;
  const change = Math.abs((current - previous) / previous);
  return change > 0.3; // More than 30% change is considered an outlier
}

function generateClinicalRecommendations(current: number, previous: number): string[] {
  const recommendations: string[] = [];

  if (current < previous) {
    recommendations.push('Review clinical documentation practices');
    recommendations.push('Provide training on proper documentation');
  }

  if (current < 90) {
    recommendations.push('Implement clinical documentation templates');
    recommendations.push('Add documentation reminders in workflow');
  }

  recommendations.push('Continue monitoring documentation rates');

  return recommendations;
}

function generateOperationalRecommendations(current: number, previous: number): string[] {
  const recommendations: string[] = [];

  if (current < previous) {
    recommendations.push('Review appointment scheduling process');
    recommendations.push('Analyze patient no-show patterns');
  }

  if (current < 85) {
    recommendations.push('Implement appointment reminders');
    recommendations.push('Optimize scheduling algorithms');
  }

  recommendations.push('Monitor appointment adherence trends');

  return recommendations;
}

function generateSafetyRecommendations(incidentCount: number): string[] {
  const recommendations: string[] = [];

  if (incidentCount > 5) {
    recommendations.push('Conduct immediate safety review');
    recommendations.push('Implement additional safety protocols');
  } else if (incidentCount > 2) {
    recommendations.push('Review recent safety incidents');
    recommendations.push('Provide staff safety training');
  }

  recommendations.push('Continue safety incident monitoring');
  recommendations.push('Encourage incident reporting culture');

  return recommendations;
}

function generateOutlierAlerts(metrics: QualityMetric[], auditLogs: Array<{ action: string; actorRole: string; detail?: string }>): OutlierAlert[] {
  const alerts: OutlierAlert[] = [];

  // Check for outliers in metrics
  for (const metric of metrics) {
    if (metric.outlier) {
      alerts.push({
        id: `alert-${metric.id}`,
        metric: metric.name,
        severity: metric.status === 'critical' ? 'high' : metric.status === 'at-risk' ? 'medium' : 'low',
        description: `${metric.name} shows significant deviation (${metric.trendPercentage}% ${metric.trend}) from expected values`,
        actionRequired: metric.recommendations[0] || 'Review and investigate',
      });
    }
  }

  // Check for safety incidents
  if (auditLogs.length > 3) {
    alerts.push({
      id: 'alert-safety-001',
      metric: 'Safety Incidents',
      severity: auditLogs.length > 5 ? 'high' : 'medium',
      description: `${auditLogs.length} safety incidents detected this month`,
      affectedPatients: auditLogs.length,
      actionRequired: 'Conduct comprehensive safety review',
    });
  }

  return alerts;
}

