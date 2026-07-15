/**
 * GET /api/wellness/workload-balance
 *
 * Analyzes workload distribution across staff and identifies imbalances
 * Provides recommendations for workload balancing
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

export async function GET(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:wellness:workload-balance');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const timeWindow = searchParams.get('window') || '24h'; // 24h, 7d, 30d

    // Get all medical staff for this hospital
    const staff = await prisma.profile.findMany({
      where: {
        hospitalId: session.hospitalId,
        role: 'medical',
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    // Calculate workload for each staff member
    const workloadData = await Promise.all(
      staff.map(async (staffMember) => {
        const consultations = await prisma.consultation.count({
          where: {
            practitionerId: staffMember.id,
            hospitalId: session.hospitalId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });

        const queueItems = await prisma.hospitalQueue.count({
          where: {
            assignedTo: staffMember.id,
            hospitalId: session.hospitalId,
            status: 'in_progress',
          },
        });

        return {
          staffId: staffMember.id,
          name: staffMember.fullName,
          consultations,
          queueItems,
          totalWorkload: consultations + queueItems,
        };
      })
    );

    // Calculate statistics
    const workloads = workloadData.map((w) => w.totalWorkload);
    const avgWorkload = workloads.length > 0 ? workloads.reduce((a, b) => a + b, 0) / workloads.length : 0;
    const maxWorkload = Math.max(...workloads, 0);
    const minWorkload = Math.min(...workloads, 0);

    // Identify imbalances
    const overloaded = workloadData.filter((w) => w.totalWorkload > avgWorkload * 1.5);
    const underloaded = workloadData.filter((w) => w.totalWorkload < avgWorkload * 0.5 && w.totalWorkload < 5);

    const balanceScore = maxWorkload > 0 ? (1 - (maxWorkload - minWorkload) / maxWorkload) * 100 : 100;

    // Generate recommendations
    const recommendations: string[] = [];
    if (overloaded.length > 0) {
      recommendations.push(`Redistribute patients from ${overloaded.map(o => o.name).join(', ')}`);
      recommendations.push('Consider bringing in additional staff if overload persists');
    }
    if (underloaded.length > 0) {
      recommendations.push(`Assign more patients to ${underloaded.map(u => u.name).join(', ')}`);
    }
    if (balanceScore < 60) {
      recommendations.push('Review shift scheduling to improve balance');
    }

    return NextResponse.json({
      balanceScore: Math.round(balanceScore),
      balanceLevel: balanceScore >= 80 ? 'excellent' : balanceScore >= 60 ? 'good' : balanceScore >= 40 ? 'fair' : 'poor',
      workloadData,
      statistics: {
        average: Math.round(avgWorkload),
        maximum: maxWorkload,
        minimum: minWorkload,
        totalStaff: staff.length,
      },
      overloaded: overloaded.map((o) => ({ name: o.name, workload: o.totalWorkload })),
      underloaded: underloaded.map((u) => ({ name: u.name, workload: u.totalWorkload })),
      recommendations,
      calculatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[Workload Balance GET] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
