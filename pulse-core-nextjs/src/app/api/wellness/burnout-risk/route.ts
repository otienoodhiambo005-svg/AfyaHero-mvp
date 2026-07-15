/**
 * GET /api/wellness/burnout-risk
 *
 * Calculates burnout risk based on workload metrics, consultation load, and activity patterns
 * Provides actionable recommendations to prevent staff burnout
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  requireRoles,
} from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

interface BurnoutRiskFactors {
  patientLoad: number; // Number of patients seen in last 24h
  consultationDuration: number; // Average consultation time in minutes
  overtimeHours: number; // Hours worked beyond scheduled shift
  consecutiveShifts: number; // Number of consecutive days worked
  breakCompliance: number; // Percentage of breaks taken (0-100)
  nightShifts: number; // Number of night shifts in last week
}

interface BurnoutRiskScore {
  overall: number; // 0-100 risk score
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: {
    workload: { score: number; label: string; recommendation: string };
    schedule: { score: number; label: string; recommendation: string };
    recovery: { score: number; label: string; recommendation: string };
  };
  alerts: string[];
  recommendations: string[];
  immediateActions: string[];
}

function calculateBurnoutRisk(factors: BurnoutRiskFactors): BurnoutRiskScore {
  const scores = {
    workload: 0,
    schedule: 0,
    recovery: 0,
  };

  // Workload score (0-100)
  if (factors.patientLoad > 50) scores.workload += 40;
  else if (factors.patientLoad > 30) scores.workload += 25;
  else if (factors.patientLoad > 20) scores.workload += 10;

  if (factors.consultationDuration > 30) scores.workload += 30;
  else if (factors.consultationDuration > 20) scores.workload += 15;

  // Schedule score (0-100)
  if (factors.consecutiveShifts >= 7) scores.schedule += 50;
  else if (factors.consecutiveShifts >= 5) scores.schedule += 30;
  else if (factors.consecutiveShifts >= 3) scores.schedule += 15;

  if (factors.nightShifts >= 3) scores.schedule += 30;
  else if (factors.nightShifts >= 2) scores.schedule += 15;

  if (factors.overtimeHours > 4) scores.schedule += 20;
  else if (factors.overtimeHours > 2) scores.schedule += 10;

  // Recovery score (0-100, higher is worse)
  if (factors.breakCompliance < 30) scores.recovery += 50;
  else if (factors.breakCompliance < 50) scores.recovery += 30;
  else if (factors.breakCompliance < 70) scores.recovery += 15;

  const overall = Math.round((scores.workload + scores.schedule + scores.recovery) / 3);

  const level = overall >= 75 ? 'critical' : overall >= 50 ? 'high' : overall >= 25 ? 'moderate' : 'low';

  const alerts: string[] = [];
  const recommendations: string[] = [];
  const immediateActions: string[] = [];

  // Generate alerts
  if (scores.workload >= 50) alerts.push('High patient load detected');
  if (scores.schedule >= 50) alerts.push('Schedule strain detected');
  if (scores.recovery >= 50) alerts.push('Low break compliance');
  if (factors.consecutiveShifts >= 5) alerts.push('Extended consecutive shifts');
  if (factors.nightShifts >= 3) alerts.push('Frequent night shifts');

  // Generate recommendations
  if (scores.workload >= 30) {
    recommendations.push('Consider reducing patient load for next shift');
    recommendations.push('Delegate non-urgent tasks to support staff');
  }
  if (scores.schedule >= 30) {
    recommendations.push('Review shift scheduling for better work-life balance');
    recommendations.push('Ensure adequate rest between shifts');
  }
  if (scores.recovery >= 30) {
    recommendations.push('Take scheduled breaks to maintain energy');
    recommendations.push('Use break rooms for proper rest');
  }

  // Immediate actions for critical/high risk
  if (level === 'critical') {
    immediateActions.push('Immediate: Reduce current workload');
    immediateActions.push('Immediate: Take a 15-minute break');
    immediateActions.push('Immediate: Notify supervisor for support');
  } else if (level === 'high') {
    immediateActions.push('Take a break within the next hour');
    immediateActions.push('Review and prioritize remaining tasks');
  }

  return {
    overall,
    level,
    factors: {
      workload: {
        score: scores.workload,
        label: scores.workload >= 50 ? 'High' : scores.workload >= 25 ? 'Moderate' : 'Normal',
        recommendation: scores.workload >= 30 ? 'Reduce patient load, delegate tasks' : 'Maintain current pace',
      },
      schedule: {
        score: scores.schedule,
        label: scores.schedule >= 50 ? 'Strained' : scores.schedule >= 25 ? 'Moderate' : 'Balanced',
        recommendation: scores.schedule >= 30 ? 'Review schedule, ensure rest periods' : 'Schedule looks balanced',
      },
      recovery: {
        score: scores.recovery,
        label: scores.recovery >= 50 ? 'Poor' : scores.recovery >= 25 ? 'Fair' : 'Good',
        recommendation: scores.recovery >= 30 ? 'Increase break compliance' : 'Good recovery habits',
      },
    },
    alerts,
    recommendations,
    immediateActions,
  };
}

export async function GET(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:wellness:burnout-risk');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['medical', 'reception', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId') || session.id;

    // Get consultation count in last 24 hours
    const consultationsLast24h = await prisma.consultation.count({
      where: {
        practitionerId: staffId,
        hospitalId: session.hospitalId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    // Get queue items assigned to this staff
    const queueItems = await prisma.hospitalQueue.count({
      where: {
        assignedTo: staffId,
        hospitalId: session.hospitalId,
        status: 'in_progress',
      },
    });

    // Calculate factors (mock data for now - in production, this would come from shift scheduling system)
    const factors: BurnoutRiskFactors = {
      patientLoad: consultationsLast24h + queueItems,
      consultationDuration: 15, // Average in minutes (mock)
      overtimeHours: 0, // Would come from shift records
      consecutiveShifts: 1, // Would come from scheduling system
      breakCompliance: 75, // Would come from break tracking
      nightShifts: 0, // Would come from shift records
    };

    const riskScore = calculateBurnoutRisk(factors);

    return NextResponse.json({
      staffId,
      riskScore,
      factors,
      calculatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[Burnout Risk GET] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
